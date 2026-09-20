import { useEffect, useRef, useState } from "react";

import { ACTIVITY_POLL_MS, type ActivitySnapshot } from "../lib/activity";
import { applyAudioSettings, playSfx } from "../lib/audio";
import { audioSettingsOf, pomodoroSettingsOf } from "../lib/configLogic";
import {
  isPetPoseId,
  PET_POSE_LIST,
  PET_POSES,
  poseSrc,
  preloadPetPoses,
  type PetLifecycle,
  type PetPoseId,
} from "../lib/mascots";
import { bumpMood, clampMood, decayMood, moodLabelZh } from "../lib/mood";
import { makeToast, toastDurationMs, type PetToast } from "../lib/notifications";
import {
  DOUBLE_CLICK_MS,
  isDragFromDelta,
  nextPlayfulPose,
  poseForDrag,
  poseForFeed,
  poseForHover,
  poseForPat,
} from "../lib/petInteractions";
import {
  IDLE_CYCLE_MS,
  MANUAL_HOLD_MS,
  POSE_CROSSFADE_MS,
  evolveLifecycle,
  nextIdlePose,
  planCrossfade,
  resolveCompanionPose,
  shouldPauseIdleCycle,
} from "../lib/poseMachine";
import {
  formatRemaining,
  idlePomodoro,
  remainingMs,
  skipPhase,
  tickPomodoro,
  togglePomodoro,
  type PomodoroState,
} from "../lib/pomodoro";
import {
  FEED_COMBO_COUNT,
  FEED_COMBO_WINDOW_MS,
  greetPeriodForHour,
  idleBubbleReason,
  isWelcomeBack,
  pickLine,
  shouldEmitIdleBubble,
  trayLabel,
  type CompanionAction,
} from "../lib/companionLines";
import { tauriApi } from "../lib/tauriApi";
import { startCurrentWindowDrag } from "../lib/tauriWindowApi";
import type { AppConfig } from "../lib/types";

const LIFECYCLES: ReadonlySet<string> = new Set([
  "idle",
  "away",
  "connecting",
  "thinking",
  "streaming",
  "tool",
  "create",
  "affection",
  "success",
  "error",
  "welcome",
]);

function asLifecycle(value: string): PetLifecycle {
  return LIFECYCLES.has(value) ? (value as PetLifecycle) : "idle";
}

export default function PetWindow() {
  const [frontId, setFrontId] = useState<PetPoseId>("wave");
  const [backId, setBackId] = useState<PetPoseId | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lockPose, setLockPose] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [wiggling, setWiggling] = useState(false);
  const [toast, setToast] = useState<PetToast | null>(null);
  const [mood, setMood] = useState(64);
  const [moodEnabled, setMoodEnabled] = useState(true);
  const [opacity, setOpacity] = useState(100);
  const [pomoLabel, setPomoLabel] = useState("");

  const poseRef = useRef<PetPoseId>("wave");
  const idleRef = useRef<PetPoseId>("wave");
  const autoRef = useRef(true);
  const lockRef = useRef(false);
  const lifeRef = useRef<PetLifecycle>("idle");
  const lifeAtRef = useRef(0);
  const tickRef = useRef(0);
  const playfulTickRef = useRef(0);
  const manualHoldUntilRef = useRef(0);
  const lastIdleAtRef = useRef(0);
  const draggingRef = useRef(false);
  const moved = useRef(false);
  const readyRef = useRef(false);
  const fadeTimer = useRef(0);
  const leaveFrame = useRef(0);
  const lastClickAt = useRef(0);
  const pointerOrigin = useRef({ x: 0, y: 0 });
  const applyPoseRef = useRef<(next: PetPoseId, sfx?: boolean) => void>(
    () => undefined,
  );
  const companionActionRef = useRef<(action: CompanionAction) => void>(() => undefined);
  const cfgRef = useRef<AppConfig | null>(null);
  const activityRef = useRef<ActivitySnapshot | null>(null);
  const lastActivityKind = useRef<string>("");
  const pomoRef = useRef<PomodoroState>(idlePomodoro());
  const moodRef = useRef(64);
  const toastTimer = useRef(0);
  const lastPoseSfxAt = useRef(0);
  const greetedKey = useRef("");
  const lastBubbleAt = useRef(0);
  const prevIdleMs = useRef(0);
  const feedAtRef = useRef<number[]>([]);
  const lastTrayLabel = useRef("");

  const showToast = (text: string, tone: PetToast["tone"] = "info") => {
    const next = makeToast(text, tone);
    setToast(next);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(
      () => setToast(null),
      toastDurationMs(next.text),
    );
  };

  useEffect(() => {
    preloadPetPoses();
    lastIdleAtRef.current = Date.now();
    lifeAtRef.current = Date.now();
    lastBubbleAt.current = Date.now();
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    const applyPose = (next: PetPoseId, sfx = false) => {
      if (disposed) return;
      const target = isPetPoseId(next) ? next : "wave";
      const plan = planCrossfade(poseRef.current, target);
      if (!plan) return;
      poseRef.current = plan.to;
      window.clearTimeout(fadeTimer.current);
      if (leaveFrame.current) window.cancelAnimationFrame(leaveFrame.current);
      setBackId(plan.from);
      setFrontId(plan.to);
      setLeaving(false);
      leaveFrame.current = window.requestAnimationFrame(() => {
        leaveFrame.current = window.requestAnimationFrame(() => {
          if (disposed) return;
          setLeaving(true);
        });
      });
      fadeTimer.current = window.setTimeout(() => {
        if (disposed) return;
        setBackId(null);
        setLeaving(false);
      }, POSE_CROSSFADE_MS);
      if (sfx && cfgRef.current) {
        const now = Date.now();
        if (now - lastPoseSfxAt.current > 8_000) {
          lastPoseSfxAt.current = now;
          playSfx("pose-change", audioSettingsOf(cfgRef.current));
        }
      }
    };
    applyPoseRef.current = applyPose;

    const companionPose = () => {
      const cfg = cfgRef.current;
      return resolveCompanionPose({
        lifecycle: evolveLifecycle(lifeRef.current, Date.now() - lifeAtRef.current),
        lockPose: lockRef.current,
        autoExpression: autoRef.current,
        current: poseRef.current,
        idlePose: idleRef.current,
        tick: tickRef.current,
        hour: new Date().getHours(),
        timeOfDayPoses: cfg?.timeOfDayPoses,
        activityAware: cfg?.activityAware,
        activity: activityRef.current,
        idleThresholdMs: (cfg?.idleThresholdSec ?? 50) * 1000,
        longIdleThresholdMs: (cfg?.longIdleThresholdSec ?? 420) * 1000,
        foregroundHints: cfg?.foregroundHints,
        moodEnabled: cfg?.moodMeterEnabled,
        moodEnergy: cfg?.moodMeterEnabled ? moodRef.current : undefined,
        pomodoroPhase: pomoRef.current.phase,
      });
    };

    const applyFromState = (sfx = false) => {
      if (lockRef.current) return;
      applyPose(companionPose(), sfx);
    };

    const applyConfig = (cfg: AppConfig) => {
      cfgRef.current = cfg;
      idleRef.current = cfg.mascotId;
      autoRef.current = cfg.autoExpression;
      lockRef.current = cfg.lockPose;
      setLockPose(cfg.lockPose);
      setOpacity(cfg.petOpacity);
      const nextMood = clampMood(cfg.moodEnergy);
      moodRef.current = nextMood;
      setMood(nextMood);
      setMoodEnabled(cfg.moodMeterEnabled);
      applyAudioSettings(audioSettingsOf(cfg));
      if (!readyRef.current) {
        readyRef.current = true;
        poseRef.current = cfg.mascotId;
        setFrontId(cfg.mascotId);
        void tauriApi.applyPetWindow();
        return;
      }
      void tauriApi.applyPetWindow();
      if (lockRef.current) {
        applyPose(cfg.mascotId);
        return;
      }
      applyFromState();
    };

    void tauriApi.loadConfig().then((cfg) => {
      if (disposed) return;
      applyConfig(cfg);
    });
    void tauriApi
      .listenMascotChanged((id) => {
        if (!isPetPoseId(id)) return;
        idleRef.current = id;
        if (!lockRef.current) {
          manualHoldUntilRef.current = Date.now() + MANUAL_HOLD_MS;
        }
        applyPose(id);
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisteners.push(fn);
      });
    void tauriApi
      .listenPetLifecycle((life) => {
        const next = asLifecycle(life);
        lifeRef.current = next;
        lifeAtRef.current = Date.now();
        lastIdleAtRef.current = Date.now();
        manualHoldUntilRef.current = 0;
        applyFromState();
        const cfg = cfgRef.current;
        if (!cfg) return;
        const audio = audioSettingsOf(cfg);
        if (next === "thinking" && cfg.moodMeterEnabled) {
          const bumped = bumpMood(moodRef.current, "chat");
          moodRef.current = bumped;
          setMood(bumped);
        }
        if (next === "success") {
          playSfx("message-received", audio);
          if (cfg.moodMeterEnabled) {
            const bumped = bumpMood(moodRef.current, "success");
            moodRef.current = bumped;
            setMood(bumped);
          }
        }
        if (next === "error") playSfx("error", audio);
        if (next === "connecting") showToast("正在连接后端…");
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisteners.push(fn);
      });
    void tauriApi
      .listenConfigUpdated(() => {
        void tauriApi.loadConfig().then((cfg) => {
          if (disposed) return;
          applyConfig(cfg);
        });
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisteners.push(fn);
      });
    void tauriApi
      .listenPetToast((item) => showToast(item.text, item.tone))
      .then((fn) => {
        if (disposed) fn();
        else unlisteners.push(fn);
      });
    void tauriApi
      .listenPomodoroToggle(() => {
        const cfg = cfgRef.current;
        if (!cfg) return;
        pomoRef.current = togglePomodoro(
          pomoRef.current,
          Date.now(),
          pomodoroSettingsOf(cfg),
        );
        playSfx("pomodoro", audioSettingsOf(cfg));
        showToast(pomoRef.current.phase === "idle" ? "番茄钟已结束" : "开始专注", "ok");
        applyFromState();
        void tauriApi.emitPomodoroUpdated(pomoRef.current);
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisteners.push(fn);
      });
    void tauriApi
      .listenPomodoroSkip(() => {
        const cfg = cfgRef.current;
        if (!cfg) return;
        pomoRef.current = skipPhase(
          pomoRef.current,
          Date.now(),
          pomodoroSettingsOf(cfg),
        );
        playSfx("pomodoro", audioSettingsOf(cfg));
        showToast(pomoRef.current.phase === "focus" ? "进入专注" : "进入休息", "ok");
        applyFromState();
        void tauriApi.emitPomodoroUpdated(pomoRef.current);
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisteners.push(fn);
      });

    const speak = (reason: Parameters<typeof pickLine>[0], tick = 0, force = false) => {
      if (!force && cfgRef.current?.companionBubbles === false) return;
      showToast(pickLine(reason, tick));
      lastBubbleAt.current = Date.now();
    };

    const runAction = (action: CompanionAction) => {
      const cfg = cfgRef.current;
      const now = Date.now();
      if (!lockRef.current) {
        manualHoldUntilRef.current = now + MANUAL_HOLD_MS;
      }
      if (action === "pat") {
        applyPose(poseForPat(), false);
        if (cfg) playSfx("pat", audioSettingsOf(cfg));
        if (cfg?.moodMeterEnabled) {
          const nextMood = bumpMood(moodRef.current, "pat");
          moodRef.current = nextMood;
          setMood(nextMood);
        }
        speak("pat", tickRef.current, true);
        return;
      }
      if (action === "feed") {
        feedAtRef.current = [
          ...feedAtRef.current.filter((stamp) => now - stamp < FEED_COMBO_WINDOW_MS),
          now,
        ];
        const full = feedAtRef.current.length >= FEED_COMBO_COUNT;
        if (full) feedAtRef.current = [];
        applyPose(full ? "celebrate" : poseForFeed(), false);
        if (cfg) playSfx("feed", audioSettingsOf(cfg));
        if (cfg?.moodMeterEnabled) {
          const nextMood = bumpMood(moodRef.current, "feed");
          moodRef.current = nextMood;
          setMood(nextMood);
        }
        speak(full ? "full" : "feed", tickRef.current, true);
        return;
      }
      applyPose("night", false);
      speak("night", tickRef.current, true);
    };
    companionActionRef.current = runAction;

    void tauriApi.listenCompanionAction(runAction).then((fn) => {
      if (disposed) fn();
      else unlisteners.push(fn);
    });

    const poll = window.setInterval(() => {
      if (disposed) return;
      const now = Date.now();
      const cfg = cfgRef.current;
      if (cfg && pomoRef.current.phase !== "idle") {
        const ticked = tickPomodoro(pomoRef.current, now, pomodoroSettingsOf(cfg));
        if (ticked.phaseChanged) {
          pomoRef.current = ticked.state;
          playSfx("pomodoro", audioSettingsOf(cfg));
          showToast(
            ticked.state.phase === "focus"
              ? "休息结束，继续专注"
              : "专注结束，休息一下",
            "ok",
          );
          void tauriApi.emitPomodoroUpdated(ticked.state);
          applyFromState(true);
        } else {
          pomoRef.current = ticked.state;
        }
        setPomoLabel(formatRemaining(remainingMs(pomoRef.current, now)));
      } else {
        setPomoLabel((current) => (current ? "" : current));
      }
      const nextTray = trayLabel(
        pomoRef.current.phase === "idle"
          ? ""
          : formatRemaining(remainingMs(pomoRef.current, now)),
      );
      if (nextTray !== lastTrayLabel.current) {
        lastTrayLabel.current = nextTray;
        void tauriApi.setTrayTooltip(nextTray);
      }

      if (
        lifeRef.current === "streaming" &&
        !lockRef.current &&
        autoRef.current &&
        evolveLifecycle("streaming", now - lifeAtRef.current) === "create"
      ) {
        lifeRef.current = "create";
        applyFromState();
        return;
      }

      if (cfg?.timeOfDayPoses) {
        const hour = new Date().getHours();
        const period = greetPeriodForHour(hour);
        if (period && lifeRef.current === "idle") {
          const key = `${period}:${new Date().toDateString()}`;
          if (greetedKey.current !== key) {
            greetedKey.current = key;
            applyPose(period === "night" ? "night" : "hug", true);
            speak(period, tickRef.current, true);
          }
        }
      }

      if (
        cfg?.companionBubbles !== false &&
        lifeRef.current === "idle" &&
        !lockRef.current &&
        shouldEmitIdleBubble(now, lastBubbleAt.current)
      ) {
        lastBubbleAt.current = now;
        speak(
          idleBubbleReason({
            mood: moodRef.current,
            pomodoroPhase: pomoRef.current.phase,
            activityKind: activityRef.current?.kind,
            foreground: activityRef.current?.foreground?.category,
          }),
          tickRef.current,
        );
      }

      if (cfg?.activityAware) {
        void tauriApi
          .getActivitySnapshot({
            includeForeground: cfg.foregroundHints,
            idleThresholdMs: cfg.idleThresholdSec * 1000,
          })
          .then((snap) => {
            if (disposed) return;
            const previousIdle = prevIdleMs.current;
            prevIdleMs.current = snap.idleMs;
            activityRef.current = snap;
            if (cfg.moodMeterEnabled) {
              let nextMood = decayMood(moodRef.current, snap.idleMs);
              if (
                isWelcomeBack(
                  previousIdle,
                  snap.idleMs,
                  cfg.longIdleThresholdSec * 1000,
                )
              ) {
                nextMood = bumpMood(nextMood, "return");
                applyPose("hug", true);
                speak("welcome-back", tickRef.current, true);
              }
              if (nextMood !== moodRef.current) {
                moodRef.current = nextMood;
                setMood(nextMood);
              }
            } else if (
              isWelcomeBack(previousIdle, snap.idleMs, cfg.longIdleThresholdSec * 1000)
            ) {
              applyPose("hug", true);
              speak("welcome-back", tickRef.current, true);
            }
            const signature = `${snap.kind}:${snap.source}:${snap.foreground?.category ?? ""}`;
            if (
              signature !== lastActivityKind.current &&
              !lockRef.current &&
              now >= manualHoldUntilRef.current
            ) {
              lastActivityKind.current = signature;
              applyFromState(true);
            }
          });
      }

      if (
        shouldPauseIdleCycle({
          lockPose: lockRef.current,
          autoExpression: autoRef.current,
          dragging: draggingRef.current,
          lifecycle: lifeRef.current,
          now,
          manualHoldUntil: manualHoldUntilRef.current,
        })
      ) {
        return;
      }
      if (now - lastIdleAtRef.current < IDLE_CYCLE_MS) return;
      lastIdleAtRef.current = now;
      tickRef.current += 1;
      applyPose(
        nextIdlePose(poseRef.current, {
          hour: new Date().getHours(),
          tick: tickRef.current,
          preferred: idleRef.current,
          timeOfDayPoses: cfg?.timeOfDayPoses,
          moodEnergy: cfg?.moodMeterEnabled ? moodRef.current : undefined,
        }),
      );
    }, ACTIVITY_POLL_MS);

    return () => {
      disposed = true;
      unlisteners.forEach((fn) => fn());
      window.clearInterval(poll);
      window.clearTimeout(fadeTimer.current);
      window.clearTimeout(toastTimer.current);
      if (leaveFrame.current) window.cancelAnimationFrame(leaveFrame.current);
      const cfg = cfgRef.current;
      if (cfg) void tauriApi.patchConfig({ moodEnergy: moodRef.current });
    };
  }, []);

  const bump = (reason: "click" | "pat" | "feed" | "hover") => {
    const cfg = cfgRef.current;
    if (!cfg?.moodMeterEnabled) return;
    setMood((current) => {
      const next = bumpMood(current, reason);
      moodRef.current = next;
      return next;
    });
  };

  const holdAndPose = (pose: PetPoseId, sfxName: "pat" | "feed" | "pose-change") => {
    if (!lockRef.current) {
      manualHoldUntilRef.current = Date.now() + MANUAL_HOLD_MS;
    }
    applyPoseRef.current(pose, false);
    const cfg = cfgRef.current;
    if (cfg)
      playSfx(
        sfxName === "pose-change" ? "pose-change" : sfxName,
        audioSettingsOf(cfg),
      );
  };

  const front = PET_POSES[frontId];
  const back = backId ? PET_POSES[backId] : null;

  return (
    <div
      className={`pet-root${hovered ? " is-hovered" : ""}${wiggling ? " is-wiggling" : ""}`}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
      onPointerEnter={() => {
        setHovered(true);
        if (!lockRef.current && lifeRef.current === "idle" && !draggingRef.current) {
          applyPoseRef.current(poseForHover(poseRef.current));
          bump("hover");
        }
      }}
      onPointerLeave={() => {
        setHovered(false);
        draggingRef.current = false;
        setWiggling(false);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        moved.current = false;
        draggingRef.current = false;
        pointerOrigin.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerMove={(event) => {
        if (event.buttons !== 1) return;
        if (
          isDragFromDelta(
            event.clientX - pointerOrigin.current.x,
            event.clientY - pointerOrigin.current.y,
          )
        ) {
          moved.current = true;
          draggingRef.current = true;
          setWiggling(true);
          if (!lockRef.current) applyPoseRef.current(poseForDrag());
          void startCurrentWindowDrag();
        }
      }}
      onPointerUp={() => {
        const wasDrag = draggingRef.current;
        draggingRef.current = false;
        setWiggling(false);
        if (wasDrag) {
          const snap = cfgRef.current?.edgeSnap ?? true;
          void tauriApi.clampPetToWorkArea(snap);
        }
      }}
      onClick={() => {
        if (moved.current) return;
        setMenuOpen(false);
        const now = Date.now();
        if (now - lastClickAt.current < DOUBLE_CLICK_MS) {
          lastClickAt.current = 0;
          void (async () => {
            const visible = await tauriApi.isChatVisible();
            if (visible) await tauriApi.focusChat();
            else await tauriApi.showChatNearPet();
          })();
          return;
        }
        lastClickAt.current = now;
        playfulTickRef.current += 1;
        holdAndPose(
          nextPlayfulPose(poseRef.current, playfulTickRef.current),
          "pose-change",
        );
        bump("click");
      }}
    >
      <div
        className="pet-stage"
        style={{
          ["--pose-fade-ms" as string]: `${POSE_CROSSFADE_MS}ms`,
          opacity: opacity / 100,
        }}
      >
        {back ? (
          <img
            className={`pet-sprite is-back${leaving ? " is-leaving" : ""}`}
            src={poseSrc(back.id)}
            alt=""
            aria-hidden
            draggable={false}
            decoding="async"
          />
        ) : null}
        <img
          className="pet-sprite is-front"
          src={front.src}
          alt={front.labelZh}
          draggable={false}
          decoding="async"
        />
        {hovered ? <div className="pet-sparkle" aria-hidden /> : null}
        {frontId === "night" ? <div className="pet-zzz" aria-hidden /> : null}
      </div>
      {moodEnabled ? (
        <div className="pet-mood" title={moodLabelZh(mood)}>
          <span style={{ width: `${mood}%` }} />
        </div>
      ) : null}
      {pomoLabel ? <div className="pet-pomo">{pomoLabel}</div> : null}
      {toast ? (
        <div className={`pet-toast is-${toast.tone}`} role="status">
          {toast.text}
        </div>
      ) : null}
      {menuOpen ? (
        <div className="pet-menu" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void tauriApi.showChatNearPet();
            }}
          >
            打开对话
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              companionActionRef.current("pat");
            }}
          >
            拍一拍
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              companionActionRef.current("feed");
            }}
          >
            喂食
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              companionActionRef.current("night");
            }}
          >
            晚安
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void tauriApi.showSettings();
            }}
          >
            设置…
          </button>
          <button
            type="button"
            className={lockPose ? "is-active" : ""}
            onClick={() => {
              const next = !lockRef.current;
              lockRef.current = next;
              setLockPose(next);
              void tauriApi.patchConfig({ lockPose: next });
              void tauriApi.emitConfigUpdated();
            }}
          >
            锁定姿态
          </button>
          <div className="pet-menu-poses">
            {PET_POSE_LIST.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === frontId ? "is-active" : ""}
                title={item.labelZh}
                onClick={() => {
                  idleRef.current = item.id;
                  if (!lockRef.current) {
                    manualHoldUntilRef.current = Date.now() + MANUAL_HOLD_MS;
                  }
                  applyPoseRef.current(item.id);
                  void tauriApi.patchConfig({ mascotId: item.id });
                  void tauriApi.emitMascotChanged(item.id);
                }}
              >
                <img src={item.src} alt={item.labelZh} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void tauriApi.quitApp();
            }}
          >
            退出
          </button>
        </div>
      ) : null}
    </div>
  );
}

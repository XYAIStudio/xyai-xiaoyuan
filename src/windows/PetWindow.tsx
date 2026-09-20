import { useEffect, useRef, useState } from "react";

import {
  isPetPoseId,
  PET_POSE_LIST,
  PET_POSES,
  poseForLifecycle,
  poseSrc,
  preloadPetPoses,
  type PetLifecycle,
  type PetPoseId,
} from "../lib/mascots";
import {
  IDLE_CYCLE_MS,
  MANUAL_HOLD_MS,
  POSE_CROSSFADE_MS,
  evolveLifecycle,
  nextIdlePose,
  planCrossfade,
  shouldPauseIdleCycle,
} from "../lib/poseMachine";
import { tauriApi } from "../lib/tauriApi";
import { startCurrentWindowDrag } from "../lib/tauriWindowApi";

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

  const poseRef = useRef<PetPoseId>("wave");
  const idleRef = useRef<PetPoseId>("wave");
  const autoRef = useRef(true);
  const lockRef = useRef(false);
  const lifeRef = useRef<PetLifecycle>("idle");
  const lifeAtRef = useRef(Date.now());
  const tickRef = useRef(0);
  const manualHoldUntilRef = useRef(0);
  const lastIdleAtRef = useRef(Date.now());
  const draggingRef = useRef(false);
  const moved = useRef(false);
  const readyRef = useRef(false);
  const fadeTimer = useRef(0);
  const leaveFrame = useRef(0);
  const applyPoseRef = useRef<(next: PetPoseId) => void>(() => undefined);

  useEffect(() => {
    preloadPetPoses();
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    const applyPose = (next: PetPoseId) => {
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
    };
    applyPoseRef.current = applyPose;

    const applyFromState = () => {
      if (lockRef.current) return;
      const life = evolveLifecycle(lifeRef.current, Date.now() - lifeAtRef.current);
      applyPose(
        poseForLifecycle(life, {
          idlePose: idleRef.current,
          hour: new Date().getHours(),
          autoExpression: autoRef.current,
          lockPose: lockRef.current,
          tick: tickRef.current,
          current: poseRef.current,
        }),
      );
    };

    const applyConfig = (cfg: {
      mascotId: PetPoseId;
      autoExpression: boolean;
      lockPose: boolean;
    }) => {
      idleRef.current = cfg.mascotId;
      autoRef.current = cfg.autoExpression;
      lockRef.current = cfg.lockPose;
      setLockPose(cfg.lockPose);
      if (!readyRef.current) {
        readyRef.current = true;
        poseRef.current = cfg.mascotId;
        setFrontId(cfg.mascotId);
        return;
      }
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
      .then((fn) => unlisteners.push(fn));
    void tauriApi
      .listenPetLifecycle((life) => {
        lifeRef.current = asLifecycle(life);
        lifeAtRef.current = Date.now();
        lastIdleAtRef.current = Date.now();
        manualHoldUntilRef.current = 0;
        applyFromState();
      })
      .then((fn) => unlisteners.push(fn));
    void tauriApi
      .listenConfigUpdated(() => {
        void tauriApi.loadConfig().then((cfg) => {
          if (disposed) return;
          applyConfig(cfg);
        });
      })
      .then((fn) => unlisteners.push(fn));

    const poll = window.setInterval(() => {
      if (disposed) return;
      const now = Date.now();
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
        }),
      );
    }, 500);

    return () => {
      disposed = true;
      unlisteners.forEach((fn) => fn());
      window.clearInterval(poll);
      window.clearTimeout(fadeTimer.current);
      if (leaveFrame.current) window.cancelAnimationFrame(leaveFrame.current);
    };
  }, []);

  const front = PET_POSES[frontId];
  const back = backId ? PET_POSES[backId] : null;

  return (
    <div
      className="pet-root"
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        moved.current = false;
        draggingRef.current = false;
      }}
      onPointerMove={(event) => {
        if (event.buttons !== 1) return;
        moved.current = true;
        draggingRef.current = true;
        void startCurrentWindowDrag();
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      onPointerLeave={() => {
        draggingRef.current = false;
      }}
      onClick={() => {
        if (moved.current) return;
        setMenuOpen(false);
        void tauriApi.showChatNearPet();
      }}
    >
      <div
        className="pet-stage"
        style={{ ["--pose-fade-ms" as string]: `${POSE_CROSSFADE_MS}ms` }}
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
      </div>
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

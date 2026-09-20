import type { ActivityKind, AppCategory } from "./activity";
import type { PomodoroPhase } from "./pomodoro";
import { dayPeriodFromHour, type DayPeriod } from "./timeOfDay";

export type CompanionAction = "pat" | "feed" | "night";

export type CompanionLineReason =
  | "idle"
  | "welcome-back"
  | "morning"
  | "evening"
  | "night"
  | "pat"
  | "feed"
  | "full"
  | "low-mood"
  | "focus"
  | "break"
  | "typing"
  | "meeting";

export const IDLE_BUBBLE_MS = 90_000;
export const FEED_COMBO_WINDOW_MS = 25_000;
export const FEED_COMBO_COUNT = 3;
export const WELCOME_BACK_ACTIVE_MS = 2_000;

const LINES: Record<CompanionLineReason, readonly string[]> = {
  idle: ["我在这儿陪你", "慢慢来，不着急", "需要我就喊一声"],
  "welcome-back": ["欢迎回来", "你回来啦，我一直在", "休息好了吗？"],
  morning: ["早上好，小元在呢", "新的一天，我陪你开工", "早安，先喝口水"],
  evening: ["傍晚好，要不要歇一会儿", "天色晚了，我还在", "今天辛苦了"],
  night: ["晚安，我在这儿陪你", "夜深了，我守着", "早点休息，我还在"],
  pat: ["嘿嘿", "比心给你", "再拍一下也行"],
  feed: ["谢谢投喂", "好好吃", "下次还想吃"],
  full: ["吃饱啦", "心满意足", "再吃就要撑着了"],
  "low-mood": ["有点困了", "陪我待一会儿吧", "好想靠着你"],
  focus: ["专心就好，我守着时间", "专注中，加油", "这段时间我帮你盯着"],
  break: ["起来走动一下吧", "休息也是工作的一部分", "喝口水，我等你"],
  typing: ["写得很认真呢", "我在旁边看你敲字", "思路顺的话就一气呵成"],
  meeting: ["开会的时候我小声待着", "会议中，我先不吵你", "开完会再找我玩"],
};

export function companionActionFromText(
  text: string,
): CompanionAction | "pomodoro" | "skip" | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/^(拍一拍|摸摸|摸摸头|\/pat)$/i.test(trimmed)) return "pat";
  if (/^(喂食|吃点|饿了|\/feed)$/i.test(trimmed)) return "feed";
  if (/^(晚安|去睡|\/night)$/i.test(trimmed)) return "night";
  if (/^(开始专注|番茄钟|\/pomo)$/i.test(trimmed)) return "pomodoro";
  if (/^(跳过|下一阶段|\/skip)$/i.test(trimmed)) return "skip";
  return null;
}

export function pickLine(reason: CompanionLineReason, tick = 0): string {
  const pool = LINES[reason];
  return pool[((tick % pool.length) + pool.length) % pool.length];
}

export function greetPeriodForHour(hour: number): Exclude<DayPeriod, "day"> | null {
  const period = dayPeriodFromHour(hour);
  return period === "day" ? null : period;
}

export function isWelcomeBack(
  prevIdleMs: number,
  nextIdleMs: number,
  longIdleMs: number,
): boolean {
  return prevIdleMs >= longIdleMs && nextIdleMs < WELCOME_BACK_ACTIVE_MS;
}

export function shouldEmitIdleBubble(
  now: number,
  lastAt: number,
  minGap = IDLE_BUBBLE_MS,
): boolean {
  return now - lastAt >= minGap;
}

export function idleBubbleReason(input: {
  mood: number;
  pomodoroPhase?: PomodoroPhase;
  activityKind?: ActivityKind;
  foreground?: AppCategory;
}): CompanionLineReason {
  if (input.pomodoroPhase === "focus") return "focus";
  if (input.pomodoroPhase === "break" || input.pomodoroPhase === "longBreak") {
    return "break";
  }
  if (input.foreground === "meeting") return "meeting";
  if (input.activityKind === "typing") return "typing";
  if (input.mood < 30) return "low-mood";
  return "idle";
}

export function trayLabel(pomoText: string): string {
  const clipped = pomoText.trim();
  return clipped ? `小元 · ${clipped}` : "XYAI精灵小元";
}

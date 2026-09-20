export type DayPeriod = "morning" | "day" | "evening" | "night";

/** Local-clock buckets used by the pose machine. */
export function dayPeriodFromHour(hour: number): DayPeriod {
  const wrapped = ((hour % 24) + 24) % 24;
  if (wrapped >= 6 && wrapped < 10) return "morning";
  if (wrapped >= 10 && wrapped < 18) return "day";
  if (wrapped >= 18 && wrapped < 22) return "evening";
  return "night";
}

export function isNightPeriod(hour: number): boolean {
  return dayPeriodFromHour(hour) === "night";
}

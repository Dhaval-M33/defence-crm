export function toLocalIsoDate(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

/**
 * Today in the machine's own timezone. `toISOString()` would give the UTC date,
 * which is still yesterday for anyone east of UTC until their local morning, so
 * a deadline of "today" would be treated as being in the future.
 */
export function todayLocalIso(now: Date = new Date()): string {
  return toLocalIsoDate(now);
}

export function isoDatePlusDays(offsetDays: number, from: Date = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  date.setDate(date.getDate() + offsetDays);
  return toLocalIsoDate(date);
}

/** True when the deadline is today or already past. ISO dates compare as text. */
export function isDueOnOrBefore(deadlineIso: string, todayIso: string): boolean {
  if (deadlineIso === "") return false;
  return deadlineIso <= todayIso;
}

import { z } from "zod";

const CalendarDateSchema = z.iso.date();

/** True for a real `YYYY-MM-DD` calendar date (rejects `2026-06-31`). */
export function isCalendarDate(value: string | undefined): value is string {
  return value !== undefined && CalendarDateSchema.safeParse(value).success;
}

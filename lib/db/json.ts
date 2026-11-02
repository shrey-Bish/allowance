// Helpers for the String columns that hold JSON (kept as String so the schema
// is portable between SQLite and Postgres).
import type { ZodType } from "zod";

export function parseJson<T>(raw: string | null | undefined, schema: ZodType<T>, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

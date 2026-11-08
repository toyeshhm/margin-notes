export function log(
  level: "info" | "warn" | "error",
  msg: string,
  data?: Record<string, unknown>,
): void {
  console[level](JSON.stringify({ level, msg, ...data }));
}

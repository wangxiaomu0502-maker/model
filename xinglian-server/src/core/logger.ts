type LogLevel = "info" | "warn" | "error";

export function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context
  };
  // Keep logs machine-readable for future log pipeline.
  console.log(JSON.stringify(payload));
}

export class AIProviderError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly retryAfterMs: number | null;

  constructor({
    message,
    code,
    status = null,
    retryAfterMs = null,
  }: {
    message: string;
    code: string;
    status?: number | null;
    retryAfterMs?: number | null;
  }) {
    super(message);
    this.name =
      "AIProviderError";
    this.code = code;
    this.status = status;
    this.retryAfterMs =
      retryAfterMs;
  }
}

export function isAIProviderError(
  value: unknown,
): value is AIProviderError {
  return (
    value instanceof
    AIProviderError
  );
}

export function safeErrorMessage(
  value: unknown,
  fallback: string,
) {
  if (
    value instanceof Error &&
    value.message.trim()
  ) {
    return value.message;
  }

  return fallback;
}

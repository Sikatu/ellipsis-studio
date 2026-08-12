import {
  AIProviderError,
} from "@/lib/ai/provider-errors";

export function parseRetryAfterMs(
  value: string | null,
) {
  if (!value) {
    return null;
  }

  const seconds =
    Number(value);

  if (
    Number.isFinite(seconds) &&
    seconds >= 0
  ) {
    return Math.round(
      seconds * 1000,
    );
  }

  const date =
    Date.parse(value);

  if (
    Number.isNaN(date)
  ) {
    return null;
  }

  return Math.max(
    0,
    date - Date.now(),
  );
}

export async function fetchWithTimeout(
  input:
    | string
    | URL,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => {
        controller.abort();
      },
      timeoutMs,
    );

  try {
    return await fetch(
      input,
      {
        ...init,
        signal:
          controller.signal,
        cache: "no-store",
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.name ===
        "AbortError"
    ) {
      throw new AIProviderError({
        message:
          "AI provider request timed out.",
        code:
          "provider_timeout",
      });
    }

    throw new AIProviderError({
      message:
        "AI provider could not be reached.",
      code:
        "provider_network_error",
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function parseResponseBody(
  response: Response,
) {
  const text =
    await response.text();

  if (!text) {
    return {
      text: "",
      json: null as unknown,
    };
  }

  try {
    return {
      text,
      json:
        JSON.parse(text) as
          unknown,
    };
  } catch {
    return {
      text,
      json: null as unknown,
    };
  }
}

function readNestedMessage(
  value: unknown,
) {
  if (
    typeof value !==
      "object" ||
    value === null
  ) {
    return null;
  }

  const record =
    value as Record<
      string,
      unknown
    >;

  if (
    typeof record.message ===
    "string"
  ) {
    return record.message;
  }

  const error =
    record.error;

  if (
    typeof error ===
      "object" &&
    error !== null
  ) {
    const errorRecord =
      error as Record<
        string,
        unknown
      >;

    if (
      typeof errorRecord.message ===
      "string"
    ) {
      return errorRecord.message;
    }
  }

  return null;
}

export async function providerHttpError(
  response: Response,
  providerLabel: string,
) {
  const body =
    await parseResponseBody(
      response,
    );

  const providerMessage =
    readNestedMessage(
      body.json,
    );

  const retryAfterMs =
    parseRetryAfterMs(
      response.headers.get(
        "retry-after",
      ),
    );

  return new AIProviderError({
    message:
      providerMessage
        ? `${providerLabel}: ${providerMessage}`
        : `${providerLabel} returned HTTP ${response.status}.`,

    code:
      response.status === 429
        ? "provider_rate_limited"
        : response.status >= 500
          ? "provider_unavailable"
          : "provider_request_rejected",

    status:
      response.status,

    retryAfterMs,
  });
}

export function finiteInteger(
  value: unknown,
) {
  return (
    typeof value ===
      "number" &&
    Number.isFinite(value)
      ? Math.trunc(value)
      : null
  );
}

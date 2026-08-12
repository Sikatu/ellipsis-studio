import {
  getAIProviderRuntimeConfigs,
  publicProviderStatus,
} from "@/lib/ai/provider-config";

import {
  isAIProviderError,
} from "@/lib/ai/provider-errors";

import type {
  AIPrivacyMode,
  AIProviderAttempt,
  AIProviderGeneration,
  AIProviderId,
  AIProviderStatus,
  AIRouterResult,
  AIStrategyGenerationRequest,
} from "@/lib/ai/provider-types";

import {
  generateWithGemini,
} from "@/lib/ai/providers/gemini";

import {
  generateWithGroq,
} from "@/lib/ai/providers/groq";

import {
  generateWithOllama,
} from "@/lib/ai/providers/ollama";

import {
  generateWithOpenAI,
} from "@/lib/ai/providers/openai";

import {
  generateWithOpenRouter,
} from "@/lib/ai/providers/openrouter";

const providerCooldowns =
  new Map<
    AIProviderId,
    number
  >();

const DEFAULT_COOLDOWN_MS =
  30_000;

export class AIRouterExhaustedError extends Error {
  readonly attempts:
    AIProviderAttempt[];

  constructor(
    attempts:
      AIProviderAttempt[],
  ) {
    super(
      attempts.length > 0
        ? "All eligible AI providers failed. Review the latest provider attempts or retry after cooldown."
        : "No eligible AI provider is configured for the selected privacy mode.",
    );

    this.name =
      "AIRouterExhaustedError";

    this.attempts =
      attempts;
  }
}

function cooldownUntil(
  provider:
    AIProviderId,
) {
  const value =
    providerCooldowns.get(
      provider,
    );

  if (!value) {
    return null;
  }

  if (
    value <= Date.now()
  ) {
    providerCooldowns.delete(
      provider,
    );

    return null;
  }

  return value;
}

function setCooldown(
  provider:
    AIProviderId,
  retryAfterMs:
    number | null,
) {
  const requestedDuration =
    retryAfterMs !== null
      ? Math.max(
          1_000,
          retryAfterMs,
        )
      : DEFAULT_COOLDOWN_MS;

  const duration =
    Math.min(
      requestedDuration,
      15 * 60_000,
    );

  providerCooldowns.set(
    provider,
    Date.now() +
      duration,
  );
}

function shouldCooldown(
  status: number | null,
  code: string | null,
) {
  return (
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    code ===
      "provider_timeout" ||
    code ===
      "provider_network_error" ||
    code ===
      "provider_unavailable" ||
    code ===
      "provider_rate_limited"
  );
}
function safeAttemptErrorMessage(
  providerLabel: string,
  code: string,
  status: number | null,
) {
  switch (code) {
    case "provider_rate_limited":
      return `${providerLabel} rate limit reached.`;

    case "provider_timeout":
      return `${providerLabel} request timed out.`;

    case "provider_network_error":
      return `${providerLabel} could not be reached.`;

    case "provider_unavailable":
      return `${providerLabel} was temporarily unavailable.`;

    case "provider_invalid_output":
      return `${providerLabel} returned output that did not pass ELLIPSIS validation.`;

    case "provider_request_rejected":
      return status !== null
        ? `${providerLabel} rejected the request with HTTP ${status}.`
        : `${providerLabel} rejected the request.`;

    default:
      return `${providerLabel} strategy generation failed.`;
  }
}

async function runProvider(
  config: ReturnType<
    typeof getAIProviderRuntimeConfigs
  >[number],
  request:
    AIStrategyGenerationRequest,
): Promise<AIProviderGeneration> {
  switch (config.id) {
    case "groq":
      return generateWithGroq(
        config,
        request,
      );

    case "openrouter":
      return generateWithOpenRouter(
        config,
        request,
      );

    case "ollama":
      return generateWithOllama(
        config,
        request,
      );

    case "gemini":
      return generateWithGemini(
        config,
        request,
      );

    case "openai":
      return generateWithOpenAI(
        config,
        request,
      );
  }
}

export function getAIProviderStatuses(
  privacyMode:
    AIPrivacyMode,
): AIProviderStatus[] {
  return getAIProviderRuntimeConfigs(
    privacyMode,
  ).map(
    (config) => {
      const until =
        cooldownUntil(
          config.id,
        );

      return publicProviderStatus(
        {
          ...config,
          eligible:
            config.automatic &&
            config.eligible &&
            until === null,
          reason:
            until !== null
              ? "Provider is cooling down after a transient failure."
              : config.reason,
        },
        until !== null
          ? new Date(
              until,
            ).toISOString()
          : null,
      );
    },
  );
}

export async function generateStrategyWithFailover(
  request:
    AIStrategyGenerationRequest,
): Promise<AIRouterResult> {
  const started =
    Date.now();

  const attempts:
    AIProviderAttempt[] =
    [];

  const configs =
    getAIProviderRuntimeConfigs(
      request.privacyMode,
    );

  for (
    const config of configs
  ) {
    if (
      !config.configured ||
      !config.eligible ||
      !config.automatic
    ) {
      continue;
    }

    const activeCooldown =
      cooldownUntil(
        config.id,
      );

    if (
      activeCooldown !==
      null
    ) {
      continue;
    }

    const attemptStarted =
      Date.now();

    const startedAt =
      new Date(
        attemptStarted,
      ).toISOString();

    try {
      const result =
        await runProvider(
          config,
          request,
        );

      attempts.push({
        provider:
          config.id,
        status:
          "completed",
        requestedModel:
          config.model,
        actualModel:
          result.actualModel,
        startedAt,
        latencyMs:
          Date.now() -
          attemptStarted,
        httpStatus: 200,
        errorCode: null,
        errorMessage: null,
        retryAfterMs: null,
      });

      return {
        ...result,
        attempts,
        privacyMode:
          request.privacyMode,
        totalLatencyMs:
          Date.now() -
          started,
      };
    } catch (error) {
      const providerError =
        isAIProviderError(
          error,
        )
          ? error
          : null;

      const status =
        providerError
          ?.status ??
        null;

      const code =
        providerError
          ?.code ??
        "provider_invalid_output";

      const retryAfterMs =
        providerError
          ?.retryAfterMs ??
        null;

      const message =
        safeAttemptErrorMessage(
          config.label,
          code,
          status,
        );

      attempts.push({
        provider:
          config.id,
        status: "failed",
        requestedModel:
          config.model,
        actualModel: null,
        startedAt,
        latencyMs:
          Date.now() -
          attemptStarted,
        httpStatus:
          status,
        errorCode:
          code,
        errorMessage:
          message,
        retryAfterMs,
      });

      if (
        shouldCooldown(
          status,
          code,
        )
      ) {
        setCooldown(
          config.id,
          retryAfterMs,
        );
      }
    }
  }

  throw new AIRouterExhaustedError(
    attempts,
  );
}

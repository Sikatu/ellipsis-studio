import {
  AI_STRATEGY_SCHEMA,
  parseAIStrategyOutput,
} from "@/lib/ai-strategy";

import type {
  AIStrategyGenerationRequest,
  AIProviderGeneration,
} from "@/lib/ai/provider-types";

import type {
  AIProviderRuntimeConfig,
} from "@/lib/ai/provider-config";

import {
  fetchWithTimeout,
  finiteInteger,
  parseResponseBody,
  providerHttpError,
} from "@/lib/ai/shared";

type GroqResponse = {
  id?: unknown;
  model?: unknown;
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
  };
};

export async function generateWithGroq(
  config: AIProviderRuntimeConfig,
  request: AIStrategyGenerationRequest,
): Promise<AIProviderGeneration> {
  if (
    !config.apiKey ||
    !config.baseUrl
  ) {
    throw new Error(
      "Groq is not configured.",
    );
  }

  const started =
    Date.now();

  const response =
    await fetchWithTimeout(
      `${config.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${config.apiKey}`,
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify({
            model:
              config.model,
            messages: [
              {
                role: "system",
                content:
                  request.instructions,
              },
              {
                role: "user",
                content:
                  request.input,
              },
            ],
            response_format: {
              type:
                "json_schema",
              json_schema: {
                name:
                  "ellipsis_brand_strategy",
                strict: true,
                schema:
                  AI_STRATEGY_SCHEMA,
              },
            },
            stream: false,
          }),
      },
      config.timeoutMs,
    );

  if (!response.ok) {
    throw await providerHttpError(
      response,
      "Groq",
    );
  }

  const body =
    await parseResponseBody(
      response,
    );

  const payload =
    body.json as
      | GroqResponse
      | null;

  const content =
    payload?.choices?.[0]
      ?.message?.content;

  if (
    typeof content !==
      "string" ||
    !content.trim()
  ) {
    throw new Error(
      "Groq returned an empty strategy response.",
    );
  }

  const output =
    parseAIStrategyOutput(
      content,
    );

  return {
    provider: "groq",
    requestedModel:
      config.model,
    actualModel:
      typeof payload?.model ===
      "string"
        ? payload.model
        : config.model,
    requestId:
      typeof payload?.id ===
      "string"
        ? payload.id
        : null,
    output,
    usage: {
      inputTokens:
        finiteInteger(
          payload?.usage
            ?.prompt_tokens,
        ),
      outputTokens:
        finiteInteger(
          payload?.usage
            ?.completion_tokens,
        ),
      totalTokens:
        finiteInteger(
          payload?.usage
            ?.total_tokens,
        ),
    },
    latencyMs:
      Date.now() -
      started,
  };
}

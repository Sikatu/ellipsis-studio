import OpenAI from "openai";

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
  AIProviderError,
} from "@/lib/ai/provider-errors";

export async function generateWithOpenAI(
  config: AIProviderRuntimeConfig,
  request: AIStrategyGenerationRequest,
): Promise<AIProviderGeneration> {
  if (!config.apiKey) {
    throw new Error(
      "OpenAI is not configured.",
    );
  }

  const started =
    Date.now();

  const client =
    new OpenAI({
      apiKey:
        config.apiKey,
      timeout:
        config.timeoutMs,
      maxRetries: 0,
    });

  try {
    const response =
      await client.responses.create({
        model:
          config.model,

        store: false,

        instructions:
          request.instructions,

        input:
          request.input,

        text: {
          format: {
            type:
              "json_schema",

            name:
              "ellipsis_brand_strategy",

            strict: true,

            schema:
              AI_STRATEGY_SCHEMA,
          },
        },
      });

    if (
      !response.output_text
    ) {
      throw new AIProviderError({
        message:
          "OpenAI returned an empty strategy response.",
        code:
          "provider_empty_response",
      });
    }

    return {
      provider: "openai",
      requestedModel:
        config.model,
      actualModel:
        config.model,
      requestId:
        response.id,
      output:
        parseAIStrategyOutput(
          response.output_text,
        ),
      usage: {
        inputTokens:
          response.usage
            ?.input_tokens ??
          null,
        outputTokens:
          response.usage
            ?.output_tokens ??
          null,
        totalTokens:
          response.usage
            ?.total_tokens ??
          null,
      },
      latencyMs:
        Date.now() -
        started,
    };
  } catch (error) {
    if (
      error instanceof
      AIProviderError
    ) {
      throw error;
    }

    const status =
      typeof (
        error as {
          status?: unknown;
        }
      )?.status ===
      "number"
        ? (
            error as {
              status: number;
            }
          ).status
        : null;

    throw new AIProviderError({
      message:
        error instanceof Error
          ? `OpenAI: ${error.message}`
          : "OpenAI request failed.",

      code:
        status === 429
          ? "provider_rate_limited"
          : status !== null &&
              status >= 500
            ? "provider_unavailable"
            : "provider_request_rejected",

      status,
    });
  }
}

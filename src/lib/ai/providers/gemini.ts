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

type GeminiResponse = {
  responseId?: unknown;
  modelVersion?: unknown;
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: unknown;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: unknown;
    candidatesTokenCount?: unknown;
    totalTokenCount?: unknown;
  };
};

export async function generateWithGemini(
  config: AIProviderRuntimeConfig,
  request: AIStrategyGenerationRequest,
): Promise<AIProviderGeneration> {
  if (
    !config.apiKey ||
    !config.baseUrl
  ) {
    throw new Error(
      "Gemini is not configured.",
    );
  }

  const started =
    Date.now();

  const model =
    config.model.replace(
      /^models\//,
      "",
    );

  const response =
    await fetchWithTimeout(
      `${config.baseUrl}/models/${encodeURIComponent(
        model,
      )}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          "x-goog-api-key":
            config.apiKey,
        },
        body:
          JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text:
                    request.instructions,
                },
              ],
            },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text:
                      request.input,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType:
                "application/json",
              responseJsonSchema:
                AI_STRATEGY_SCHEMA,
            },
          }),
      },
      config.timeoutMs,
    );

  if (!response.ok) {
    throw await providerHttpError(
      response,
      "Gemini",
    );
  }

  const body =
    await parseResponseBody(
      response,
    );

  const payload =
    body.json as
      | GeminiResponse
      | null;

  const content =
    payload?.candidates?.[0]
      ?.content?.parts
      ?.map(
        (part) =>
          typeof part.text ===
          "string"
            ? part.text
            : "",
      )
      .join("")
      .trim() ||
    "";

  if (!content) {
    throw new Error(
      "Gemini returned an empty strategy response.",
    );
  }

  return {
    provider: "gemini",
    requestedModel:
      config.model,
    actualModel:
      typeof payload
        ?.modelVersion ===
      "string"
        ? payload.modelVersion
        : config.model,
    requestId:
      typeof payload
        ?.responseId ===
      "string"
        ? payload.responseId
        : null,
    output:
      parseAIStrategyOutput(
        content,
      ),
    usage: {
      inputTokens:
        finiteInteger(
          payload
            ?.usageMetadata
            ?.promptTokenCount,
        ),
      outputTokens:
        finiteInteger(
          payload
            ?.usageMetadata
            ?.candidatesTokenCount,
        ),
      totalTokens:
        finiteInteger(
          payload
            ?.usageMetadata
            ?.totalTokenCount,
        ),
    },
    latencyMs:
      Date.now() -
      started,
  };
}

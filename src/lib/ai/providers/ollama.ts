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

type OllamaResponse = {
  model?: unknown;
  message?: {
    content?: unknown;
  };
  prompt_eval_count?: unknown;
  eval_count?: unknown;
};

export async function generateWithOllama(
  config: AIProviderRuntimeConfig,
  request: AIStrategyGenerationRequest,
): Promise<AIProviderGeneration> {
  if (!config.baseUrl) {
    throw new Error(
      "Ollama is not configured.",
    );
  }

  const started =
    Date.now();

  const baseUrl =
    config.baseUrl.replace(
      /\/+$/,
      "",
    );

  const response =
    await fetchWithTimeout(
      `${baseUrl}/api/chat`,
      {
        method: "POST",
        headers: {
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
                  `${request.instructions}

Return only JSON that matches the response schema supplied by the caller. Do not add Markdown, commentary, or any text outside the JSON object.`,
              },
              {
                role: "user",
                content:
                  request.input,
              },
            ],
            format:
              AI_STRATEGY_SCHEMA,
            stream: false,
            think: false,
            options: {
              temperature: 0,
              num_ctx: 8192,
              num_predict: 2500,
            },
          }),
      },
      config.timeoutMs,
    );

  if (!response.ok) {
    throw await providerHttpError(
      response,
      "Ollama",
    );
  }

  const body =
    await parseResponseBody(
      response,
    );

  const payload =
    body.json as
      | OllamaResponse
      | null;

  const content =
    payload?.message
      ?.content;

  if (
    typeof content !==
      "string" ||
    !content.trim()
  ) {
    throw new Error(
      "Ollama returned an empty strategy response.",
    );
  }

  const inputTokens =
    finiteInteger(
      payload
        ?.prompt_eval_count,
    );

  const outputTokens =
    finiteInteger(
      payload?.eval_count,
    );

  let output;

  try {
    output =
      parseAIStrategyOutput(
        content,
      );
  } catch (error) {
    if (
      process.env.NODE_ENV !==
      "production"
    ) {
      let jsonParseSucceeded =
        false;

      let topLevelKeys:
        string[] = [];

      try {
        const parsed =
          JSON.parse(content);

        jsonParseSucceeded =
          true;

        if (
          parsed &&
          typeof parsed ===
            "object" &&
          !Array.isArray(parsed)
        ) {
          topLevelKeys =
            Object.keys(
              parsed,
            ).sort();
        }
      } catch {
        jsonParseSucceeded =
          false;
      }

      const validationMessage =
        error instanceof Error
          ? error.message
              .replace(
                /\s+/g,
                " ",
              )
              .slice(
                0,
                300,
              )
          : "Unknown validation failure.";

      console.error(
        "[ELLIPSIS][Ollama] strategy validation failed",
        {
          validationMessage,
          jsonParseSucceeded,
          topLevelKeys,
          contentLength:
            content.length,
          inputTokens,
          outputTokens,
        },
      );
    }

    throw error;
  }

  return {
    provider: "ollama",
    requestedModel:
      config.model,
    actualModel:
      typeof payload?.model ===
      "string"
        ? payload.model
        : config.model,
    requestId: null,
    output,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens:
        inputTokens !== null &&
        outputTokens !== null
          ? inputTokens +
            outputTokens
          : null,
    },
    latencyMs:
      Date.now() -
      started,
  };
}

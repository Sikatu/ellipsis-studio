import {
  AI_STRATEGIST_DEFAULT_MODEL,
} from "@/lib/ai-strategy";

import type {
  AIPrivacyMode,
  AIProviderCostClass,
  AIProviderId,
  AIProviderPrivacyClass,
  AIProviderRoutingRole,
  AIProviderStatus,
} from "@/lib/ai/provider-types";

const DEFAULT_GROQ_MODEL =
  "openai/gpt-oss-120b";

const DEFAULT_OPENROUTER_MODEL =
  "openrouter/free";

const DEFAULT_GEMINI_MODEL =
  "gemini-3.6-flash";

const DEFAULT_OLLAMA_MODEL =
  "gpt-oss:20b";

const DEFAULT_OLLAMA_BASE_URL =
  "http://127.0.0.1:11434";

const DEFAULT_CLOUD_TIMEOUT_MS =
  90_000;

const DEFAULT_OLLAMA_TIMEOUT_MS =
  180_000;

export type AIProviderRuntimeConfig = {
  id: AIProviderId;
  label: string;
  configured: boolean;
  eligible: boolean;
  model: string;
  costClass: AIProviderCostClass;
  privacyClass: AIProviderPrivacyClass;
  routingRole: AIProviderRoutingRole;
  automatic: boolean;
  priority: number;
  reason: string | null;
  apiKey: string | null;
  baseUrl: string | null;
  timeoutMs: number;
};

function enabled(
  name: string,
) {
  return (
    process.env[
      name
    ]?.trim().toLowerCase() ===
    "true"
  );
}

function boundedTimeout(
  value: string | undefined,
  fallback: number,
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
    return fallback;
  }

  return Math.min(
    300_000,
    Math.max(
      10_000,
      Math.round(parsed),
    ),
  );
}

export function normalizeAIPrivacyMode(
  value: unknown,
): AIPrivacyMode {
  if (
    value ===
    "maximum_availability"
  ) {
    return "maximum_availability";
  }

  return "strict";
}

export function defaultAIPrivacyMode() {
  return normalizeAIPrivacyMode(
    process.env
      .ELLIPSIS_AI_PRIVACY_MODE,
  );
}

export function getAIProviderRuntimeConfigs(
  privacyMode:
    AIPrivacyMode,
): AIProviderRuntimeConfig[] {
  const cloudTimeout =
    boundedTimeout(
      process.env
        .ELLIPSIS_AI_TIMEOUT_MS,
      DEFAULT_CLOUD_TIMEOUT_MS,
    );

  const ollamaTimeout =
    boundedTimeout(
      process.env
        .ELLIPSIS_OLLAMA_TIMEOUT_MS,
      DEFAULT_OLLAMA_TIMEOUT_MS,
    );

  const groqKey =
    process.env
      .GROQ_API_KEY
      ?.trim() ||
    null;

  const openRouterKey =
    process.env
      .OPENROUTER_API_KEY
      ?.trim() ||
    null;

  const geminiKey =
    process.env
      .GEMINI_API_KEY
      ?.trim() ||
    null;

  const openAIKey =
    process.env
      .OPENAI_API_KEY
      ?.trim() ||
    null;

  const ollamaEnabled =
    enabled(
      "ELLIPSIS_OLLAMA_ENABLED",
    );

  const allowGemini =
    enabled(
      "ELLIPSIS_AI_ALLOW_GEMINI",
    );

  const allowOpenRouter =
    enabled(
      "ELLIPSIS_AI_ALLOW_OPENROUTER",
    );

  const allowPaid =
    enabled(
      "ELLIPSIS_AI_ALLOW_PAID",
    );

  const groqZdrConfirmed =
    enabled(
      "ELLIPSIS_GROQ_ZDR_CONFIRMED",
    );

  const openAIZdrConfirmed =
    enabled(
      "ELLIPSIS_OPENAI_ZDR_CONFIRMED",
    );

  const configs:
    AIProviderRuntimeConfig[] =
    [
      {
        id: "groq",
        label: "Groq",
        configured:
          Boolean(groqKey),
        eligible:
          Boolean(
            groqKey &&
              (
                privacyMode ===
                  "maximum_availability" ||
                groqZdrConfirmed
              ),
          ),
        model:
          process.env
            .GROQ_STRATEGIST_MODEL
            ?.trim() ||
          DEFAULT_GROQ_MODEL,
        costClass: "free",
        privacyClass:
          "zdr-capable",
        routingRole:
          "primary",
        automatic: true,
        priority: 1,
        reason:
          !groqKey
            ? "GROQ_API_KEY is not configured."
            : privacyMode ===
                  "strict" &&
                !groqZdrConfirmed
              ? "Strict mode requires Groq ZDR confirmation in server settings."
              : null,
        apiKey: groqKey,
        baseUrl:
          "https://api.groq.com/openai/v1",
        timeoutMs:
          cloudTimeout,
      },

      {
        id: "openrouter",
        label: "OpenRouter",
        configured:
          Boolean(
            openRouterKey,
          ),
        eligible:
          Boolean(
            openRouterKey &&
              allowOpenRouter &&
              privacyMode ===
                "maximum_availability",
          ),
        model:
          process.env
            .OPENROUTER_STRATEGIST_MODEL
            ?.trim() ||
          DEFAULT_OPENROUTER_MODEL,
        costClass: "free",
        privacyClass:
          "policy-filtered",
        routingRole:
          "fallback",
        automatic: true,
        priority: 2,
        reason:
          !openRouterKey
            ? "OPENROUTER_API_KEY is not configured."
            : !allowOpenRouter
              ? "OpenRouter maximum-availability routing requires explicit server opt-in."
              : privacyMode !==
                  "maximum_availability"
                ? "OpenRouter free routing is excluded by strict client privacy mode."
                : null,
        apiKey:
          openRouterKey,
        baseUrl:
          "https://openrouter.ai/api/v1",
        timeoutMs:
          cloudTimeout,
      },

      {
        id: "ollama",
        label: "Ollama",
        configured:
          ollamaEnabled,
        eligible:
          false,
        model:
          process.env
            .OLLAMA_STRATEGIST_MODEL
            ?.trim() ||
          DEFAULT_OLLAMA_MODEL,
        costClass: "local",
        privacyClass: "local",
        routingRole:
          "experimental",
        automatic: false,
        priority: 3,
        reason:
          ollamaEnabled
            ? "Local Ollama is available for manual testing but excluded from automatic client-facing routing."
            : "Local Ollama is disabled.",
        apiKey: null,
        baseUrl:
          process.env
            .OLLAMA_BASE_URL
            ?.trim() ||
          DEFAULT_OLLAMA_BASE_URL,
        timeoutMs:
          ollamaTimeout,
      },

      {
        id: "gemini",
        label: "Gemini",
        configured:
          Boolean(geminiKey),
        eligible:
          Boolean(
            geminiKey &&
              allowGemini &&
              privacyMode ===
                "maximum_availability",
          ),
        model:
          process.env
            .GEMINI_STRATEGIST_MODEL
            ?.trim() ||
          DEFAULT_GEMINI_MODEL,
        costClass: "free",
        privacyClass:
          "restricted",
        routingRole:
          "fallback",
        automatic: true,
        priority: 4,
        reason:
          !geminiKey
            ? "GEMINI_API_KEY is not configured."
            : !allowGemini
              ? "Gemini client-data use requires explicit server opt-in."
              : privacyMode !==
                  "maximum_availability"
                ? "Gemini is excluded by strict client privacy mode."
                : null,
        apiKey: geminiKey,
        baseUrl:
          "https://generativelanguage.googleapis.com/v1beta",
        timeoutMs:
          cloudTimeout,
      },

      {
        id: "openai",
        label: "OpenAI",
        configured:
          Boolean(openAIKey),
        eligible:
          Boolean(
            openAIKey &&
              allowPaid &&
              (
                privacyMode ===
                  "maximum_availability" ||
                openAIZdrConfirmed
              ),
          ),
        model:
          process.env
            .OPENAI_STRATEGIST_MODEL
            ?.trim() ||
          AI_STRATEGIST_DEFAULT_MODEL,
        costClass: "paid",
        privacyClass:
          "paid-api",
        routingRole:
          "fallback",
        automatic: true,
        priority: 5,
        reason:
          !openAIKey
            ? "OPENAI_API_KEY is not configured."
            : !allowPaid
              ? "Paid AI providers are disabled."
              : privacyMode ===
                    "strict" &&
                  !openAIZdrConfirmed
                ? "Strict mode requires OpenAI ZDR confirmation in server settings."
                : null,
        apiKey: openAIKey,
        baseUrl: null,
        timeoutMs:
          cloudTimeout,
      },
    ];

  return configs;
}

export function publicProviderStatus(
  config:
    AIProviderRuntimeConfig,
  cooldownUntil:
    string | null = null,
): AIProviderStatus {
  return {
    id: config.id,
    label:
      config.label,
    configured:
      config.configured,
    eligible:
      config.eligible,
    model:
      config.model,
    costClass:
      config.costClass,
    privacyClass:
      config.privacyClass,
    routingRole:
      config.routingRole,
    automatic:
      config.automatic,
    priority:
      config.priority,
    reason:
      config.reason,
    cooldownUntil,
  };
}

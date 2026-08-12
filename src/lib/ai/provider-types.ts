import type {
  AIStrategyOutput,
} from "@/lib/ai-strategy";

export type AIProviderId =
  | "groq"
  | "openrouter"
  | "ollama"
  | "gemini"
  | "openai";

export type AIPrivacyMode =
  | "strict"
  | "maximum_availability";

export type AIProviderCostClass =
  | "free"
  | "local"
  | "paid";

export type AIProviderPrivacyClass =
  | "local"
  | "zdr-capable"
  | "policy-filtered"
  | "restricted"
  | "paid-api";

export type AIProviderRoutingRole =
  | "primary"
  | "fallback"
  | "experimental";

export type AIProviderStatus = {
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
  cooldownUntil: string | null;
};

export type AIProviderAttempt = {
  provider: AIProviderId;
  status:
    | "completed"
    | "failed";
  requestedModel: string;
  actualModel: string | null;
  startedAt: string;
  latencyMs: number;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryAfterMs: number | null;
};

export type AIProviderUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type AIProviderGeneration = {
  provider: AIProviderId;
  requestedModel: string;
  actualModel: string;
  requestId: string | null;
  output: AIStrategyOutput;
  usage: AIProviderUsage;
  latencyMs: number;
};

export type AIRouterResult =
  AIProviderGeneration & {
    attempts: AIProviderAttempt[];
    privacyMode: AIPrivacyMode;
    totalLatencyMs: number;
  };

export type AIStrategyGenerationRequest = {
  instructions: string;
  input: string;
  privacyMode: AIPrivacyMode;
};

"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type {
  AIStrategyOutput,
} from "@/lib/ai-strategy";

type Gate = {
  ready: boolean;
  reportReady: boolean;
  approvedCount: number;
  deliverableCount: number;
  staleCount: number;
  waitingEvidence: number;
  missingApprovals: string[];
  staleApprovals: string[];
};

type StrategyRun = {
  id: string;
  status: "completed" | "failed";
  model: string;
  prompt_version: string;
  source_fingerprint: string;
  output: AIStrategyOutput | null;
  error_message: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  created_at: string;
};

type StatusPayload = {
  configured: boolean;
  model: string;
  gate: Gate;
  sourceFingerprint: string;
  latestRun: StrategyRun | null;
  runs: StrategyRun[];
  error?: string;
};

function formatDate(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}

function StrategySection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.018] p-6">
      <p className="text-[10px] font-medium tracking-[0.15em] text-[#c5a577] uppercase">
        {label}
      </p>

      <div className="mt-4 text-sm leading-7 text-white/60">
        {children}
      </div>
    </article>
  );
}

function BulletList({
  items,
}: {
  items: string[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-white/25">
        None established.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map(
        (item) => (
          <li
            key={item}
            className="flex gap-3"
          >
            <span className="mt-[10px] h-1 w-1 shrink-0 rounded-full bg-[#c5a577]" />

            <span>
              {item}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}

export default function BrandAIStrategist({
  projectId,
}: {
  projectId: string;
}) {
  const [
    status,
    setStatus,
  ] = useState<
    StatusPayload | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    generating,
    setGenerating,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const loadStatus =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              `/api/admin/ai-strategist?projectId=${encodeURIComponent(
                projectId,
              )}`,
              {
                cache:
                  "no-store",
              },
            );

          const payload =
            (await response.json()) as
              StatusPayload;

          if (!response.ok) {
            throw new Error(
              payload.error ||
                "Could not load AI Strategist.",
            );
          }

          setStatus(payload);
          setError(null);
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load AI Strategist.",
          );
        } finally {
          setLoading(false);
        }
      },
      [projectId],
    );

  useEffect(() => {
    const initialLoadTimer =
      window.setTimeout(() => {
        void loadStatus();
      }, 0);

    function handleReviewUpdate() {
      void loadStatus();
    }

    window.addEventListener(
      "ellipsis:strategy-review-updated",
      handleReviewUpdate,
    );

    return () => {
      window.clearTimeout(
        initialLoadTimer,
      );

      window.removeEventListener(
        "ellipsis:strategy-review-updated",
        handleReviewUpdate,
      );
    };
  }, [loadStatus]);

  async function generate() {
    if (
      !status?.gate.ready ||
      !status.configured
    ) {
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/admin/ai-strategist",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                projectId,
              }),
          },
        );

      const payload =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "AI strategy generation failed.",
        );
      }

      await loadStatus();
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "AI strategy generation failed.",
      );
    } finally {
      setGenerating(false);
    }
  }

  const gate =
    status?.gate;

  const latestRun =
    status?.latestRun;

  const strategy =
    latestRun?.status ===
      "completed"
      ? latestRun.output
      : null;

  const sourceCurrent =
    Boolean(
      latestRun &&
      status &&
      latestRun
        .source_fingerprint ===
        status.sourceFingerprint,
    );

  return (
    <section
      id="ai-strategist"
      className="scroll-mt-24 border-t border-white/10 py-12 sm:py-16"
    >
      <div className="flex flex-col justify-between gap-7 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[#c5a577] uppercase">
            AI Strategist
          </p>

          <h2 className="mt-3 text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
            Approved strategy, refined.
          </h2>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/40">
            AI synthesis is permitted only after the deterministic evidence gate and studio approval gate both pass.
          </p>
        </div>

        <div
          className={`rounded-full border px-4 py-2 text-xs font-medium ${
            gate?.ready &&
            status?.configured
              ? "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100/75"
              : "border-white/10 bg-white/[0.025] text-white/35"
          }`}
        >
          {loading
            ? "Checking gate"
            : gate?.ready &&
                status?.configured
              ? "Ready to generate"
              : "Locked"}
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Studio approval
          </p>

          <p className="mt-5 text-3xl font-medium tracking-[-0.04em]">
            {gate
              ? `${gate.approvedCount}/${gate.deliverableCount}`
              : "—"}
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Evidence gate
          </p>

          <p className="mt-5 text-lg font-medium">
            {gate?.reportReady
              ? "Passed"
              : "Incomplete"}
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Stale approvals
          </p>

          <p className="mt-5 text-3xl font-medium tracking-[-0.04em]">
            {gate?.staleCount ??
              "—"}
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Model
          </p>

          <p className="mt-5 text-sm font-medium text-white/60">
            {status?.model ??
              "Not loaded"}
          </p>
        </article>
      </div>

      {!status?.configured &&
        !loading && (
          <div className="mt-5 rounded-2xl border border-[#c5a577]/20 bg-[#c5a577]/[0.05] p-5">
            <p className="text-xs font-medium text-[#ddc39c]">
              OpenAI API key required
            </p>

            <p className="mt-2 text-xs leading-6 text-white/35">
              Add OPENAI_API_KEY to the server environment before generating a strategy. Never place the secret in client-side code.
            </p>
          </div>
        )}

      {gate &&
        !gate.ready && (
          <div className="mt-5 rounded-2xl border border-white/[0.08] p-5">
            <p className="text-xs font-medium text-white/55">
              Generation requirements
            </p>

            <p className="mt-2 text-xs leading-6 text-white/30">
              The server will not call AI until the strategy is report-ready, every deliverable is approved, no evidence is waiting, and no approval is stale.
            </p>

            {gate.missingApprovals
              .length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {gate.missingApprovals.map(
                  (label) => (
                    <span
                      key={label}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-white/30"
                    >
                      {label}
                    </span>
                  ),
                )}
              </div>
            )}
          </div>
        )}

      {error && (
        <div className="mt-5 rounded-2xl border border-red-300/15 bg-red-300/[0.045] px-5 py-4 text-xs leading-6 text-red-100/70">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={
            loading ||
            generating ||
            !gate?.ready ||
            !status?.configured
          }
          onClick={() =>
            void generate()
          }
          className="rounded-xl bg-[#f5f0e6] px-5 py-3 text-xs font-semibold text-[#11110f] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          {generating
            ? "Generating strategy..."
            : latestRun
              ? "Generate new strategy version"
              : "Generate AI strategy"}
        </button>

        <button
          type="button"
          disabled={
            loading ||
            generating
          }
          onClick={() =>
            void loadStatus()
          }
          className="rounded-xl border border-white/10 px-5 py-3 text-xs text-white/40 transition hover:border-white/20 hover:text-white/65 disabled:opacity-30"
        >
          Refresh gate
        </button>
      </div>

      {latestRun && (
        <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.07] pt-5 text-[10px] text-white/25">
          <span>
            Last run:{" "}
            {formatDate(
              latestRun.created_at,
            )}
          </span>

          <span>
            {latestRun.model}
          </span>

          <span>
            {sourceCurrent
              ? "Current evidence"
              : "Older evidence version"}
          </span>

          {latestRun.total_tokens !==
            null && (
            <span>
              {
                latestRun.total_tokens
              }{" "}
              tokens
            </span>
          )}
        </div>
      )}

      {latestRun?.status ===
        "failed" && (
        <div className="mt-6 rounded-2xl border border-red-300/15 bg-red-300/[0.035] p-5">
          <p className="text-xs font-medium text-red-100/65">
            Previous generation failed
          </p>

          <p className="mt-2 text-xs leading-6 text-white/30">
            {latestRun.error_message}
          </p>
        </div>
      )}

      {strategy && (
        <div className="mt-10">
          {!sourceCurrent && (
            <div className="mb-5 rounded-2xl border border-[#c5a577]/20 bg-[#c5a577]/[0.05] p-5 text-xs leading-6 text-[#ddc39c]">
              This AI strategy was generated from an older approved evidence package. Generate a new version after the current strategy is approved.
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <StrategySection label="Executive summary">
              {strategy.executiveSummary}
            </StrategySection>

            <StrategySection label="Positioning">
              {strategy.positioning}
            </StrategySection>

            <StrategySection label="Primary audience">
              {strategy.audience}
            </StrategySection>

            <StrategySection label="Brand promise">
              {strategy.brandPromise}
            </StrategySection>

            <StrategySection label="Brand essence">
              {strategy.brandEssence}
            </StrategySection>

            <StrategySection label="Personality">
              <p>
                {
                  strategy.personality
                    .summary
                }
              </p>

              <div className="mt-4">
                <BulletList
                  items={
                    strategy.personality
                      .traits
                  }
                />
              </div>
            </StrategySection>

            <StrategySection label="Visual direction">
              <p>
                {
                  strategy.visualDirection
                    .summary
                }
              </p>

              <p className="mt-5 text-[10px] font-medium tracking-[0.14em] text-white/25 uppercase">
                Principles
              </p>

              <div className="mt-3">
                <BulletList
                  items={
                    strategy.visualDirection
                      .principles
                  }
                />
              </div>

              <p className="mt-5 text-[10px] font-medium tracking-[0.14em] text-white/25 uppercase">
                Avoid
              </p>

              <div className="mt-3">
                <BulletList
                  items={
                    strategy.visualDirection
                      .avoid
                  }
                />
              </div>
            </StrategySection>

            <StrategySection label="Voice direction">
              <p>
                {
                  strategy.voiceDirection
                    .summary
                }
              </p>

              <p className="mt-5 text-[10px] font-medium tracking-[0.14em] text-white/25 uppercase">
                Principles
              </p>

              <div className="mt-3">
                <BulletList
                  items={
                    strategy.voiceDirection
                      .principles
                  }
                />
              </div>

              <p className="mt-5 text-[10px] font-medium tracking-[0.14em] text-white/25 uppercase">
                Avoid
              </p>

              <div className="mt-3">
                <BulletList
                  items={
                    strategy.voiceDirection
                      .avoid
                  }
                />
              </div>
            </StrategySection>

            <StrategySection label="Creative guardrails">
              <BulletList
                items={
                  strategy.creativeGuardrails
                }
              />
            </StrategySection>

            <StrategySection label="Strategic risks">
              <BulletList
                items={
                  strategy.strategicRisks
                }
              />
            </StrategySection>
          </div>

          <div className="mt-3">
            <StrategySection label="Evidence caveats">
              <BulletList
                items={
                  strategy.evidenceCaveats
                }
              />
            </StrategySection>
          </div>
        </div>
      )}
    </section>
  );
}
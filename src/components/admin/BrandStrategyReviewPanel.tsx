"use client";

import { buildStrategyFingerprint } from "@/lib/strategy-review";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  StrategyDeliverable,
  StrategySynthesis,
} from "@/lib/strategy-synthesis";

type ReviewStatus =
  | "pending"
  | "approved"
  | "needs_revision"
  | "rejected";

type StrategyReviewRecord = {
  id: string;
  project_id: string;
  deliverable_id: string;
  status: ReviewStatus;
  notes: string;
  statement_snapshot: string;
  source_fingerprint: string;
  reviewed_at: string;
  updated_at: string;
};

function decisionLabel(
  status: ReviewStatus,
) {
  if (status === "approved") {
    return "Approved";
  }

  if (
    status ===
    "needs_revision"
  ) {
    return "Needs revision";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Pending";
}

function decisionClasses(
  status: ReviewStatus,
) {
  if (status === "approved") {
    return "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100/75";
  }

  if (
    status ===
    "needs_revision"
  ) {
    return "border-[#c5a577]/25 bg-[#c5a577]/[0.07] text-[#ddc39c]";
  }

  if (status === "rejected") {
    return "border-red-300/20 bg-red-300/[0.05] text-red-100/70";
  }

  return "border-white/10 bg-white/[0.025] text-white/35";
}

function synthesisLabel(
  status:
    StrategyDeliverable["status"],
) {
  if (status === "ready") {
    return "Evidence ready";
  }

  if (
    status === "developing"
  ) {
    return "Developing";
  }

  return "Waiting for evidence";
}

function formatDate(
  value: string | undefined,
) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  return date.toLocaleString();
}

export default function BrandStrategyReviewPanel({
  projectId,
  synthesis,
}: {
  projectId: string;
  synthesis: StrategySynthesis;
}) {
  const [
    reviews,
    setReviews,
  ] = useState<
    Record<
      string,
      StrategyReviewRecord
    >
  >({});

  const [
    notes,
    setNotes,
  ] = useState<
    Record<string, string>
  >({});

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    savingId,
    setSavingId,
  ] = useState<
    string | null
  >(null);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    success,
    setSuccess,
  ] = useState<
    string | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response =
          await fetch(
            `/api/admin/strategy-reviews?projectId=${encodeURIComponent(
              projectId,
            )}`,
            {
              cache: "no-store",
            },
          );

        const payload =
          (await response.json()) as {
            reviews?: StrategyReviewRecord[];
            error?: string;
          };

        if (!response.ok) {
          throw new Error(
            payload.error ||
              "Could not load strategy reviews.",
          );
        }

        if (cancelled) {
          return;
        }

        const reviewMap: Record<
          string,
          StrategyReviewRecord
        > = {};

        const noteMap: Record<
          string,
          string
        > = {};

        for (
          const review
          of payload.reviews ?? []
        ) {
          reviewMap[
            review.deliverable_id
          ] = review;

          noteMap[
            review.deliverable_id
          ] = review.notes ?? "";
        }

        setReviews(reviewMap);
        setNotes(noteMap);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load strategy reviews.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const reviewState = useMemo(
    () =>
      synthesis.deliverables.map(
        (item) => {
          const review =
            reviews[item.id];

          const currentFingerprint =
            buildStrategyFingerprint(item);

          const stale =
            Boolean(review) &&
            review.source_fingerprint !==
              currentFingerprint;

          const locked =
            item.status ===
            "insufficient";

          const effectiveStatus:
            ReviewStatus =
            locked || stale
              ? "pending"
              : review?.status ??
                "pending";

          return {
            item,
            review,
            stale,
            locked,
            effectiveStatus,
          };
        },
      ),
    [
      reviews,
      synthesis.deliverables,
    ],
  );

  const approvedCount =
    reviewState.filter(
      (entry) =>
        !entry.locked &&
        !entry.stale &&
        entry.effectiveStatus ===
          "approved",
    ).length;

  const staleCount =
    reviewState.filter(
      (entry) =>
        entry.stale,
    ).length;

  const waitingEvidence =
    reviewState.filter(
      (entry) =>
        entry.locked,
    ).length;

  const revisionCount =
    reviewState.filter(
      (entry) =>
        !entry.stale &&
        entry.effectiveStatus ===
          "needs_revision",
    ).length;

  const aiReady =
    synthesis.reportReady &&
    approvedCount ===
      synthesis.deliverableCount &&
    staleCount === 0;

  async function saveDecision(
    item: StrategyDeliverable,
    status: ReviewStatus,
  ) {
    const note =
      notes[item.id]?.trim() ??
      "";

    if (
      (
        status ===
          "needs_revision" ||
        status === "rejected"
      ) &&
      note.length < 3
    ) {
      setError(
        "Add a studio note explaining why this strategy item needs revision or is rejected.",
      );

      return;
    }

    setSavingId(item.id);
    setError(null);
    setSuccess(null);

    const currentFingerprint =
      buildStrategyFingerprint(item);

    try {
      const response =
        await fetch(
          "/api/admin/strategy-reviews",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              projectId,
              deliverableId:
                item.id,
              status,
              notes: note,
              statementSnapshot:
                item.statement,
              sourceFingerprint:
                currentFingerprint,
            }),
          },
        );

      const payload =
        (await response.json()) as {
          review?: StrategyReviewRecord;
          error?: string;
        };

      if (
        !response.ok ||
        !payload.review
      ) {
        throw new Error(
          payload.error ||
            "Could not save the review.",
        );
      }

      setReviews(
        (current) => ({
          ...current,
          [item.id]:
            payload.review as StrategyReviewRecord,
        }),
      );

      setSuccess(
        `${item.label}: ${decisionLabel(
          status,
        )}`,
      );
          window.dispatchEvent(
        new Event(
          "ellipsis:strategy-review-updated",
        ),
      );
} catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save the strategy review.",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section
      id="review"
      className="scroll-mt-24 border-t border-white/10 py-12 sm:py-16"
    >
      <div className="flex flex-col justify-between gap-7 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[#c5a577] uppercase">
            Studio Review
          </p>

          <h2 className="mt-3 text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
            Strategy approval.
          </h2>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/40">
            Approve, revise, or reject each working strategic conclusion before it becomes part of the final brand strategy.
          </p>
        </div>

        <div
          className={`rounded-full border px-4 py-2 text-xs font-medium ${
            aiReady
              ? "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100/75"
              : "border-white/10 bg-white/[0.025] text-white/35"
          }`}
        >
          {aiReady
            ? "AI strategist ready"
            : "AI strategist locked"}
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Approved
          </p>

          <p className="mt-5 text-4xl font-medium tracking-[-0.04em]">
            {approvedCount}/
            {synthesis.deliverableCount}
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Needs revision
          </p>

          <p className="mt-5 text-4xl font-medium tracking-[-0.04em]">
            {revisionCount}
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Waiting evidence
          </p>

          <p className="mt-5 text-4xl font-medium tracking-[-0.04em]">
            {waitingEvidence}
          </p>
        </article>

        <article
          className={`rounded-2xl border p-6 ${
            staleCount > 0
              ? "border-[#c5a577]/25 bg-[#c5a577]/[0.06]"
              : "border-white/10 bg-white/[0.025]"
          }`}
        >
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Re-review required
          </p>

          <p className="mt-5 text-4xl font-medium tracking-[-0.04em]">
            {staleCount}
          </p>
        </article>
      </div>

      <div className="mt-5 rounded-2xl border border-white/[0.07] p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-medium text-white/55">
              Final strategy gate
            </p>

            <p className="mt-2 text-xs leading-6 text-white/30">
              AI remains locked until the deterministic strategy is report-ready and every strategic deliverable has a current studio approval.
            </p>
          </div>

          <div className="shrink-0 text-xs text-white/35">
            {synthesis.reportReady
              ? "Evidence gate passed"
              : "Evidence gate incomplete"}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-300/15 bg-red-300/[0.045] px-5 py-4 text-xs leading-6 text-red-100/70">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045] px-5 py-4 text-xs text-emerald-100/70">
          Saved. {success}
        </div>
      )}

      {loading ? (
        <div className="mt-8 rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="text-sm text-white/35">
            Loading studio decisions...
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {reviewState.map(
            ({
              item,
              review,
              stale,
              locked,
              effectiveStatus,
            }) => {
              const isSaving =
                savingId ===
                item.id;

              return (
                <article
                  key={item.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.018] p-6 sm:p-8"
                >
                  <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                    <div>
                      <p className="text-[10px] font-medium tracking-[0.15em] text-[#c5a577] uppercase">
                        {item.category}
                      </p>

                      <h3 className="mt-3 text-xl font-medium tracking-[-0.02em]">
                        {item.label}
                      </h3>

                      <p className="mt-2 text-xs text-white/30">
                        {synthesisLabel(
                          item.status,
                        )}
                        {" / "}
                        Evidence{" "}
                        {
                          item.evidenceScore
                        }
                        %
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {stale && (
                        <span className="rounded-full border border-[#c5a577]/25 bg-[#c5a577]/[0.07] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#ddc39c]">
                          Evidence changed
                        </span>
                      )}

                      <span
                        className={`rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] ${decisionClasses(
                          effectiveStatus,
                        )}`}
                      >
                        {locked
                          ? "Locked"
                          : stale
                            ? "Re-review"
                            : decisionLabel(
                                effectiveStatus,
                              )}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-white/[0.07] pt-6">
                    <p className="text-[10px] tracking-[0.14em] text-white/25 uppercase">
                      Current working strategy
                    </p>

                    <p
                      className={`mt-3 text-sm leading-7 ${
                        locked
                          ? "text-white/30"
                          : "text-white/65"
                      }`}
                    >
                      {item.statement}
                    </p>
                  </div>

                  {stale &&
                    review && (
                      <div className="mt-5 rounded-2xl border border-[#c5a577]/15 bg-[#c5a577]/[0.035] p-5">
                        <p className="text-[10px] font-medium tracking-[0.14em] text-[#c9a777] uppercase">
                          Previous approval snapshot
                        </p>

                        <p className="mt-3 text-xs leading-6 text-white/35">
                          {
                            review.statement_snapshot
                          }
                        </p>

                        <p className="mt-3 text-[10px] text-white/20">
                          Evidence changed after this decision. The previous approval no longer counts toward final approval.
                        </p>
                      </div>
                    )}

                  <div className="mt-6">
                    <label
                      htmlFor={`review-note-${item.id}`}
                      className="text-[10px] font-medium tracking-[0.14em] text-white/25 uppercase"
                    >
                      Studio notes
                    </label>

                    <textarea
                      id={`review-note-${item.id}`}
                      value={
                        notes[item.id] ??
                        ""
                      }
                      disabled={locked}
                      onChange={(
                        event,
                      ) =>
                        setNotes(
                          (current) => ({
                            ...current,
                            [item.id]:
                              event.target.value,
                          }),
                        )
                      }
                      placeholder={
                        locked
                          ? "Complete the required discovery evidence before reviewing this strategy item."
                          : "Add rationale, changes, concerns, or creative direction for this strategy item..."
                      }
                      className="mt-3 min-h-28 w-full resize-y rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm leading-6 text-white/65 outline-none transition placeholder:text-white/20 focus:border-[#c5a577]/35 disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        locked ||
                        isSaving
                      }
                      onClick={() =>
                        void saveDecision(
                          item,
                          "approved",
                        )
                      }
                      className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.055] px-4 py-2.5 text-xs font-medium text-emerald-100/70 transition hover:bg-emerald-300/[0.09] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Approve
                    </button>

                    <button
                      type="button"
                      disabled={
                        locked ||
                        isSaving
                      }
                      onClick={() =>
                        void saveDecision(
                          item,
                          "needs_revision",
                        )
                      }
                      className="rounded-xl border border-[#c5a577]/20 bg-[#c5a577]/[0.055] px-4 py-2.5 text-xs font-medium text-[#ddc39c] transition hover:bg-[#c5a577]/[0.09] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Needs revision
                    </button>

                    <button
                      type="button"
                      disabled={
                        locked ||
                        isSaving
                      }
                      onClick={() =>
                        void saveDecision(
                          item,
                          "rejected",
                        )
                      }
                      className="rounded-xl border border-red-300/15 px-4 py-2.5 text-xs text-red-100/55 transition hover:bg-red-300/[0.05] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Reject
                    </button>

                    <button
                      type="button"
                      disabled={
                        locked ||
                        isSaving
                      }
                      onClick={() =>
                        void saveDecision(
                          item,
                          "pending",
                        )
                      }
                      className="rounded-xl border border-white/10 px-4 py-2.5 text-xs text-white/35 transition hover:border-white/20 hover:text-white/60 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Save as pending
                    </button>

                    {isSaving && (
                      <span className="self-center px-2 text-xs text-white/25">
                        Saving...
                      </span>
                    )}
                  </div>

                  {review &&
                    !stale && (
                      <p className="mt-4 text-[10px] text-white/20">
                        Last studio decision:{" "}
                        {formatDate(
                          review.reviewed_at,
                        )}
                      </p>
                    )}
                </article>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}
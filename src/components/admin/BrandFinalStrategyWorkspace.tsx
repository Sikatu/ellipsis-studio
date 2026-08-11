"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  AIStrategyOutput,
} from "@/lib/ai-strategy";

import type {
  FinalStrategyVersion,
} from "@/lib/final-strategy";

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

type FinalWorkspacePayload = {
  gate: Gate;

  currentFingerprint: string;

  latestAI: {
    id: string;
    sourceFingerprint: string;
    model: string;
    promptVersion: string;
    createdAt: string;
    current: boolean;
  } | null;

  canCreateDraft: boolean;

  draft:
    | FinalStrategyVersion
    | null;

  approved:
    FinalStrategyVersion[];

  versions:
    FinalStrategyVersion[];

  error?: string;
};

type ListFieldProps = {
  label: string;
  value: string[];
  onChange: (
    value: string[],
  ) => void;
};

const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm leading-6 text-white/70 outline-none transition placeholder:text-white/20 focus:border-[#c5a577]/40";

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "Not approved";
  }

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

function ListField({
  label,
  value,
  onChange,
}: ListFieldProps) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium tracking-[0.14em] text-white/30 uppercase">
        {label}
      </span>

      <textarea
        rows={5}
        className={inputClass}
        value={
          value.join("\n")
        }
        onChange={(event) => {
          const next =
            event.target.value
              .split("\n")
              .map(
                (item) =>
                  item.trim(),
              )
              .filter(Boolean);

          onChange(next);
        }}
      />

      <span className="mt-2 block text-[10px] leading-5 text-white/20">
        One item per line.
      </span>
    </label>
  );
}

function StrategyTextField({
  label,
  value,
  rows = 5,
  onChange,
}: {
  label: string;
  value: string;
  rows?: number;
  onChange:
    (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium tracking-[0.14em] text-white/30 uppercase">
        {label}
      </span>

      <textarea
        rows={rows}
        className={inputClass}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
      />
    </label>
  );
}

function ReadOnlyList({
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
            <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#c5a577]" />

            <span>
              {item}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}

export default function BrandFinalStrategyWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const [
    workspace,
    setWorkspace,
  ] = useState<
    FinalWorkspacePayload | null
  >(null);

  const [
    draftStrategy,
    setDraftStrategy,
  ] = useState<
    AIStrategyOutput | null
  >(null);

  const [
    editorialNotes,
    setEditorialNotes,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState<
    string | null
  >(null);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const loadWorkspace =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              `/api/admin/strategy-versions?projectId=${encodeURIComponent(
                projectId,
              )}`,
              {
                cache:
                  "no-store",
              },
            );

          const payload =
            (await response.json()) as
              FinalWorkspacePayload;

          if (!response.ok) {
            throw new Error(
              payload.error ||
                "Could not load final strategy workspace.",
            );
          }

          setWorkspace(
            payload,
          );

          if (payload.draft) {
            setDraftStrategy(
              payload.draft
                .strategy,
            );

            setEditorialNotes(
              payload.draft
                .editorial_notes,
            );
          }
          else {
            setDraftStrategy(
              null,
            );

            setEditorialNotes(
              "",
            );
          }

          setError(null);
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load final strategy workspace.",
          );
        } finally {
          setLoading(false);
        }
      },
      [projectId],
    );

  useEffect(() => {
    const initialTimer =
      window.setTimeout(
        () => {
          void loadWorkspace();
        },
        0,
      );

    return () => {
      window.clearTimeout(
        initialTimer,
      );
    };
  }, [loadWorkspace]);

  const latestApproved =
    workspace?.approved[0] ??
    null;

  const draftIsCurrent =
    Boolean(
      workspace?.draft &&
      workspace
        .currentFingerprint ===
        workspace.draft
          .source_fingerprint,
    );

  const dirty =
    useMemo(() => {
      if (
        !workspace?.draft ||
        !draftStrategy
      ) {
        return false;
      }

      return (
        JSON.stringify(
          draftStrategy,
        ) !==
          JSON.stringify(
            workspace.draft
              .strategy,
          ) ||
        editorialNotes !==
          workspace.draft
            .editorial_notes
      );
    }, [
      draftStrategy,
      editorialNotes,
      workspace,
    ]);

  async function createDraft() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/admin/strategy-versions",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "create",

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
            "Could not create final strategy draft.",
        );
      }

      await loadWorkspace();

      setMessage(
        "Final strategy draft created from the current approved AI strategy.",
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create final strategy draft.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    if (
      !workspace?.draft ||
      !draftStrategy
    ) {
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/admin/strategy-versions",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                projectId,

                versionId:
                  workspace.draft.id,

                strategy:
                  draftStrategy,

                editorialNotes,
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
            "Could not save final strategy draft.",
        );
      }

      await loadWorkspace();

      setMessage(
        "Final strategy draft saved.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save final strategy draft.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function approveDraft() {
    if (
      !workspace?.draft ||
      !draftStrategy
    ) {
      return;
    }

    if (dirty) {
      setError(
        "Save the draft before approving the final strategy.",
      );

      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/admin/strategy-versions",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "approve",

                projectId,

                versionId:
                  workspace.draft.id,
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
            "Could not approve final strategy.",
        );
      }

      await loadWorkspace();

      setMessage(
        "Final strategy approved and frozen as an immutable version.",
      );
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Could not approve final strategy.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function discardDraft() {
    if (!workspace?.draft) {
      return;
    }

    const confirmed =
      window.confirm(
        "Discard this editable final strategy draft? Approved versions will not be affected.",
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/admin/strategy-versions?projectId=${encodeURIComponent(
            projectId,
          )}&versionId=${encodeURIComponent(
            workspace.draft.id,
          )}`,
          {
            method:
              "DELETE",
          },
        );

      const payload =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Could not discard final strategy draft.",
        );
      }

      await loadWorkspace();

      setMessage(
        "Draft discarded. Approved versions were preserved.",
      );
    } catch (discardError) {
      setError(
        discardError instanceof Error
          ? discardError.message
          : "Could not discard final strategy draft.",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateRoot(
    key:
      | "executiveSummary"
      | "positioning"
      | "audience"
      | "brandPromise"
      | "brandEssence",
    value: string,
  ) {
    setDraftStrategy(
      (current) =>
        current
          ? {
              ...current,
              [key]:
                value,
            }
          : current,
    );
  }

  if (loading) {
    return (
      <section
        id="final-strategy"
        className="scroll-mt-24 border-t border-white/10 py-12 sm:py-16"
      >
        <p className="text-sm text-white/30">
          Loading final strategy workspace...
        </p>
      </section>
    );
  }

  return (
    <section
      id="final-strategy"
      className="scroll-mt-24 border-t border-white/10 py-12 sm:py-16"
    >
      <div className="flex flex-col justify-between gap-7 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[#c5a577] uppercase">
            Final Strategy
          </p>

          <h2 className="mt-3 text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
            Studio-approved truth.
          </h2>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/40">
            Refine the current evidence-grounded AI strategy, approve it as the studio source of truth, and preserve every approved version permanently.
          </p>
        </div>

        <div
          className={`rounded-full border px-4 py-2 text-xs font-medium ${
            latestApproved
              ? "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100/75"
              : workspace
                    ?.canCreateDraft
                ? "border-[#c5a577]/25 bg-[#c5a577]/[0.05] text-[#ddc39c]"
                : "border-white/10 bg-white/[0.025] text-white/35"
          }`}
        >
          {latestApproved
            ? `Approved v${latestApproved.version_number}`
            : workspace
                  ?.canCreateDraft
              ? "Ready for studio edit"
              : "Locked"}
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Approved versions
          </p>

          <p className="mt-5 text-3xl font-medium tracking-[-0.04em]">
            {workspace
              ?.approved.length ??
              0}
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Current draft
          </p>

          <p className="mt-5 text-lg font-medium">
            {workspace?.draft
              ? `v${workspace.draft.version_number}`
              : "None"}
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            AI source
          </p>

          <p className="mt-5 text-sm font-medium text-white/60">
            {workspace?.latestAI
              ? workspace.latestAI.current
                ? "Current"
                : "Outdated"
              : "Not generated"}
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Evidence gate
          </p>

          <p className="mt-5 text-sm font-medium text-white/60">
            {workspace
              ?.gate.ready
              ? "Passed"
              : "Incomplete"}
          </p>
        </article>
      </div>

      {message && (
        <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] px-5 py-4 text-xs leading-6 text-emerald-100/70">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-2xl border border-red-300/15 bg-red-300/[0.04] px-5 py-4 text-xs leading-6 text-red-100/70">
          {error}
        </div>
      )}

      {!workspace?.draft &&
        !workspace?.canCreateDraft && (
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
            <p className="text-xs font-medium text-white/60">
              Final strategy creation is gated.
            </p>

            <p className="mt-3 max-w-3xl text-xs leading-6 text-white/30">
              Complete the evidence and studio approval gates, then generate a current AI strategy. Only that approved evidence package can become an editable final strategy draft.
            </p>

            {!workspace?.latestAI && (
              <p className="mt-4 text-xs text-[#c5a577]/70">
                No completed AI strategy exists yet.
              </p>
            )}

            {workspace?.latestAI &&
              !workspace
                .latestAI.current && (
                <p className="mt-4 text-xs text-[#c5a577]/70">
                  The latest AI strategy was generated from older evidence and must be regenerated.
                </p>
              )}
          </div>
        )}

      {!workspace?.draft &&
        workspace?.canCreateDraft && (
          <div className="mt-6 rounded-2xl border border-[#c5a577]/20 bg-[#c5a577]/[0.04] p-6">
            <p className="text-xs font-medium text-[#ddc39c]">
              Current AI strategy is ready for studio refinement.
            </p>

            <p className="mt-3 max-w-3xl text-xs leading-6 text-white/35">
              Creating the draft copies the current AI strategy into an editable studio layer. The AI run remains unchanged.
            </p>

            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void createDraft()
              }
              className="mt-5 rounded-xl bg-[#f5f0e6] px-5 py-3 text-xs font-semibold text-[#11110f] transition hover:bg-white disabled:opacity-30"
            >
              Create final strategy draft
            </button>
          </div>
        )}

      {workspace?.draft &&
        draftStrategy && (
          <div className="mt-8">
            <div className="flex flex-col justify-between gap-5 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:flex-row sm:items-center">
              <div>
                <p className="text-[10px] tracking-[0.15em] text-[#c5a577] uppercase">
                  Editorial draft
                </p>

                <p className="mt-2 text-xl font-medium">
                  Version {
                    workspace
                      .draft
                      .version_number
                  }
                </p>

                <p className="mt-2 text-xs text-white/25">
                  {
                    workspace
                      .draft
                      .source_model
                  }{" "}
                  ·{" "}
                  {draftIsCurrent
                    ? "Current evidence"
                    : "Older evidence"}
                </p>
              </div>

              <div
                className={`rounded-full border px-3 py-1.5 text-[10px] ${
                  draftIsCurrent
                    ? "border-emerald-300/20 text-emerald-100/65"
                    : "border-[#c5a577]/20 text-[#ddc39c]"
                }`}
              >
                {draftIsCurrent
                  ? "Source current"
                  : "Re-generation required"}
              </div>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <article className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
                <StrategyTextField
                  label="Executive summary"
                  value={
                    draftStrategy
                      .executiveSummary
                  }
                  onChange={(value) =>
                    updateRoot(
                      "executiveSummary",
                      value,
                    )
                  }
                />
              </article>

              <article className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
                <StrategyTextField
                  label="Positioning"
                  value={
                    draftStrategy
                      .positioning
                  }
                  onChange={(value) =>
                    updateRoot(
                      "positioning",
                      value,
                    )
                  }
                />
              </article>

              <article className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
                <StrategyTextField
                  label="Primary audience"
                  value={
                    draftStrategy
                      .audience
                  }
                  onChange={(value) =>
                    updateRoot(
                      "audience",
                      value,
                    )
                  }
                />
              </article>

              <article className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
                <StrategyTextField
                  label="Brand promise"
                  value={
                    draftStrategy
                      .brandPromise
                  }
                  onChange={(value) =>
                    updateRoot(
                      "brandPromise",
                      value,
                    )
                  }
                />
              </article>

              <article className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
                <StrategyTextField
                  label="Brand essence"
                  value={
                    draftStrategy
                      .brandEssence
                  }
                  onChange={(value) =>
                    updateRoot(
                      "brandEssence",
                      value,
                    )
                  }
                />
              </article>

              <article className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
                <StrategyTextField
                  label="Personality summary"
                  value={
                    draftStrategy
                      .personality
                      .summary
                  }
                  onChange={(value) =>
                    setDraftStrategy(
                      (current) =>
                        current
                          ? {
                              ...current,

                              personality: {
                                ...current.personality,
                                summary:
                                  value,
                              },
                            }
                          : current,
                    )
                  }
                />

                <div className="mt-5">
                  <ListField
                    label="Personality traits"
                    value={
                      draftStrategy
                        .personality
                        .traits
                    }
                    onChange={(value) =>
                      setDraftStrategy(
                        (current) =>
                          current
                            ? {
                                ...current,

                                personality: {
                                  ...current.personality,
                                  traits:
                                    value,
                                },
                              }
                            : current,
                      )
                    }
                  />
                </div>
              </article>

              <article className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
                <StrategyTextField
                  label="Visual direction"
                  value={
                    draftStrategy
                      .visualDirection
                      .summary
                  }
                  onChange={(value) =>
                    setDraftStrategy(
                      (current) =>
                        current
                          ? {
                              ...current,

                              visualDirection: {
                                ...current.visualDirection,
                                summary:
                                  value,
                              },
                            }
                          : current,
                    )
                  }
                />

                <div className="mt-5">
                  <ListField
                    label="Visual principles"
                    value={
                      draftStrategy
                        .visualDirection
                        .principles
                    }
                    onChange={(value) =>
                      setDraftStrategy(
                        (current) =>
                          current
                            ? {
                                ...current,

                                visualDirection: {
                                  ...current.visualDirection,
                                  principles:
                                    value,
                                },
                              }
                            : current,
                      )
                    }
                  />
                </div>

                <div className="mt-5">
                  <ListField
                    label="Visual avoid"
                    value={
                      draftStrategy
                        .visualDirection
                        .avoid
                    }
                    onChange={(value) =>
                      setDraftStrategy(
                        (current) =>
                          current
                            ? {
                                ...current,

                                visualDirection: {
                                  ...current.visualDirection,
                                  avoid:
                                    value,
                                },
                              }
                            : current,
                      )
                    }
                  />
                </div>
              </article>

              <article className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
                <StrategyTextField
                  label="Voice direction"
                  value={
                    draftStrategy
                      .voiceDirection
                      .summary
                  }
                  onChange={(value) =>
                    setDraftStrategy(
                      (current) =>
                        current
                          ? {
                              ...current,

                              voiceDirection: {
                                ...current.voiceDirection,
                                summary:
                                  value,
                              },
                            }
                          : current,
                    )
                  }
                />

                <div className="mt-5">
                  <ListField
                    label="Voice principles"
                    value={
                      draftStrategy
                        .voiceDirection
                        .principles
                    }
                    onChange={(value) =>
                      setDraftStrategy(
                        (current) =>
                          current
                            ? {
                                ...current,

                                voiceDirection: {
                                  ...current.voiceDirection,
                                  principles:
                                    value,
                                },
                              }
                            : current,
                      )
                    }
                  />
                </div>

                <div className="mt-5">
                  <ListField
                    label="Voice avoid"
                    value={
                      draftStrategy
                        .voiceDirection
                        .avoid
                    }
                    onChange={(value) =>
                      setDraftStrategy(
                        (current) =>
                          current
                            ? {
                                ...current,

                                voiceDirection: {
                                  ...current.voiceDirection,
                                  avoid:
                                    value,
                                },
                              }
                            : current,
                      )
                    }
                  />
                </div>
              </article>

              <article className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
                <ListField
                  label="Creative guardrails"
                  value={
                    draftStrategy
                      .creativeGuardrails
                  }
                  onChange={(value) =>
                    setDraftStrategy(
                      (current) =>
                        current
                          ? {
                              ...current,
                              creativeGuardrails:
                                value,
                            }
                          : current,
                    )
                  }
                />
              </article>

              <article className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
                <ListField
                  label="Strategic risks"
                  value={
                    draftStrategy
                      .strategicRisks
                  }
                  onChange={(value) =>
                    setDraftStrategy(
                      (current) =>
                        current
                          ? {
                              ...current,
                              strategicRisks:
                                value,
                            }
                          : current,
                    )
                  }
                />
              </article>

              <article className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6 xl:col-span-2">
                <ListField
                  label="Evidence caveats"
                  value={
                    draftStrategy
                      .evidenceCaveats
                  }
                  onChange={(value) =>
                    setDraftStrategy(
                      (current) =>
                        current
                          ? {
                              ...current,
                              evidenceCaveats:
                                value,
                            }
                          : current,
                    )
                  }
                />
              </article>
            </div>

            <div className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
              <StrategyTextField
                label="Studio editorial notes"
                rows={6}
                value={
                  editorialNotes
                }
                onChange={
                  setEditorialNotes
                }
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={
                  saving ||
                  !dirty
                }
                onClick={() =>
                  void saveDraft()
                }
                className="rounded-xl bg-[#f5f0e6] px-5 py-3 text-xs font-semibold text-[#11110f] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                {saving
                  ? "Saving..."
                  : "Save draft"}
              </button>

              <button
                type="button"
                disabled={
                  saving ||
                  dirty ||
                  !draftIsCurrent ||
                  !workspace
                    .gate.ready
                }
                onClick={() =>
                  void approveDraft()
                }
                className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] px-5 py-3 text-xs font-medium text-emerald-100/70 transition hover:border-emerald-300/35 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Approve final strategy
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void discardDraft()
                }
                className="rounded-xl border border-white/10 px-5 py-3 text-xs text-white/35 transition hover:border-red-300/20 hover:text-red-100/60 disabled:opacity-30"
              >
                Discard draft
              </button>

              {dirty && (
                <span className="text-[10px] text-[#c5a577]/65">
                  Unsaved editorial changes
                </span>
              )}
            </div>
          </div>
        )}

      {latestApproved && (
        <div className="mt-12">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-medium tracking-[0.15em] text-emerald-100/50 uppercase">
                Current approved strategy
              </p>

              <h3 className="mt-2 text-2xl font-medium">
                Version {
                  latestApproved
                    .version_number
                }
              </h3>
            </div>

            <p className="text-[10px] text-white/25">
              Approved{" "}
              {formatDate(
                latestApproved
                  .approved_at,
              )}
            </p>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {[
              [
                "Executive summary",
                latestApproved
                  .strategy
                  .executiveSummary,
              ],
              [
                "Positioning",
                latestApproved
                  .strategy
                  .positioning,
              ],
              [
                "Primary audience",
                latestApproved
                  .strategy
                  .audience,
              ],
              [
                "Brand promise",
                latestApproved
                  .strategy
                  .brandPromise,
              ],
              [
                "Brand essence",
                latestApproved
                  .strategy
                  .brandEssence,
              ],
            ].map(
              ([label, value]) => (
                <article
                  key={label}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6"
                >
                  <p className="text-[10px] font-medium tracking-[0.14em] text-[#c5a577] uppercase">
                    {label}
                  </p>

                  <p className="mt-4 text-sm leading-7 text-white/60">
                    {value}
                  </p>
                </article>
              ),
            )}

            <article className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
              <p className="text-[10px] font-medium tracking-[0.14em] text-[#c5a577] uppercase">
                Creative guardrails
              </p>

              <div className="mt-4 text-sm leading-7 text-white/60">
                <ReadOnlyList
                  items={
                    latestApproved
                      .strategy
                      .creativeGuardrails
                  }
                />
              </div>
            </article>
          </div>
        </div>
      )}

      <div className="mt-12">
        <div>
          <p className="text-[10px] font-medium tracking-[0.15em] text-white/25 uppercase">
            Version history
          </p>

          <h3 className="mt-2 text-2xl font-medium">
            Strategy record.
          </h3>
        </div>

        {workspace &&
        workspace.versions.length >
          0 ? (
          <div className="mt-5 space-y-2">
            {workspace.versions.map(
              (version) => {
                const sourceCurrent =
                  version
                    .source_fingerprint ===
                  workspace
                    .currentFingerprint;

                return (
                  <article
                    key={version.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.015] px-5 py-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-medium text-white/65">
                        Version{" "}
                        {
                          version
                            .version_number
                        }
                      </p>

                      <p className="mt-1 text-[10px] text-white/25">
                        {
                          version
                            .source_model
                        }{" "}
                        ·{" "}
                        {sourceCurrent
                          ? "Current evidence"
                          : "Historical evidence"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full border px-3 py-1.5 text-[10px] ${
                          version.status ===
                          "approved"
                            ? "border-emerald-300/20 text-emerald-100/65"
                            : "border-[#c5a577]/20 text-[#ddc39c]"
                        }`}
                      >
                        {version.status}
                      </span>

                      <span className="text-[10px] text-white/20">
                        {version.status ===
                        "approved"
                          ? formatDate(
                              version
                                .approved_at,
                            )
                          : formatDate(
                              version
                                .updated_at,
                            )}
                      </span>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-white/[0.08] p-6 text-xs leading-6 text-white/30">
            No final strategy versions have been created yet.
          </div>
        )}
      </div>
      <div className="mt-12 rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-medium tracking-[0.15em] text-[#c5a577] uppercase">
              Brand Strategy Report
            </p>

            <h3 className="mt-2 text-2xl font-medium">
              Client-facing report.
            </h3>

            <p className="mt-3 max-w-2xl text-xs leading-6 text-white/30">
              The report is generated only from an approved immutable Final Strategy version. Internal studio editorial notes are never included.
            </p>
          </div>

          {latestApproved ? (
            <Link
              href="#report-production"
              target="_blank"
              className="shrink-0 rounded-xl bg-[#f5f0e6] px-5 py-3 text-xs font-semibold text-[#11110f] transition hover:bg-white"
            >
              Open report production
            </Link>
          ) : (
            <span className="shrink-0 rounded-full border border-white/10 px-4 py-2 text-[10px] font-medium text-white/30">
              Locked until final approval
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
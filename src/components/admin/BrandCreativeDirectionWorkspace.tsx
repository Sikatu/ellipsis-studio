"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  evaluateCreativeDirectionCompletion,
  type CreativeDirection,
  type CreativeDirectionColor,
  type CreativeDirectionVersion,
} from "@/lib/creative-direction";

type WorkspacePayload = {
  project: {
    id: string;
    title: string;
  };

  latestStrategy: {
    id: string;
    versionNumber: number;
    approvedAt: string | null;
  } | null;

  canCreateDraft: boolean;
  draftSourceCurrent: boolean;

  draft:
    | CreativeDirectionVersion
    | null;

  approved:
    CreativeDirectionVersion[];

  versions:
    CreativeDirectionVersion[];

  error?: string;
};

function formatDate(
  value:
    | string
    | null,
) {
  if (!value) {
    return "Not yet";
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

function linesToText(
  value: string[],
) {
  return value.join("\n");
}

function textToLines(
  value: string,
) {
  return value
    .split(/\r?\n/)
    .map(
      (item) =>
        item.trim(),
    )
    .filter(Boolean);
}

function isValidPaletteHex(
  value: string,
) {
  return /^#[0-9A-F]{6}$/.test(
    value.trim().toUpperCase(),
  );
}

function FieldLabel({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <p className="text-[10px] font-medium tracking-[0.14em] text-white/30 uppercase">
      {children}
    </p>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (
    value: string,
  ) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(event) =>
        onChange(
          event.target.value,
        )
      }
      placeholder={placeholder}
      className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm leading-6 text-white/70 outline-none transition placeholder:text-white/15 focus:border-[#c5a577]/40"
    />
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (
    value: string,
  ) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value,
        )
      }
      placeholder={placeholder}
      className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/70 outline-none transition placeholder:text-white/15 focus:border-[#c5a577]/40"
    />
  );
}

function ModuleCard({
  eyebrow,
  title,
  complete,
  children,
}: {
  eyebrow: string;
  title: string;
  complete: boolean;
  children:
    React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.018] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium tracking-[0.14em] text-[#c5a577] uppercase">
            {eyebrow}
          </p>

          <h3 className="mt-2 text-lg font-medium tracking-[-0.025em] text-white/80">
            {title}
          </h3>
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.08em] ${
            complete
              ? "border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-100/60"
              : "border-white/10 text-white/25"
          }`}
        >
          {complete
            ? "Complete"
            : "Working"}
        </span>
      </div>

      <div className="mt-5 space-y-5">
        {children}
      </div>
    </article>
  );
}

function ReadOnlyCore({
  direction,
}: {
  direction:
    CreativeDirection;
}) {
  const core =
    direction.brandCore;

  return (
    <div className="space-y-4">
      {[
        [
          "Positioning",
          core.positioning,
        ],
        [
          "Brand promise",
          core.brandPromise,
        ],
        [
          "Brand essence",
          core.brandEssence,
        ],
        [
          "Personality",
          [
            core.personality
              .summary,
            core.personality
              .traits.join(
                "  /  ",
              ),
          ]
            .filter(Boolean)
            .join("\n"),
        ],
      ].map(
        ([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.07] bg-black/10 p-4"
          >
            <FieldLabel>
              {label}
            </FieldLabel>

            <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-white/45">
              {value}
            </p>
          </div>
        ),
      )}

      <p className="text-[10px] leading-5 text-white/20">
        Brand Core is locked to the approved strategy source and cannot be rewritten inside Creative Direction.
      </p>
    </div>
  );
}

function PaletteEditor({
  palette,
  onChange,
}: {
  palette:
    CreativeDirectionColor[];

  onChange: (
    palette:
      CreativeDirectionColor[],
  ) => void;
}) {
  function updateColor(
    index: number,
    patch:
      Partial<
        CreativeDirectionColor
      >,
  ) {
    onChange(
      palette.map(
        (color, current) =>
          current === index
            ? {
                ...color,
                ...patch,
              }
            : color,
      ),
    );
  }

  function removeColor(
    index: number,
  ) {
    onChange(
      palette.filter(
        (_, current) =>
          current !== index,
      ),
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>
          Working palette
        </FieldLabel>

        <button
          type="button"
          onClick={() =>
            onChange([
              ...palette,
              {
                name: "",
                role: "",
                hex: "",
                rationale: "",
              },
            ])
          }
          className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] text-white/40 transition hover:border-white/20 hover:text-white/65"
        >
          Add color
        </button>
      </div>

      {palette.length ===
      0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-7 text-center text-xs text-white/25">
          No palette colors defined yet.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {palette.map(
            (color, index) => {
              const normalizedHex =
                color.hex
                  .trim()
                  .toUpperCase();

              const validHex =
                isValidPaletteHex(
                  normalizedHex,
                );

              const invalidHex =
                normalizedHex.length >
                  0 &&
                !validHex;

              return (
                <div
                  key={index}
                  className="rounded-xl border border-white/[0.07] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-1 h-8 w-8 shrink-0 rounded-lg border border-white/10"
                      style={{
                        backgroundColor:
                          validHex
                            ? color.hex
                            : "transparent",
                      }}
                    />

                    <div className="grid flex-1 gap-3 sm:grid-cols-3">
                      <input
                        value={
                          color.name
                        }
                        onChange={(
                          event,
                        ) =>
                          updateColor(
                            index,
                            {
                              name:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }
                        placeholder="Name"
                        className="rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-xs text-white/65 outline-none placeholder:text-white/15 focus:border-[#c5a577]/40"
                      />

                      <input
                        value={
                          color.role
                        }
                        onChange={(
                          event,
                        ) =>
                          updateColor(
                            index,
                            {
                              role:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }
                        placeholder="Role"
                        className="rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-xs text-white/65 outline-none placeholder:text-white/15 focus:border-[#c5a577]/40"
                      />

                      <div>
                        <input
                          value={
                            color.hex
                          }
                          onChange={(
                            event,
                          ) =>
                            updateColor(
                              index,
                              {
                                hex:
                                  event
                                    .target
                                    .value
                                    .toUpperCase(),
                              },
                            )
                          }
                          onBlur={() => {
                            if (
                              validHex &&
                              color.hex !==
                                normalizedHex
                            ) {
                              updateColor(
                                index,
                                {
                                  hex:
                                    normalizedHex,
                                },
                              );
                            }
                          }}
                          placeholder="#C5A577"
                          aria-invalid={
                            invalidHex
                          }
                          className={`w-full rounded-lg border bg-black/15 px-3 py-2 text-xs uppercase text-white/65 outline-none placeholder:text-white/15 ${
                            invalidHex
                              ? "border-red-300/35 focus:border-red-300/60"
                              : "border-white/10 focus:border-[#c5a577]/40"
                          }`}
                        />

                        {invalidHex && (
                          <p className="mt-1.5 text-[9px] text-red-200/55">
                            Use a six-digit HEX value such as #C5A577.
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeColor(
                          index,
                        )
                      }
                      className="text-[10px] text-white/20 transition hover:text-red-200/60"
                    >
                      Remove
                    </button>
                  </div>

                  <input
                    value={
                      color.rationale
                    }
                    onChange={(
                      event,
                    ) =>
                      updateColor(
                        index,
                        {
                          rationale:
                            event
                              .target
                              .value,
                        },
                      )
                    }
                    placeholder="Why this color belongs in the system"
                    className="mt-3 w-full rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-xs text-white/55 outline-none placeholder:text-white/15 focus:border-[#c5a577]/40"
                  />
                </div>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}

export default function BrandCreativeDirectionWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const [
    workspace,
    setWorkspace,
  ] =
    useState<
      WorkspacePayload | null
    >(null);

  const [
    direction,
    setDirection,
  ] =
    useState<
      CreativeDirection | null
    >(null);

  const [
    editorialNotes,
    setEditorialNotes,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    savedMessage,
    setSavedMessage,
  ] =
    useState<
      string | null
    >(null);

  const load =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              `/api/admin/creative-direction?projectId=${encodeURIComponent(
                projectId,
              )}`,
              {
                cache:
                  "no-store",
              },
            );

          const payload =
            (await response.json()) as
              WorkspacePayload;

          if (!response.ok) {
            throw new Error(
              payload.error ||
                "Could not load creative direction.",
            );
          }

          setWorkspace(
            payload,
          );

          setDirection(
            payload.draft
              ?.direction ??
              null,
          );

          setEditorialNotes(
            payload.draft
              ?.editorial_notes ??
              "",
          );

          setError(null);
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load creative direction.",
          );
        } finally {
          setLoading(false);
        }
      },
      [projectId],
    );

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void load();
        },
        0,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [load]);

  const completion =
    useMemo(
      () =>
        direction
          ? evaluateCreativeDirectionCompletion(
              direction,
            )
          : null,
      [direction],
    );

  const invalidPaletteCount =
    useMemo(
      () =>
        direction
          ? direction
              .colorDirection
              .palette
              .filter(
                (color) =>
                  color.hex
                    .trim()
                    .length >
                    0 &&
                  !isValidPaletteHex(
                    color.hex,
                  ),
              )
              .length
          : 0,
      [direction],
    );

  async function createDraft() {
    setBusy(true);
    setError(null);
    setSavedMessage(null);

    try {
      const response =
        await fetch(
          "/api/admin/creative-direction",
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
            "Could not create creative direction draft.",
        );
      }

      await load();

      setSavedMessage(
        "Creative direction draft created from the latest approved strategy.",
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create creative direction draft.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (
      !workspace?.draft ||
      !direction
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    setSavedMessage(null);

    try {
      const response =
        await fetch(
          "/api/admin/creative-direction",
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
                  workspace
                    .draft.id,

                direction,

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
            "Could not save creative direction.",
        );
      }

      await load();

      setSavedMessage(
        "Creative direction saved.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save creative direction.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function approveDraft() {
    if (
      !workspace?.draft ||
      !completion?.ready
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    setSavedMessage(null);

    try {
      const response =
        await fetch(
          "/api/admin/creative-direction",
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
                  workspace
                    .draft.id,
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
            "Could not approve creative direction.",
        );
      }

      await load();

      setSavedMessage(
        "Creative direction approved and locked.",
      );
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Could not approve creative direction.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function discardDraft() {
    if (!workspace?.draft) {
      return;
    }

    if (
      !window.confirm(
        "Discard this creative direction draft? This cannot be undone.",
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    setSavedMessage(null);

    try {
      const response =
        await fetch(
          `/api/admin/creative-direction?projectId=${encodeURIComponent(
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
            "Could not discard creative direction draft.",
        );
      }

      await load();

      setSavedMessage(
        "Creative direction draft discarded.",
      );
    } catch (discardError) {
      setError(
        discardError instanceof Error
          ? discardError.message
          : "Could not discard creative direction draft.",
      );
    } finally {
      setBusy(false);
    }
  }

  const draft =
    workspace?.draft ??
    null;

  return (
    <section
      id="creative-direction"
      className="scroll-mt-24 border-t border-white/10 py-12 sm:py-16"
    >
      <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[#c5a577] uppercase">
            Creative Direction
          </p>

          <h2 className="mt-3 text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
            Strategy becomes a system.
          </h2>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/40">
            Translate the approved strategy into studio-controlled visual, verbal, and creative direction. Brand Core remains anchored to the approved strategy while the creative modules are developed and reviewed.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {workspace?.latestStrategy && (
            <span className="rounded-full border border-white/10 px-3 py-2 text-[10px] text-white/30">
              Strategy v
              {
                workspace
                  .latestStrategy
                  .versionNumber
              }
            </span>
          )}

          {draft && (
            <span className="rounded-full border border-[#c5a577]/20 bg-[#c5a577]/[0.05] px-3 py-2 text-[10px] text-[#ddc39c]/70">
              Direction v
              {
                draft.version_number
              } draft
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-300/15 bg-red-300/[0.04] px-5 py-4 text-xs leading-6 text-red-100/70">
          {error}
        </div>
      )}

      {savedMessage && (
        <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] px-5 py-4 text-xs leading-6 text-emerald-100/60">
          {savedMessage}
        </div>
      )}

      {loading ? (
        <div className="mt-7 rounded-2xl border border-white/10 p-8 text-sm text-white/30">
          Loading creative direction...
        </div>
      ) : !workspace?.latestStrategy ? (
        <div className="mt-7 rounded-2xl border border-dashed border-white/10 p-8">
          <p className="text-sm font-medium text-white/60">
            Approved strategy required
          </p>

          <p className="mt-2 max-w-2xl text-xs leading-6 text-white/30">
            Approve a Final Strategy version first. Creative Direction will use that immutable version as its strategic source.
          </p>
        </div>
      ) : !draft ? (
        <div className="mt-7 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="text-sm font-medium text-white/65">
              Ready to begin Creative Direction
            </p>

            <p className="mt-2 max-w-3xl text-xs leading-6 text-white/30">
              ELLIPSIS will seed the Brand Core, Visual Territory, Voice System, and guardrails from approved Strategy v{workspace.latestStrategy.versionNumber}. Color, typography, logo, and imagery remain intentionally open for studio development.
            </p>
          </div>

          <button
            type="button"
            disabled={
              busy ||
              !workspace
                .canCreateDraft
            }
            onClick={() =>
              void createDraft()
            }
            className="rounded-xl bg-[#f5f0e6] px-5 py-3 text-xs font-semibold text-[#11110f] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            Create direction draft
          </button>
        </div>
      ) : direction ? (
        <>
          {!workspace
            .draftSourceCurrent && (
            <div className="mt-6 rounded-2xl border border-[#c5a577]/20 bg-[#c5a577]/[0.05] p-5 text-xs leading-6 text-[#ddc39c]/75">
              A newer approved strategy now exists. This draft is stale and cannot be edited or approved. Discard it and create a new direction draft from the latest strategy.
            </div>
          )}

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <FieldLabel>
                Module completion
              </FieldLabel>

              <p className="mt-4 text-3xl font-medium tracking-[-0.04em]">
                {
                  completion
                    ?.completeCount ??
                  0
                }
                /
                {
                  completion
                    ?.moduleCount ??
                  8
                }
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <FieldLabel>
                Source strategy
              </FieldLabel>

              <p className="mt-4 text-sm font-medium text-white/65">
                Version {
                  draft.source_strategy_version_number
                }
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <FieldLabel>
                Direction status
              </FieldLabel>

              <p className="mt-4 text-sm font-medium text-white/65">
                Working draft
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <FieldLabel>
                Approval gate
              </FieldLabel>

              <p className="mt-4 text-sm font-medium text-white/65">
                {completion?.ready
                  ? "Ready"
                  : "Incomplete"}
              </p>
            </article>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            <ModuleCard
              eyebrow="01 / Strategy anchor"
              title="Brand Core"
              complete={
                completion
                  ?.modules
                  .brandCore ??
                false
              }
            >
              <ReadOnlyCore
                direction={
                  direction
                }
              />
            </ModuleCard>

            <ModuleCard
              eyebrow="02 / Visual system"
              title="Visual Territory"
              complete={
                completion
                  ?.modules
                  .visualTerritory ??
                false
              }
            >
              <div>
                <FieldLabel>
                  Direction summary
                </FieldLabel>

                <TextArea
                  value={
                    direction
                      .visualTerritory
                      .summary
                  }
                  onChange={(
                    value,
                  ) =>
                    setDirection({
                      ...direction,

                      visualTerritory: {
                        ...direction
                          .visualTerritory,
                        summary:
                          value,
                      },
                    })
                  }
                  placeholder="Define the overall visual territory."
                />
              </div>

              <div>
                <FieldLabel>
                  Principles
                </FieldLabel>

                <TextArea
                  value={
                    linesToText(
                      direction
                        .visualTerritory
                        .principles,
                    )
                  }
                  onChange={(
                    value,
                  ) =>
                    setDirection({
                      ...direction,

                      visualTerritory: {
                        ...direction
                          .visualTerritory,
                        principles:
                          textToLines(
                            value,
                          ),
                      },
                    })
                  }
                  placeholder="One principle per line."
                />
              </div>

              <div>
                <FieldLabel>
                  Avoid
                </FieldLabel>

                <TextArea
                  value={
                    linesToText(
                      direction
                        .visualTerritory
                        .avoid,
                    )
                  }
                  onChange={(
                    value,
                  ) =>
                    setDirection({
                      ...direction,

                      visualTerritory: {
                        ...direction
                          .visualTerritory,
                        avoid:
                          textToLines(
                            value,
                          ),
                      },
                    })
                  }
                  placeholder="One visual avoidance per line."
                />
              </div>
            </ModuleCard>

            <ModuleCard
              eyebrow="03 / Palette"
              title="Color Direction"
              complete={
                completion
                  ?.modules
                  .colorDirection ??
                false
              }
            >
              <div>
                <FieldLabel>
                  Color rationale
                </FieldLabel>

                <TextArea
                  value={
                    direction
                      .colorDirection
                      .summary
                  }
                  onChange={(
                    value,
                  ) =>
                    setDirection({
                      ...direction,

                      colorDirection: {
                        ...direction
                          .colorDirection,
                        summary:
                          value,
                      },
                    })
                  }
                  placeholder="Describe what the palette should communicate."
                />
              </div>

              <PaletteEditor
                palette={
                  direction
                    .colorDirection
                    .palette
                }
                onChange={(
                  palette,
                ) =>
                  setDirection({
                    ...direction,

                    colorDirection: {
                      ...direction
                        .colorDirection,
                      palette,
                    },
                  })
                }
              />

              <div>
                <FieldLabel>
                  Palette notes
                </FieldLabel>

                <TextArea
                  value={
                    direction
                      .colorDirection
                      .notes
                  }
                  onChange={(
                    value,
                  ) =>
                    setDirection({
                      ...direction,

                      colorDirection: {
                        ...direction
                          .colorDirection,
                        notes:
                          value,
                      },
                    })
                  }
                  placeholder="Usage, balance, accessibility, or production notes."
                  rows={3}
                />
              </div>
            </ModuleCard>

            <ModuleCard
              eyebrow="04 / Type"
              title="Typography Direction"
              complete={
                completion
                  ?.modules
                  .typographyDirection ??
                false
              }
            >
              <div>
                <FieldLabel>
                  Direction summary
                </FieldLabel>

                <TextArea
                  value={
                    direction
                      .typographyDirection
                      .summary
                  }
                  onChange={(
                    value,
                  ) =>
                    setDirection({
                      ...direction,

                      typographyDirection: {
                        ...direction
                          .typographyDirection,
                        summary:
                          value,
                      },
                    })
                  }
                  placeholder="Describe the typographic character."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>
                    Display style
                  </FieldLabel>

                  <TextInput
                    value={
                      direction
                        .typographyDirection
                        .displayStyle
                    }
                    onChange={(
                      value,
                    ) =>
                      setDirection({
                        ...direction,

                        typographyDirection: {
                          ...direction
                            .typographyDirection,
                          displayStyle:
                            value,
                        },
                      })
                    }
                    placeholder="Editorial serif, geometric sans..."
                  />
                </div>

                <div>
                  <FieldLabel>
                    Body style
                  </FieldLabel>

                  <TextInput
                    value={
                      direction
                        .typographyDirection
                        .bodyStyle
                    }
                    onChange={(
                      value,
                    ) =>
                      setDirection({
                        ...direction,

                        typographyDirection: {
                          ...direction
                            .typographyDirection,
                          bodyStyle:
                            value,
                        },
                      })
                    }
                    placeholder="Humanist sans, neutral grotesk..."
                  />
                </div>
              </div>

              <div>
                <FieldLabel>
                  Hierarchy
                </FieldLabel>

                <TextArea
                  value={
                    linesToText(
                      direction
                        .typographyDirection
                        .hierarchy,
                    )
                  }
                  onChange={(
                    value,
                  ) =>
                    setDirection({
                      ...direction,

                      typographyDirection: {
                        ...direction
                          .typographyDirection,
                        hierarchy:
                          textToLines(
                            value,
                          ),
                      },
                    })
                  }
                  placeholder="One hierarchy principle per line."
                  rows={3}
                />
              </div>

              <div>
                <FieldLabel>
                  Type notes
                </FieldLabel>

                <TextArea
                  value={
                    direction
                      .typographyDirection
                      .notes
                  }
                  onChange={(
                    value,
                  ) =>
                    setDirection({
                      ...direction,

                      typographyDirection: {
                        ...direction
                          .typographyDirection,
                        notes:
                          value,
                      },
                    })
                  }
                  placeholder="Licensing, web, editorial, or implementation notes."
                  rows={3}
                />
              </div>
            </ModuleCard>

            <ModuleCard
              eyebrow="05 / Identity"
              title="Logo Direction"
              complete={
                completion
                  ?.modules
                  .logoDirection ??
                false
              }
            >
              <div>
                <FieldLabel>
                  Direction summary
                </FieldLabel>

                <TextArea
                  value={
                    direction
                      .logoDirection
                      .summary
                  }
                  onChange={(
                    value,
                  ) =>
                    setDirection({
                      ...direction,

                      logoDirection: {
                        ...direction
                          .logoDirection,
                        summary:
                          value,
                      },
                    })
                  }
                  placeholder="Describe the identity logic and desired impression."
                />
              </div>

              <div>
                <FieldLabel>
                  Characteristics
                </FieldLabel>

                <TextArea
                  value={
                    linesToText(
                      direction
                        .logoDirection
                        .characteristics,
                    )
                  }
                  onChange={(
                    value,
                  ) =>
                    setDirection({
                      ...direction,

                      logoDirection: {
                        ...direction
                          .logoDirection,
                        characteristics:
                          textToLines(
                            value,
                          ),
                      },
                    })
                  }
                  placeholder="One characteristic per line."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>
                    Symbol direction
                  </FieldLabel>

                  <TextArea
                    value={
                      direction
                        .logoDirection
                        .symbolDirection
                    }
                    onChange={(
                      value,
                    ) =>
                      setDirection({
                        ...direction,

                        logoDirection: {
                          ...direction
                            .logoDirection,
                          symbolDirection:
                            value,
                        },
                      })
                    }
                    placeholder="Symbol / emblem logic."
                    rows={3}
                  />
                </div>

                <div>
                  <FieldLabel>
                    Wordmark direction
                  </FieldLabel>

                  <TextArea
                    value={
                      direction
                        .logoDirection
                        .wordmarkDirection
                    }
                    onChange={(
                      value,
                    ) =>
                      setDirection({
                        ...direction,

                        logoDirection: {
                          ...direction
                            .logoDirection,
                          wordmarkDirection:
                            value,
                        },
                      })
                    }
                    placeholder="Wordmark / lettering logic."
                    rows={3}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>
                  Avoid
                </FieldLabel>

                <TextArea
                  value={
                    linesToText(
                      direction
                        .logoDirection
                        .avoid,
                    )
                  }
                  onChange={(
                    value,
                  ) =>
                    setDirection({
                      ...direction,

                      logoDirection: {
                        ...direction
                          .logoDirection,
                        avoid:
                          textToLines(
                            value,
                          ),
                      },
                    })
                  }
                  placeholder="One logo avoidance per line."
                  rows={3}
                />
              </div>
            </ModuleCard>

            <ModuleCard
              eyebrow="06 / Art direction"
              title="Imagery Direction"
              complete={
                completion
                  ?.modules
                  .imageryDirection ??
                false
              }
            >
              <div>
                <FieldLabel>
                  Direction summary
                </FieldLabel>

                <TextArea
                  value={
                    direction
                      .imageryDirection
                      .summary
                  }
                  onChange={(
                    value,
                  ) =>
                    setDirection({
                      ...direction,

                      imageryDirection: {
                        ...direction
                          .imageryDirection,
                        summary:
                          value,
                      },
                    })
                  }
                  placeholder="Define the image world."
                />
              </div>

              {[
                [
                  "Photography",
                  "photography",
                  "Portraiture, documentary, product, editorial...",
                ],
                [
                  "Composition",
                  "composition",
                  "Framing, negative space, cropping, perspective...",
                ],
                [
                  "Lighting",
                  "lighting",
                  "Soft daylight, high contrast, cinematic...",
                ],
                [
                  "Texture",
                  "texture",
                  "Clean, tactile, grain, paper, material...",
                ],
                [
                  "Subject treatment",
                  "subjectTreatment",
                  "How people, products, or environments should be shown.",
                ],
              ].map(
                ([
                  label,
                  key,
                  placeholder,
                ]) => (
                  <div
                    key={key}
                  >
                    <FieldLabel>
                      {label}
                    </FieldLabel>

                    <TextInput
                      value={
                        direction
                          .imageryDirection[
                          key as
                            | "photography"
                            | "composition"
                            | "lighting"
                            | "texture"
                            | "subjectTreatment"
                        ]
                      }
                      onChange={(
                        value,
                      ) =>
                        setDirection({
                          ...direction,

                          imageryDirection: {
                            ...direction
                              .imageryDirection,

                            [key]:
                              value,
                          },
                        })
                      }
                      placeholder={
                        placeholder
                      }
                    />
                  </div>
                ),
              )}

              <div>
                <FieldLabel>
                  Avoid
                </FieldLabel>

                <TextArea
                  value={
                    linesToText(
                      direction
                        .imageryDirection
                        .avoid,
                    )
                  }
                  onChange={(
                    value,
                  ) =>
                    setDirection({
                      ...direction,

                      imageryDirection: {
                        ...direction
                          .imageryDirection,
                        avoid:
                          textToLines(
                            value,
                          ),
                      },
                    })
                  }
                  placeholder="One imagery avoidance per line."
                  rows={3}
                />
              </div>
            </ModuleCard>

            <ModuleCard
              eyebrow="07 / Verbal identity"
              title="Voice System"
              complete={
                completion
                  ?.modules
                  .voiceSystem ??
                false
              }
            >
              <div>
                <FieldLabel>
                  Voice summary
                </FieldLabel>

                <TextArea
                  value={
                    direction
                      .voiceSystem
                      .summary
                  }
                  onChange={(
                    value,
                  ) =>
                    setDirection({
                      ...direction,

                      voiceSystem: {
                        ...direction
                          .voiceSystem,
                        summary:
                          value,
                      },
                    })
                  }
                  placeholder="Define how the brand should sound."
                />
              </div>

              {[
                [
                  "Principles",
                  "principles",
                  "One principle per line.",
                ],
                [
                  "Use",
                  "use",
                  "Words, patterns, or language to use.",
                ],
                [
                  "Avoid",
                  "avoid",
                  "Language patterns to avoid.",
                ],
              ].map(
                ([
                  label,
                  key,
                  placeholder,
                ]) => (
                  <div
                    key={key}
                  >
                    <FieldLabel>
                      {label}
                    </FieldLabel>

                    <TextArea
                      value={
                        linesToText(
                          direction
                            .voiceSystem[
                            key as
                              | "principles"
                              | "use"
                              | "avoid"
                          ],
                        )
                      }
                      onChange={(
                        value,
                      ) =>
                        setDirection({
                          ...direction,

                          voiceSystem: {
                            ...direction
                              .voiceSystem,

                            [key]:
                              textToLines(
                                value,
                              ),
                          },
                        })
                      }
                      placeholder={
                        placeholder
                      }
                      rows={3}
                    />
                  </div>
                ),
              )}
            </ModuleCard>

            <ModuleCard
              eyebrow="08 / Review criteria"
              title="Creative Guardrails"
              complete={
                completion
                  ?.modules
                  .creativeGuardrails ??
                false
              }
            >
              {[
                [
                  "Must feel",
                  "mustFeel",
                  "One required feeling per line.",
                ],
                [
                  "Must never feel",
                  "mustNeverFeel",
                  "One forbidden feeling per line.",
                ],
                [
                  "Strategic risks",
                  "risks",
                  "One risk per line.",
                ],
              ].map(
                ([
                  label,
                  key,
                  placeholder,
                ]) => (
                  <div
                    key={key}
                  >
                    <FieldLabel>
                      {label}
                    </FieldLabel>

                    <TextArea
                      value={
                        linesToText(
                          direction
                            .creativeGuardrails[
                            key as
                              | "mustFeel"
                              | "mustNeverFeel"
                              | "risks"
                          ],
                        )
                      }
                      onChange={(
                        value,
                      ) =>
                        setDirection({
                          ...direction,

                          creativeGuardrails: {
                            ...direction
                              .creativeGuardrails,

                            [key]:
                              textToLines(
                                value,
                              ),
                          },
                        })
                      }
                      placeholder={
                        placeholder
                      }
                      rows={3}
                    />
                  </div>
                ),
              )}
            </ModuleCard>
          </div>

          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.018] p-5 sm:p-6">
            <FieldLabel>
              Studio editorial notes
            </FieldLabel>

            <TextArea
              value={
                editorialNotes
              }
              onChange={
                setEditorialNotes
              }
              placeholder="Internal rationale, concept review notes, open questions, or handoff context."
              rows={5}
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={
                busy ||
                !workspace
                  .draftSourceCurrent ||
                invalidPaletteCount >
                  0
              }
              onClick={() =>
                void saveDraft()
              }
              className="rounded-xl bg-[#f5f0e6] px-5 py-3 text-xs font-semibold text-[#11110f] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              {busy
                ? "Working..."
                : "Save direction"}
            </button>

            <button
              type="button"
              disabled={
                busy ||
                !workspace
                  .draftSourceCurrent ||
                !completion?.ready
              }
              onClick={() =>
                void approveDraft()
              }
              className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.045] px-5 py-3 text-xs font-medium text-emerald-100/65 transition hover:bg-emerald-300/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
            >
              Approve direction
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void discardDraft()
              }
              className="rounded-xl border border-white/10 px-5 py-3 text-xs text-white/35 transition hover:border-red-300/20 hover:text-red-100/60 disabled:opacity-30"
            >
              Discard draft
            </button>
          </div>

          {invalidPaletteCount > 0 && (
            <p className="mt-3 text-[10px] leading-5 text-red-200/45">
              Fix invalid palette HEX values before saving.
            </p>
          )}

          {!completion?.ready && (
            <p className="mt-3 text-[10px] leading-5 text-white/20">
              Approval unlocks when all eight modules meet their completion requirements. A working draft can be saved at any time.
            </p>
          )}
        </>
      ) : null}

      {workspace &&
        workspace.approved.length >
          0 && (
        <div className="mt-10 border-t border-white/[0.07] pt-7">
          <FieldLabel>
            Approved direction history
          </FieldLabel>

          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workspace.approved.map(
              (version) => (
                <article
                  key={
                    version.id
                  }
                  className="rounded-2xl border border-white/[0.08] p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-white/60">
                      Direction v
                      {
                        version.version_number
                      }
                    </p>

                    <span className="text-[9px] uppercase tracking-[0.1em] text-emerald-100/45">
                      Approved
                    </span>
                  </div>

                  <p className="mt-3 text-[10px] leading-5 text-white/25">
                    Strategy v
                    {
                      version
                        .source_strategy_version_number
                    }
                    {"  /  "}
                    {
                      formatDate(
                        version
                          .approved_at,
                      )
                    }
                  </p>
                </article>
              ),
            )}
          </div>
        </div>
      )}
    </section>
  );
}
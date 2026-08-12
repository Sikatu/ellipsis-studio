"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  contrastRatio,
  evaluateVisualSystemCompletion,
  hexToRgb,
  normalizeHex,
  relativeLuminance,
  rgbToHsl,
  wcagContrastResult,
  type VisualSystem,
  type VisualSystemColor,
  type VisualSystemPairing,
  type VisualSystemVersion,
} from "@/lib/visual-system";

import BrandTypeStudioPanel from "@/components/admin/BrandTypeStudioPanel";

type WorkspaceResponse = {
  project: {
    id: string;
    title: string;
  };

  latestDirection: {
    id: string;
    versionNumber: number;
    approvedAt: string | null;
  } | null;

  canCreateDraft: boolean;
  draftSourceCurrent: boolean;
  draft: VisualSystemVersion | null;
  approved: VisualSystemVersion[];
  versions: VisualSystemVersion[];
};

const TOKEN_PATTERN =
  /^--[a-z0-9]+(?:-[a-z0-9]+)*$/;

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "Not recorded";
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

  return new Intl.DateTimeFormat(
    "en",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  ).format(date);
}

function FieldLabel({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c5a577]/65">
      {children}
    </p>
  );
}

function ModuleCard({
  title,
  status,
  children,
}: {
  title: string;
  status: boolean;
  children:
    React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-black/10 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <FieldLabel>
            Studio Module
          </FieldLabel>

          <h3 className="mt-2 text-lg font-medium tracking-[-0.02em] text-white/75">
            {title}
          </h3>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-[9px] uppercase tracking-[0.12em] ${
            status
              ? "border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-100/50"
              : "border-white/10 bg-white/[0.02] text-white/25"
          }`}
        >
          {status
            ? "Complete"
            : "Open"}
        </span>
      </div>

      <div className="mt-5">
        {children}
      </div>
    </article>
  );
}

function cloneSystem(
  system: VisualSystem,
): VisualSystem {
  return JSON.parse(
    JSON.stringify(system),
  ) as VisualSystem;
}

function tokenFromName(
  name: string,
  index: number,
) {
  const slug =
    name
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      );

  return `--brand-${slug || `color-${index + 1}`}`;
}

function paletteHexValid(
  color: VisualSystemColor,
) {
  return (
    normalizeHex(color.hex) !==
    null
  );
}

function paletteTokenValid(
  color: VisualSystemColor,
) {
  return (
    color.token.trim() === "" ||
    TOKEN_PATTERN.test(
      color.token.trim(),
    )
  );
}

function contrastLabel(
  ratio: number | null,
) {
  if (ratio === null) {
    return "Invalid";
  }

  if (ratio >= 7) {
    return "AAA";
  }

  if (ratio >= 4.5) {
    return "AA";
  }

  return "Fail";
}

function PairingCard({
  pairing,
  index,
  colors,
  disabled,
  onChange,
  onRemove,
}: {
  pairing: VisualSystemPairing;
  index: number;
  colors: VisualSystemColor[];
  disabled: boolean;
  onChange: (
    index: number,
    field:
      keyof VisualSystemPairing,
    value: string,
  ) => void;
  onRemove: (
    index: number,
  ) => void;
}) {
  const foreground =
    colors.find(
      (color) =>
        color.token ===
        pairing.foregroundToken,
    );

  const background =
    colors.find(
      (color) =>
        color.token ===
        pairing.backgroundToken,
    );

  const ratio =
    foreground &&
    background
      ? contrastRatio(
          foreground.hex,
          background.hex,
        )
      : null;

  const result =
    foreground &&
    background
      ? wcagContrastResult(
          foreground.hex,
          background.hex,
        )
      : null;

  const passes =
    ratio !== null &&
    ratio >= 4.5;

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-black/10 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <FieldLabel>
            Approved Pairing {index + 1}
          </FieldLabel>

          <p className="mt-2 text-xs leading-5 text-white/25">
            Normal text requires 4.5:1 or higher for this production gate.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-[9px] uppercase tracking-[0.12em] ${
              passes
                ? "border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-100/55"
                : "border-amber-300/15 bg-amber-300/[0.04] text-amber-100/50"
            }`}
          >
            {ratio === null
              ? "Select colors"
              : `${ratio.toFixed(2)}:1 ${contrastLabel(ratio)}`}
          </span>

          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onRemove(index)
            }
            className="rounded-lg border border-white/10 px-3 py-1.5 text-[9px] uppercase tracking-[0.1em] text-white/25 transition hover:border-red-300/20 hover:text-red-100/55 disabled:opacity-30"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label>
          <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
            Foreground
          </span>

          <select
            value={
              pairing.foregroundToken
            }
            disabled={disabled}
            onChange={(
              event,
            ) =>
              onChange(
                index,
                "foregroundToken",
                event.target.value,
              )
            }
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#141411] px-3 py-2.5 text-xs text-white/60 outline-none focus:border-[#c5a577]/35 disabled:opacity-35"
          >
            <option value="">
              Select foreground
            </option>

            {colors
              .filter(
                (color) =>
                  TOKEN_PATTERN.test(
                    color.token,
                  ),
              )
              .map(
                (color) => (
                  <option
                    key={
                      color.token
                    }
                    value={
                      color.token
                    }
                  >
                    {color.name} ({color.token})
                  </option>
                ),
              )}
          </select>
        </label>

        <label>
          <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
            Background
          </span>

          <select
            value={
              pairing.backgroundToken
            }
            disabled={disabled}
            onChange={(
              event,
            ) =>
              onChange(
                index,
                "backgroundToken",
                event.target.value,
              )
            }
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#141411] px-3 py-2.5 text-xs text-white/60 outline-none focus:border-[#c5a577]/35 disabled:opacity-35"
          >
            <option value="">
              Select background
            </option>

            {colors
              .filter(
                (color) =>
                  TOKEN_PATTERN.test(
                    color.token,
                  ),
              )
              .map(
                (color) => (
                  <option
                    key={
                      color.token
                    }
                    value={
                      color.token
                    }
                  >
                    {color.name} ({color.token})
                  </option>
                ),
              )}
          </select>
        </label>

        <label>
          <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
            Purpose
          </span>

          <input
            value={
              pairing.purpose
            }
            disabled={disabled}
            onChange={(
              event,
            ) =>
              onChange(
                index,
                "purpose",
                event.target.value,
              )
            }
            placeholder="Body copy, CTA, navigation..."
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs text-white/60 outline-none placeholder:text-white/15 focus:border-[#c5a577]/35 disabled:opacity-35"
          />
        </label>
      </div>

      {foreground &&
        background && (
        <div
          className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08] p-5"
          style={{
            backgroundColor:
              background.hex,
            color:
              foreground.hex,
          }}
        >
          <p className="text-lg font-medium tracking-[-0.02em]">
            Aa Brand pairing preview
          </p>

          <p className="mt-2 text-sm leading-6">
            Editorial clarity should remain readable across the visual system.
          </p>
        </div>
      )}

      {result && (
        <div className="mt-4 flex flex-wrap gap-2 text-[9px] uppercase tracking-[0.1em]">
          <span className="rounded-full border border-white/10 px-3 py-1 text-white/30">
            Normal: {result.normalText}
          </span>

          <span className="rounded-full border border-white/10 px-3 py-1 text-white/30">
            Large: {result.largeText}
          </span>
        </div>
      )}
    </article>
  );
}

export default function BrandVisualSystemWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const [
    workspace,
    setWorkspace,
  ] =
    useState<
      WorkspaceResponse | null
    >(null);

  const [
    system,
    setSystem,
  ] =
    useState<
      VisualSystem | null
    >(null);

  const [
    notes,
    setNotes,
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
    message,
    setMessage,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const loadWorkspace =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const response =
            await fetch(
              `/api/admin/visual-system?projectId=${encodeURIComponent(projectId)}`,
              {
                cache:
                  "no-store",
              },
            );

          const data =
            (await response.json()) as
              WorkspaceResponse & {
                error?: string;
              };

          if (!response.ok) {
            throw new Error(
              data.error ||
                "Could not load visual system workspace.",
            );
          }

          setWorkspace(data);

          setSystem(
            data.draft
              ? cloneSystem(
                  data.draft
                    .system,
                )
              : null,
          );

          setNotes(
            data.draft
              ?.editorial_notes ??
              "",
          );
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load visual system workspace.",
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
          void loadWorkspace();
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [loadWorkspace]);

  const completion =
    useMemo(
      () =>
        system
          ? evaluateVisualSystemCompletion(
              system,
            )
          : null,
      [system],
    );

  const palette =
    system?.paletteSystem ??
    null;

  const usageTotal =
    useMemo(
      () =>
        palette
          ? palette.colors.reduce(
              (
                total,
                color,
              ) =>
                total +
                (
                  color
                    .usagePercent ??
                  0
                ),
              0,
            )
          : 0,
      [palette],
    );

  const duplicateTokens =
    useMemo(
      () => {
        if (!palette) {
          return new Set<string>();
        }

        const seen =
          new Set<string>();

        const duplicates =
          new Set<string>();

        for (
          const color of
            palette.colors
        ) {
          const token =
            color.token.trim();

          if (!token) {
            continue;
          }

          if (seen.has(token)) {
            duplicates.add(token);
          }

          seen.add(token);
        }

        return duplicates;
      },
      [palette],
    );

  const invalidPalette =
    useMemo(
      () => {
        if (!palette) {
          return false;
        }

        return palette.colors.some(
          (color) =>
            !paletteHexValid(
              color,
            ) ||
            !paletteTokenValid(
              color,
            ) ||
            (
              color.token.trim() !==
                "" &&
              duplicateTokens.has(
                color.token.trim(),
              )
            ) ||
            (
              color
                .usagePercent !==
                null &&
              (
                color
                  .usagePercent <
                  0 ||
                color
                  .usagePercent >
                  100
              )
            ),
        );
      },
      [
        palette,
        duplicateTokens,
      ],
    );

  const sourceBrief =
    system?.sourceBrief ??
    null;

  const updateColor =
    useCallback(
      (
        index: number,
        field:
          keyof VisualSystemColor,
        value:
          string | number | null,
      ) => {
        setSystem(
          (current) => {
            if (!current) {
              return current;
            }

            const next =
              cloneSystem(current);

            const color =
              next.paletteSystem
                .colors[index];

            if (!color) {
              return current;
            }

            if (
              field ===
              "usagePercent"
            ) {
              color.usagePercent =
                typeof value ===
                  "number"
                  ? value
                  : null;
            } else if (
              field === "hex"
            ) {
              color.hex =
                String(value)
                  .trim()
                  .toUpperCase();
            } else {
              color[field] =
                String(value);
            }

            return next;
          },
        );
      },
      [],
    );

  const updatePaletteNote =
    useCallback(
      (
        field:
          "usageNotes" |
          "applicationNotes",
        value: string,
      ) => {
        setSystem(
          (current) => {
            if (!current) {
              return current;
            }

            const next =
              cloneSystem(current);

            next.paletteSystem[
              field
            ] = value;

            return next;
          },
        );
      },
      [],
    );

  const autoAssignTokens =
    useCallback(
      () => {
        setSystem(
          (current) => {
            if (!current) {
              return current;
            }

            const next =
              cloneSystem(current);

            next.paletteSystem
              .colors
              .forEach(
                (
                  color,
                  index,
                ) => {
                  if (
                    !color.token
                      .trim()
                  ) {
                    color.token =
                      tokenFromName(
                        color.name,
                        index,
                      );
                  }
                },
              );

            return next;
          },
        );
      },
      [],
    );

  const addPairing =
    useCallback(
      () => {
        setSystem(
          (current) => {
            if (!current) {
              return current;
            }

            const valid =
              current
                .paletteSystem
                .colors
                .filter(
                  (color) =>
                    TOKEN_PATTERN.test(
                      color.token,
                    ),
                );

            if (
              valid.length < 2
            ) {
              return current;
            }

            const next =
              cloneSystem(current);

            next.paletteSystem
              .approvedPairings
              .push({
                foregroundToken:
                  valid[0].token,
                backgroundToken:
                  valid[1].token,
                purpose:
                  "Normal text",
              });

            return next;
          },
        );
      },
      [],
    );

  const updatePairing =
    useCallback(
      (
        index: number,
        field:
          keyof VisualSystemPairing,
        value: string,
      ) => {
        setSystem(
          (current) => {
            if (!current) {
              return current;
            }

            const next =
              cloneSystem(current);

            const pairing =
              next.paletteSystem
                .approvedPairings[
                  index
                ];

            if (!pairing) {
              return current;
            }

            pairing[field] =
              value;

            return next;
          },
        );
      },
      [],
    );

  const removePairing =
    useCallback(
      (index: number) => {
        setSystem(
          (current) => {
            if (!current) {
              return current;
            }

            const next =
              cloneSystem(current);

            next.paletteSystem
              .approvedPairings
              .splice(
                index,
                1,
              );

            return next;
          },
        );
      },
      [],
    );

  async function createDraft() {
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response =
        await fetch(
          "/api/admin/visual-system",
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

      const data =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not create visual system draft.",
        );
      }

      setMessage(
        "Visual system draft created from the approved Creative Direction.",
      );

      await loadWorkspace();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not create visual system draft.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveFoundation() {
    if (
      !workspace?.draft ||
      !system
    ) {
      return;
    }

    if (invalidPalette) {
      setError(
        "Resolve invalid HEX values, token formats, duplicate tokens, or usage percentages before saving.",
      );
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response =
        await fetch(
          "/api/admin/visual-system",
          {
            method:
              "PATCH",
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
                system,
                editorialNotes:
                  notes,
              }),
          },
        );

      const data =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not save visual system.",
        );
      }

      setMessage(
        "Visual system saved.",
      );

      await loadWorkspace();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not save visual system.",
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
    setMessage("");
    setError("");

    try {
      const response =
        await fetch(
          "/api/admin/visual-system",
          {
            method:
              "POST",
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

      const data =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not approve visual system.",
        );
      }

      setMessage(
        "Visual system approved.",
      );

      await loadWorkspace();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not approve visual system.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function discardDraft() {
    if (
      !workspace?.draft
    ) {
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response =
        await fetch(
          "/api/admin/visual-system",
          {
            method:
              "DELETE",
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
              }),
          },
        );

      const data =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not discard visual system draft.",
        );
      }

      setMessage(
        "Visual system draft discarded.",
      );

      await loadWorkspace();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not discard visual system draft.",
      );
    } finally {
      setBusy(false);
    }
  }

  const validTokenCount =
    palette?.colors.filter(
      (color) =>
        TOKEN_PATTERN.test(
          color.token,
        ),
    ).length ?? 0;

  return (
    <section
      id="visual-system"
      className="scroll-mt-24 border-t border-white/10 pt-12 sm:pt-16"
    >
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c5a577]">
            Visual System
          </p>

          <h2 className="mt-3 text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
            Palette + Type Studio.
          </h2>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/40">
            Translate the approved Creative Direction into a versioned production system. Source direction stays locked while palette and typography decisions are developed in their own studio layer.
          </p>
        </div>

        {workspace?.draft && (
          <div className="rounded-2xl border border-white/[0.08] px-5 py-4">
            <FieldLabel>
              Production Gate
            </FieldLabel>

            <p className="mt-2 text-sm text-white/65">
              {
                completion
                  ?.completeCount ??
                0
              }
              /
              {
                completion
                  ?.moduleCount ??
                2
              }
              {" "}modules
            </p>

            <p className="mt-1 text-[10px] text-white/25">
              Palette and Type Studios are active.
            </p>
          </div>
        )}
      </div>

      {loading && (
        <p className="mt-8 text-sm text-white/35">
          Loading visual system...
        </p>
      )}

      {error && (
        <div className="mt-8 rounded-2xl border border-red-300/15 bg-red-300/[0.04] p-5 text-sm leading-6 text-red-100/65">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-8 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-5 text-sm leading-6 text-emerald-100/65">
          {message}
        </div>
      )}

      {!loading &&
        workspace &&
        !workspace
          .latestDirection && (
        <div className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-7">
          <FieldLabel>
            Source Required
          </FieldLabel>

          <h3 className="mt-3 text-xl font-medium text-white/70">
            Approve Creative Direction first.
          </h3>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/35">
            Palette + Type Studio can only begin from an approved Creative Direction version.
          </p>
        </div>
      )}

      {!loading &&
        workspace &&
        workspace
          .latestDirection &&
        !workspace.draft && (
        <div className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <FieldLabel>
                Ready for Studio
              </FieldLabel>

              <h3 className="mt-3 text-xl font-medium text-white/70">
                Create Visual System v
                {
                  workspace
                    .versions.length +
                  1
                }
              </h3>

              <p className="mt-3 text-sm leading-7 text-white/35">
                Source: approved Creative Direction v
                {
                  workspace
                    .latestDirection
                    .versionNumber
                }.
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
              className="rounded-xl bg-[#c5a577] px-5 py-3 text-xs font-semibold text-[#11110f] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {busy
                ? "Working..."
                : "Create visual system draft"}
            </button>
          </div>
        </div>
      )}

      {workspace?.draft &&
        system && (
        <>
          {!workspace
            .draftSourceCurrent && (
            <div className="mt-8 rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-5 text-sm leading-6 text-amber-100/60">
              This draft references an older Creative Direction. Discard it before continuing.
            </div>
          )}

          <div className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-7">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <FieldLabel>
                  Locked Source Brief
                </FieldLabel>

                <h3 className="mt-3 text-xl font-medium text-white/70">
                  Creative Direction v
                  {
                    workspace
                      .draft
                      .source_creative_direction_version_number
                  }
                </h3>

                <p className="mt-3 max-w-2xl text-xs leading-6 text-white/30">
                  The server reconstructs this source brief from the approved Creative Direction on every save. Browser edits cannot rewrite it.
                </p>
              </div>

              <span className="rounded-full border border-[#c5a577]/20 bg-[#c5a577]/[0.05] px-3 py-1.5 text-[9px] uppercase tracking-[0.12em] text-[#c5a577]/65">
                Locked
              </span>
            </div>

            {sourceBrief && (
              <div className="mt-7 grid gap-5 xl:grid-cols-2">
                <article className="rounded-2xl border border-white/[0.07] p-5">
                  <FieldLabel>
                    Color Direction
                  </FieldLabel>

                  <p className="mt-3 text-sm leading-7 text-white/45">
                    {
                      sourceBrief
                        .colorDirection
                        .summary
                    }
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {sourceBrief
                      .colorDirection
                      .palette
                      .map(
                        (color) => (
                          <div
                            key={`${color.name}-${color.hex}`}
                            className="overflow-hidden rounded-xl border border-white/[0.08]"
                          >
                            <div
                              className="h-14"
                              style={{
                                backgroundColor:
                                  color.hex,
                              }}
                            />

                            <div className="p-3">
                              <p className="text-[10px] font-medium text-white/55">
                                {color.name}
                              </p>

                              <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-white/20">
                                {color.hex}
                              </p>
                            </div>
                          </div>
                        ),
                      )}
                  </div>
                </article>

                <article className="rounded-2xl border border-white/[0.07] p-5">
                  <FieldLabel>
                    Typography Direction
                  </FieldLabel>

                  <p className="mt-3 text-sm leading-7 text-white/45">
                    {
                      sourceBrief
                        .typographyDirection
                        .summary
                    }
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-white/[0.025] p-4">
                      <p className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                        Display Style
                      </p>

                      <p className="mt-2 text-sm text-white/55">
                        {
                          sourceBrief
                            .typographyDirection
                            .displayStyle
                        }
                      </p>
                    </div>

                    <div className="rounded-xl bg-white/[0.025] p-4">
                      <p className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                        Body Style
                      </p>

                      <p className="mt-2 text-sm text-white/55">
                        {
                          sourceBrief
                            .typographyDirection
                            .bodyStyle
                        }
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            )}
          </div>

          <div className="mt-8 rounded-3xl border border-[#c5a577]/15 bg-[#c5a577]/[0.025] p-6 sm:p-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <FieldLabel>
                  Phase 6B.2
                </FieldLabel>

                <h3 className="mt-3 text-2xl font-medium tracking-[-0.03em] text-white/80">
                  Palette Studio
                </h3>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-white/35">
                  Convert directional colors into production tokens, semantic roles, usage ratios, and tested foreground/background pairings.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1.5 text-[9px] uppercase tracking-[0.12em] ${
                    Math.abs(
                      usageTotal -
                        100,
                    ) <= 0.01
                      ? "border-emerald-300/15 text-emerald-100/50"
                      : "border-white/10 text-white/30"
                  }`}
                >
                  Usage {usageTotal.toFixed(1)}%
                </span>

                <span
                  className={`rounded-full border px-3 py-1.5 text-[9px] uppercase tracking-[0.12em] ${
                    completion
                      ?.modules
                      .palette
                      ? "border-emerald-300/15 text-emerald-100/50"
                      : "border-white/10 text-white/30"
                  }`}
                >
                  {completion
                    ?.modules
                    .palette
                    ? "Palette complete"
                    : "Palette open"}
                </span>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={
                  busy ||
                  !workspace
                    .draftSourceCurrent
                }
                onClick={
                  autoAssignTokens
                }
                className="rounded-xl border border-white/10 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40 transition hover:border-[#c5a577]/25 hover:text-[#c5a577]/65 disabled:opacity-30"
              >
                Auto-assign blank tokens
              </button>

              <button
                type="button"
                disabled={
                  busy ||
                  validTokenCount <
                    2 ||
                  !workspace
                    .draftSourceCurrent
                }
                onClick={
                  addPairing
                }
                className="rounded-xl border border-white/10 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40 transition hover:border-[#c5a577]/25 hover:text-[#c5a577]/65 disabled:opacity-30"
              >
                Add approved pairing
              </button>
            </div>

            {palette && (
              <div className="mt-7 space-y-4">
                {palette.colors.map(
                  (
                    color,
                    index,
                  ) => {
                    const rgb =
                      hexToRgb(
                        color.hex,
                      );

                    const hsl =
                      rgb
                        ? rgbToHsl(
                            rgb,
                          )
                        : null;

                    const luminance =
                      relativeLuminance(
                        color.hex,
                      );

                    const hexValid =
                      paletteHexValid(
                        color,
                      );

                    const tokenValid =
                      paletteTokenValid(
                        color,
                      );

                    const tokenDuplicate =
                      color.token
                        .trim() !==
                        "" &&
                      duplicateTokens.has(
                        color.token
                          .trim(),
                      );

                    return (
                      <article
                        key={`${index}-${color.name}`}
                        className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/10"
                      >
                        <div className="grid lg:grid-cols-[160px_1fr]">
                          <div
                            className="min-h-40 border-b border-white/[0.08] p-5 lg:border-b-0 lg:border-r"
                            style={{
                              backgroundColor:
                                hexValid
                                  ? color.hex
                                  : "#11110f",
                            }}
                          >
                            <div className="rounded-xl bg-black/45 p-3 backdrop-blur-sm">
                              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/65">
                                Color {index + 1}
                              </p>

                              <p className="mt-2 break-all text-xs font-medium text-white/80">
                                {color.hex}
                              </p>
                            </div>
                          </div>

                          <div className="p-5">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                              <label>
                                <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                                  Name
                                </span>

                                <input
                                  value={
                                    color.name
                                  }
                                  disabled={
                                    busy
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateColor(
                                      index,
                                      "name",
                                      event
                                        .target
                                        .value,
                                    )
                                  }
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs text-white/60 outline-none focus:border-[#c5a577]/35 disabled:opacity-35"
                                />
                              </label>

                              <label>
                                <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                                  Design Token
                                </span>

                                <input
                                  value={
                                    color.token
                                  }
                                  disabled={
                                    busy
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateColor(
                                      index,
                                      "token",
                                      event
                                        .target
                                        .value
                                        .toLowerCase(),
                                    )
                                  }
                                  placeholder="--brand-background"
                                  className={`mt-2 w-full rounded-xl border bg-black/15 px-3 py-2.5 text-xs text-white/60 outline-none disabled:opacity-35 ${
                                    tokenValid &&
                                    !tokenDuplicate
                                      ? "border-white/10 focus:border-[#c5a577]/35"
                                      : "border-red-300/30 focus:border-red-300/40"
                                  }`}
                                />

                                {!tokenValid && (
                                  <p className="mt-1 text-[9px] text-red-100/45">
                                    Use a token such as --brand-background.
                                  </p>
                                )}

                                {tokenDuplicate && (
                                  <p className="mt-1 text-[9px] text-red-100/45">
                                    Design tokens must be unique.
                                  </p>
                                )}
                              </label>

                              <label>
                                <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                                  HEX
                                </span>

                                <div className="mt-2 flex gap-2">
                                  <input
                                    type="color"
                                    value={
                                      hexValid
                                        ? color.hex
                                        : "#11110f"
                                    }
                                    disabled={
                                      busy
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      updateColor(
                                        index,
                                        "hex",
                                        event
                                          .target
                                          .value,
                                      )
                                    }
                                    className="h-10 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent p-1 disabled:opacity-35"
                                  />

                                  <input
                                    value={
                                      color.hex
                                    }
                                    disabled={
                                      busy
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      updateColor(
                                        index,
                                        "hex",
                                        event
                                          .target
                                          .value,
                                      )
                                    }
                                    className={`min-w-0 flex-1 rounded-xl border bg-black/15 px-3 py-2.5 text-xs text-white/60 outline-none disabled:opacity-35 ${
                                      hexValid
                                        ? "border-white/10 focus:border-[#c5a577]/35"
                                        : "border-red-300/30 focus:border-red-300/40"
                                    }`}
                                  />
                                </div>

                                {!hexValid && (
                                  <p className="mt-1 text-[9px] text-red-100/45">
                                    Use six-digit HEX, for example #C5A577.
                                  </p>
                                )}
                              </label>

                              <label>
                                <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                                  Usage %
                                </span>

                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={
                                    color
                                      .usagePercent ??
                                    ""
                                  }
                                  disabled={
                                    busy
                                  }
                                  onChange={(
                                    event,
                                  ) => {
                                    const value =
                                      event
                                        .target
                                        .value;

                                    updateColor(
                                      index,
                                      "usagePercent",
                                      value ===
                                        ""
                                        ? null
                                        : Number(
                                            value,
                                          ),
                                    );
                                  }}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs text-white/60 outline-none focus:border-[#c5a577]/35 disabled:opacity-35"
                                />
                              </label>
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <label>
                                <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                                  Brand Role
                                </span>

                                <input
                                  value={
                                    color
                                      .brandRole
                                  }
                                  disabled={
                                    busy
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateColor(
                                      index,
                                      "brandRole",
                                      event
                                        .target
                                        .value,
                                    )
                                  }
                                  placeholder="Primary Light, Accent..."
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs text-white/60 outline-none focus:border-[#c5a577]/35 disabled:opacity-35"
                                />
                              </label>

                              <label>
                                <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                                  Semantic Role
                                </span>

                                <input
                                  value={
                                    color
                                      .semanticRole
                                  }
                                  disabled={
                                    busy
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateColor(
                                      index,
                                      "semanticRole",
                                      event
                                        .target
                                        .value,
                                    )
                                  }
                                  placeholder="background, text, accent, surface..."
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs text-white/60 outline-none focus:border-[#c5a577]/35 disabled:opacity-35"
                                />
                              </label>
                            </div>

                            <label className="mt-4 block">
                              <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                                Production Rationale
                              </span>

                              <textarea
                                value={
                                  color
                                    .rationale
                                }
                                disabled={
                                  busy
                                }
                                rows={2}
                                onChange={(
                                  event,
                                ) =>
                                  updateColor(
                                    index,
                                    "rationale",
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs leading-6 text-white/55 outline-none focus:border-[#c5a577]/35 disabled:opacity-35"
                              />
                            </label>

                            <div className="mt-4 flex flex-wrap gap-2 text-[9px] uppercase tracking-[0.09em] text-white/25">
                              {rgb && (
                                <span className="rounded-full border border-white/10 px-3 py-1">
                                  RGB {rgb.r}, {rgb.g}, {rgb.b}
                                </span>
                              )}

                              {hsl && (
                                <span className="rounded-full border border-white/10 px-3 py-1">
                                  HSL {hsl.h}, {hsl.s}%, {hsl.l}%
                                </span>
                              )}

                              {luminance !==
                                null && (
                                <span className="rounded-full border border-white/10 px-3 py-1">
                                  Luminance {luminance.toFixed(3)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            )}

            {palette && (
              <div className="mt-7 grid gap-5 xl:grid-cols-2">
                <label>
                  <FieldLabel>
                    Usage Notes
                  </FieldLabel>

                  <textarea
                    value={
                      palette
                        .usageNotes
                    }
                    disabled={busy}
                    rows={5}
                    onChange={(
                      event,
                    ) =>
                      updatePaletteNote(
                        "usageNotes",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Define dominant colors, supporting neutrals, accents, and approximate visual distribution."
                    className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm leading-6 text-white/55 outline-none placeholder:text-white/15 focus:border-[#c5a577]/35 disabled:opacity-35"
                  />
                </label>

                <label>
                  <FieldLabel>
                    Application Notes
                  </FieldLabel>

                  <textarea
                    value={
                      palette
                        .applicationNotes
                    }
                    disabled={busy}
                    rows={5}
                    onChange={(
                      event,
                    ) =>
                      updatePaletteNote(
                        "applicationNotes",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Describe light/dark applications, UI surfaces, print behavior, and accent restraint."
                    className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm leading-6 text-white/55 outline-none placeholder:text-white/15 focus:border-[#c5a577]/35 disabled:opacity-35"
                  />
                </label>
              </div>
            )}

            <div className="mt-8 border-t border-white/[0.07] pt-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <FieldLabel>
                    Contrast Pairings
                  </FieldLabel>

                  <p className="mt-2 max-w-2xl text-xs leading-6 text-white/25">
                    Pairings stored here are deliberate production approvals, not every mathematically possible combination.
                  </p>
                </div>

                <p className="text-[10px] uppercase tracking-[0.12em] text-white/25">
                  {
                    palette
                      ?.approvedPairings
                      .length ??
                    0
                  }
                  {" "}approved pairings
                </p>
              </div>

              <div className="mt-5 space-y-4">
                {palette?.approvedPairings.map(
                  (
                    pairing,
                    index,
                  ) => (
                    <PairingCard
                      key={index}
                      pairing={
                        pairing
                      }
                      index={
                        index
                      }
                      colors={
                        palette.colors
                      }
                      disabled={
                        busy
                      }
                      onChange={
                        updatePairing
                      }
                      onRemove={
                        removePairing
                      }
                    />
                  ),
                )}

                {palette &&
                  palette
                    .approvedPairings
                    .length ===
                    0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-xs leading-6 text-white/20">
                    Assign valid color tokens, then add at least one accessible foreground/background pairing.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-7 rounded-2xl border border-white/[0.08] bg-black/10 p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <FieldLabel>
                    Colors
                  </FieldLabel>
                  <p className="mt-2 text-sm text-white/55">
                    {
                      palette
                        ?.colors
                        .length ??
                      0
                    }
                  </p>
                </div>

                <div>
                  <FieldLabel>
                    Usage
                  </FieldLabel>
                  <p className="mt-2 text-sm text-white/55">
                    {usageTotal.toFixed(1)}%
                  </p>
                </div>

                <div>
                  <FieldLabel>
                    Pairings
                  </FieldLabel>
                  <p className="mt-2 text-sm text-white/55">
                    {
                      palette
                        ?.approvedPairings
                        .length ??
                      0
                    }
                  </p>
                </div>

                <div>
                  <FieldLabel>
                    Gate
                  </FieldLabel>
                  <p className="mt-2 text-sm text-white/55">
                    {completion
                      ?.modules
                      .palette
                      ? "Passed"
                      : "Open"}
                  </p>
                </div>
              </div>

              {invalidPalette && (
                <p className="mt-4 text-xs leading-6 text-red-100/45">
                  Resolve invalid or duplicate palette values before saving.
                </p>
              )}

              {Math.abs(
                usageTotal - 100,
              ) > 0.01 && (
                <p className="mt-2 text-xs leading-6 text-amber-100/40">
                  Palette usage percentages must total exactly 100%.
                </p>
              )}
            </div>
          </div>

          <BrandTypeStudioPanel
            system={system}
            disabled={
              busy ||
              !workspace
                .draftSourceCurrent
            }
            onChange={(
              next,
            ) =>
              setSystem(next)
            }
          />

          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <ModuleCard
              title="Palette Studio"
              status={
                Boolean(
                  completion
                    ?.modules
                    .palette,
                )
              }
            >
              <p className="text-sm leading-7 text-white/35">
                Production palette controls are active: semantic roles, design tokens, usage ratios, deterministic color math, and WCAG-tested approved pairings.
              </p>

              <p className="mt-4 text-xs text-[#c5a577]/50">
                {
                  palette
                    ?.colors
                    .length ??
                  0
                }
                {" "}colors / {usageTotal.toFixed(1)}% usage
              </p>
            </ModuleCard>

            <ModuleCard
              title="Type Studio"
              status={
                Boolean(
                  completion
                    ?.modules
                    .typography,
                )
              }
            >
              <p className="text-sm leading-7 text-white/35">
                Production typography controls are active: font candidates, local availability checks, license status, live specimens, hierarchy rules, and the seven-role production scale.
              </p>

              <p className="mt-4 text-xs text-[#c5a577]/50">
                Remote font loading remains disabled; previews use the authored CSS stack only.
              </p>
            </ModuleCard>
          </div>

          <div className="mt-6 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-7">
            <FieldLabel>
              Studio Editorial Notes
            </FieldLabel>

            <textarea
              value={notes}
              onChange={(
                event,
              ) =>
                setNotes(
                  event
                    .target
                    .value,
                )
              }
              rows={4}
              maxLength={10000}
              placeholder="Record production-system decisions, unresolved questions, and handoff notes."
              className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm leading-6 text-white/60 outline-none placeholder:text-white/15 focus:border-[#c5a577]/35"
            />

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={
                  busy ||
                  invalidPalette ||
                  !workspace
                    .draftSourceCurrent
                }
                onClick={() =>
                  void saveFoundation()
                }
                className="rounded-xl border border-[#c5a577]/25 bg-[#c5a577]/[0.08] px-5 py-3 text-xs font-semibold text-[#c5a577]/75 transition hover:bg-[#c5a577]/[0.12] disabled:cursor-not-allowed disabled:opacity-30"
              >
                {busy
                  ? "Working..."
                  : "Save visual system"}
              </button>

              <button
                type="button"
                disabled={
                  busy ||
                  !completion
                    ?.ready ||
                  !workspace
                    .draftSourceCurrent
                }
                onClick={() =>
                  void approveDraft()
                }
                className="rounded-xl bg-[#c5a577] px-5 py-3 text-xs font-semibold text-[#11110f] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-25"
              >
                Approve visual system
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

            {!completion?.ready && (
              <p className="mt-3 text-[10px] leading-5 text-white/20">
                Approval remains locked until Palette Studio and Type Studio meet their production requirements.
              </p>
            )}
          </div>
        </>
      )}

      {workspace &&
        workspace.approved.length >
          0 && (
        <div className="mt-10 border-t border-white/[0.07] pt-7">
          <FieldLabel>
            Approved visual system history
          </FieldLabel>

          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workspace.approved.map(
              (version) => (
                <article
                  key={version.id}
                  className="rounded-2xl border border-white/[0.08] p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-white/60">
                      Visual System v
                      {
                        version
                          .version_number
                      }
                    </p>

                    <span className="text-[9px] uppercase tracking-[0.1em] text-emerald-100/45">
                      Approved
                    </span>
                  </div>

                  <p className="mt-3 text-[10px] leading-5 text-white/25">
                    Creative Direction v
                    {
                      version
                        .source_creative_direction_version_number
                    }
                    {" / "}
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

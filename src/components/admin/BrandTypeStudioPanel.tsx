"use client";

import {
  useMemo,
  useState,
} from "react";

import type {
  VisualFontCandidate,
  VisualSystem,
  VisualTypeRole,
  VisualTypeScaleItem,
} from "@/lib/visual-system";

type Availability =
  | "unchecked"
  | "available"
  | "missing";

type CandidateKey =
  | "displayCandidate"
  | "bodyCandidate";

const TYPE_ROLES:
  VisualTypeRole[] = [
    "display",
    "h1",
    "h2",
    "h3",
    "body",
    "small",
    "label",
  ];

const DISPLAY_ROLES =
  new Set<VisualTypeRole>([
    "display",
    "h1",
    "h2",
    "h3",
  ]);

function cloneSystem(
  system: VisualSystem,
): VisualSystem {
  return JSON.parse(
    JSON.stringify(system),
  ) as VisualSystem;
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

function parseWeights(
  value: string,
) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map(
          (item) =>
            Number.parseInt(
              item.trim(),
              10,
            ),
        )
        .filter(
          (weight) =>
            Number.isInteger(
              weight,
            ) &&
            weight >= 1 &&
            weight <= 1000,
        ),
    ),
  ).sort(
    (a, b) =>
      a - b,
  );
}

function seedScale():
  VisualTypeScaleItem[] {
  return [
    {
      role: "display",
      sizePx: 72,
      weight: 400,
      lineHeight: 0.95,
      letterSpacingEm: -0.035,
      transform: "none",
    },
    {
      role: "h1",
      sizePx: 52,
      weight: 400,
      lineHeight: 1.02,
      letterSpacingEm: -0.025,
      transform: "none",
    },
    {
      role: "h2",
      sizePx: 40,
      weight: 400,
      lineHeight: 1.08,
      letterSpacingEm: -0.018,
      transform: "none",
    },
    {
      role: "h3",
      sizePx: 28,
      weight: 500,
      lineHeight: 1.15,
      letterSpacingEm: -0.01,
      transform: "none",
    },
    {
      role: "body",
      sizePx: 17,
      weight: 400,
      lineHeight: 1.65,
      letterSpacingEm: 0,
      transform: "none",
    },
    {
      role: "small",
      sizePx: 14,
      weight: 400,
      lineHeight: 1.55,
      letterSpacingEm: 0,
      transform: "none",
    },
    {
      role: "label",
      sizePx: 11,
      weight: 600,
      lineHeight: 1.2,
      letterSpacingEm: 0.12,
      transform: "uppercase",
    },
  ];
}

function candidateReady(
  candidate:
    VisualFontCandidate,
) {
  return (
    candidate.family
      .trim().length > 0 &&
    candidate.cssStack
      .trim().length > 0 &&
    candidate.weights
      .length > 0 &&
    candidate.rationale
      .trim().length > 0 &&
    candidate.licenseStatus ===
      "verified"
  );
}

function AvailabilityBadge({
  value,
}: {
  value: Availability;
}) {
  const label =
    value === "available"
      ? "Available locally"
      : value === "missing"
        ? "Not detected locally"
        : "Not checked";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[9px] uppercase tracking-[0.1em] ${
        value === "available"
          ? "border-emerald-300/15 bg-emerald-300/[0.04] text-emerald-100/50"
          : value === "missing"
            ? "border-amber-300/15 bg-amber-300/[0.04] text-amber-100/45"
            : "border-white/10 text-white/25"
      }`}
    >
      {label}
    </span>
  );
}

export default function BrandTypeStudioPanel({
  system,
  disabled,
  onChange,
}: {
  system: VisualSystem;
  disabled: boolean;
  onChange: (
    next: VisualSystem,
  ) => void;
}) {
  const [
    availability,
    setAvailability,
  ] =
    useState<{
      display: Availability;
      body: Availability;
    }>({
      display:
        "unchecked",
      body:
        "unchecked",
    });

  const typography =
    system.typographySystem;

  const displayReady =
    candidateReady(
      typography
        .displayCandidate,
    );

  const bodyReady =
    candidateReady(
      typography
        .bodyCandidate,
    );

  const rolesPresent =
    useMemo(
      () =>
        new Set(
          typography.scale.map(
            (item) =>
              item.role,
          ),
        ),
      [typography.scale],
    );

  const allRolesPresent =
    TYPE_ROLES.every(
      (role) =>
        rolesPresent.has(role),
    );

  function updateCandidateText(
    key: CandidateKey,
    field:
      | "family"
      | "cssStack"
      | "rationale",
    value: string,
  ) {
    const next =
      cloneSystem(system);

    next.typographySystem[
      key
    ][field] = value;

    onChange(next);
  }

  function updateCandidateCategory(
    key: CandidateKey,
    value:
      VisualFontCandidate["category"],
  ) {
    const next =
      cloneSystem(system);

    next.typographySystem[
      key
    ].category = value;

    onChange(next);
  }

  function updateCandidateSource(
    key: CandidateKey,
    value:
      VisualFontCandidate["sourceType"],
  ) {
    const next =
      cloneSystem(system);

    next.typographySystem[
      key
    ].sourceType = value;

    onChange(next);
  }

  function updateCandidateLicense(
    key: CandidateKey,
    value:
      VisualFontCandidate["licenseStatus"],
  ) {
    const next =
      cloneSystem(system);

    next.typographySystem[
      key
    ].licenseStatus =
      value;

    onChange(next);
  }

  function updateCandidateWeights(
    key: CandidateKey,
    value: string,
  ) {
    const next =
      cloneSystem(system);

    next.typographySystem[
      key
    ].weights =
      parseWeights(value);

    onChange(next);
  }

  function seedProductionScale() {
    const next =
      cloneSystem(system);

    next.typographySystem
      .scale =
      seedScale();

    if (
      next.typographySystem
        .hierarchy.length ===
      0
    ) {
      next.typographySystem
        .hierarchy = [
        "Display, H1, H2, and H3 use the approved display family.",
        "Body and Small use the approved body family for sustained reading.",
        "Labels use the body family with controlled uppercase tracking.",
        "Large headings use restrained negative tracking to preserve editorial tension.",
        "Body copy prioritizes generous line-height and calm reading rhythm.",
      ];
    }

    onChange(next);
  }

  function updateScale(
    index: number,
    field:
      keyof VisualTypeScaleItem,
    value:
      string | number,
  ) {
    const next =
      cloneSystem(system);

    const item =
      next.typographySystem
        .scale[index];

    if (!item) {
      return;
    }

    if (
      field === "role"
    ) {
      item.role =
        value as
          VisualTypeRole;
    } else if (
      field ===
      "transform"
    ) {
      item.transform =
        value as
          VisualTypeScaleItem["transform"];
    } else if (
      field === "sizePx"
    ) {
      item.sizePx =
        Number(value);
    } else if (
      field === "weight"
    ) {
      item.weight =
        Number(value);
    } else if (
      field ===
      "lineHeight"
    ) {
      item.lineHeight =
        Number(value);
    } else if (
      field ===
      "letterSpacingEm"
    ) {
      item.letterSpacingEm =
        Number(value);
    }

    onChange(next);
  }

  function updateHierarchy(
    value: string,
  ) {
    const next =
      cloneSystem(system);

    next.typographySystem
      .hierarchy =
      value
        .split("\n")
        .map(
          (line) =>
            line.trim(),
        )
        .filter(Boolean);

    onChange(next);
  }

  function updateSpecimen(
    field:
      | "headline"
      | "body",
    value: string,
  ) {
    const next =
      cloneSystem(system);

    next.typographySystem
      .specimen[field] =
      value;

    onChange(next);
  }

  function updateUsageNotes(
    value: string,
  ) {
    const next =
      cloneSystem(system);

    next.typographySystem
      .usageNotes =
      value;

    onChange(next);
  }

  function checkLocalFonts() {
    function check(
      family: string,
    ): Availability {
      const clean =
        family
          .trim()
          .replace(
            /"/g,
            '\\"',
          );

      if (!clean) {
        return "missing";
      }

      return document.fonts.check(
        `16px "${clean}"`,
      )
        ? "available"
        : "missing";
    }

    setAvailability({
      display:
        check(
          typography
            .displayCandidate
            .family,
        ),

      body:
        check(
          typography
            .bodyCandidate
            .family,
        ),
    });
  }

  const displayStyle = {
    fontFamily:
      typography
        .displayCandidate
        .cssStack ||
      undefined,
  };

  const bodyStyle = {
    fontFamily:
      typography
        .bodyCandidate
        .cssStack ||
      undefined,
  };

  return (
    <div className="mt-8 rounded-3xl border border-[#c5a577]/15 bg-[#c5a577]/[0.025] p-6 sm:p-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <FieldLabel>
            Phase 6B.3
          </FieldLabel>

          <h3 className="mt-3 text-2xl font-medium tracking-[-0.03em] text-white/80">
            Type Studio
          </h3>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/35">
            Turn typography direction into a production pairing, licensing record, live specimen, and explicit type hierarchy. No remote font is fetched by this studio.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-3 py-1.5 text-[9px] uppercase tracking-[0.12em] ${
              displayReady
                ? "border-emerald-300/15 text-emerald-100/50"
                : "border-white/10 text-white/30"
            }`}
          >
            Display {
              displayReady
                ? "ready"
                : "open"
            }
          </span>

          <span
            className={`rounded-full border px-3 py-1.5 text-[9px] uppercase tracking-[0.12em] ${
              bodyReady
                ? "border-emerald-300/15 text-emerald-100/50"
                : "border-white/10 text-white/30"
            }`}
          >
            Body {
              bodyReady
                ? "ready"
                : "open"
            }
          </span>

          <span
            className={`rounded-full border px-3 py-1.5 text-[9px] uppercase tracking-[0.12em] ${
              allRolesPresent
                ? "border-emerald-300/15 text-emerald-100/50"
                : "border-white/10 text-white/30"
            }`}
          >
            Scale {
              allRolesPresent
                ? "ready"
                : "open"
            }
          </span>
        </div>
      </div>

      <div className="mt-7 grid gap-5 xl:grid-cols-2">
        {(
          [
            {
              key:
                "displayCandidate" as const,
              title:
                "Display Candidate",
              availability:
                availability.display,
              sourceDirection:
                system.sourceBrief
                  .typographyDirection
                  .displayStyle,
            },
            {
              key:
                "bodyCandidate" as const,
              title:
                "Body Candidate",
              availability:
                availability.body,
              sourceDirection:
                system.sourceBrief
                  .typographyDirection
                  .bodyStyle,
            },
          ]
        ).map(
          (candidateConfig) => {
            const candidate =
              typography[
                candidateConfig
                  .key
              ];

            return (
              <article
                key={
                  candidateConfig
                    .key
                }
                className="rounded-2xl border border-white/[0.08] bg-black/10 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <FieldLabel>
                      {
                        candidateConfig
                          .title
                      }
                    </FieldLabel>

                    <p className="mt-2 text-xs leading-5 text-white/25">
                      Direction: {
                        candidateConfig
                          .sourceDirection
                      }
                    </p>
                  </div>

                  <AvailabilityBadge
                    value={
                      candidateConfig
                        .availability
                    }
                  />
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                      Family
                    </span>

                    <input
                      value={
                        candidate.family
                      }
                      disabled={
                        disabled
                      }
                      onChange={(
                        event,
                      ) =>
                        updateCandidateText(
                          candidateConfig
                            .key,
                          "family",
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="Georgia"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs text-white/60 outline-none placeholder:text-white/15 focus:border-[#c5a577]/35 disabled:opacity-35"
                    />
                  </label>

                  <label>
                    <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                      Category
                    </span>

                    <select
                      value={
                        candidate.category
                      }
                      disabled={
                        disabled
                      }
                      onChange={(
                        event,
                      ) =>
                        updateCandidateCategory(
                          candidateConfig
                            .key,
                          event
                            .target
                            .value as
                            VisualFontCandidate["category"],
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#141411] px-3 py-2.5 text-xs text-white/60 outline-none focus:border-[#c5a577]/35 disabled:opacity-35"
                    >
                      <option value="serif">
                        Serif
                      </option>
                      <option value="sans-serif">
                        Sans Serif
                      </option>
                      <option value="display">
                        Display
                      </option>
                      <option value="monospace">
                        Monospace
                      </option>
                      <option value="other">
                        Other
                      </option>
                    </select>
                  </label>

                  <label className="sm:col-span-2">
                    <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                      CSS Stack
                    </span>

                    <input
                      value={
                        candidate
                          .cssStack
                      }
                      disabled={
                        disabled
                      }
                      onChange={(
                        event,
                      ) =>
                        updateCandidateText(
                          candidateConfig
                            .key,
                          "cssStack",
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder={'Georgia, "Times New Roman", serif'}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs text-white/60 outline-none placeholder:text-white/15 focus:border-[#c5a577]/35 disabled:opacity-35"
                    />
                  </label>

                  <label>
                    <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                      Source Type
                    </span>

                    <select
                      value={
                        candidate
                          .sourceType
                      }
                      disabled={
                        disabled
                      }
                      onChange={(
                        event,
                      ) =>
                        updateCandidateSource(
                          candidateConfig
                            .key,
                          event
                            .target
                            .value as
                            VisualFontCandidate["sourceType"],
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#141411] px-3 py-2.5 text-xs text-white/60 outline-none focus:border-[#c5a577]/35 disabled:opacity-35"
                    >
                      <option value="system">
                        System
                      </option>
                      <option value="uploaded">
                        Uploaded
                      </option>
                      <option value="reference">
                        Reference
                      </option>
                    </select>
                  </label>

                  <label>
                    <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                      License Status
                    </span>

                    <select
                      value={
                        candidate
                          .licenseStatus
                      }
                      disabled={
                        disabled
                      }
                      onChange={(
                        event,
                      ) =>
                        updateCandidateLicense(
                          candidateConfig
                            .key,
                          event
                            .target
                            .value as
                            VisualFontCandidate["licenseStatus"],
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#141411] px-3 py-2.5 text-xs text-white/60 outline-none focus:border-[#c5a577]/35 disabled:opacity-35"
                    >
                      <option value="needs-review">
                        Needs Review
                      </option>
                      <option value="verified">
                        Verified
                      </option>
                    </select>
                  </label>

                  <label className="sm:col-span-2">
                    <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                      Approved Weights
                    </span>

                    <input
                      value={
                        candidate.weights
                          .join(", ")
                      }
                      disabled={
                        disabled
                      }
                      onChange={(
                        event,
                      ) =>
                        updateCandidateWeights(
                          candidateConfig
                            .key,
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="400, 500, 600"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs text-white/60 outline-none placeholder:text-white/15 focus:border-[#c5a577]/35 disabled:opacity-35"
                    />
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                    Pairing Rationale
                  </span>

                  <textarea
                    value={
                      candidate.rationale
                    }
                    disabled={
                      disabled
                    }
                    rows={3}
                    onChange={(
                      event,
                    ) =>
                      updateCandidateText(
                        candidateConfig
                          .key,
                        "rationale",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Why this family supports the approved Creative Direction and production needs."
                    className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs leading-6 text-white/55 outline-none placeholder:text-white/15 focus:border-[#c5a577]/35 disabled:opacity-35"
                  />
                </label>
              </article>
            );
          },
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={
            checkLocalFonts
          }
          className="rounded-xl border border-white/10 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40 transition hover:border-[#c5a577]/25 hover:text-[#c5a577]/65 disabled:opacity-30"
        >
          Check local fonts
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={
            seedProductionScale
          }
          className="rounded-xl border border-white/10 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40 transition hover:border-[#c5a577]/25 hover:text-[#c5a577]/65 disabled:opacity-30"
        >
          Seed production scale
        </button>
      </div>

      <div className="mt-8 rounded-2xl border border-white/[0.08] bg-black/10 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <FieldLabel>
              Live Specimen
            </FieldLabel>

            <p className="mt-2 text-xs leading-5 text-white/25">
              CSS stacks preview locally only. This panel does not request Google Fonts, Adobe Fonts, or any other remote type service.
            </p>
          </div>

          <p className="text-[9px] uppercase tracking-[0.1em] text-white/20">
            Browser-local preview
          </p>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#f2ece2] p-6 text-[#2a211c] sm:p-8">
          <p
            style={
              displayStyle
            }
            className="text-4xl leading-[1.02] tracking-[-0.03em] sm:text-5xl"
          >
            {
              typography
                .specimen
                .headline ||
              "Aster House"
            }
          </p>

          <p
            style={
              bodyStyle
            }
            className="mt-5 max-w-2xl text-base leading-7"
          >
            {
              typography
                .specimen
                .body ||
              "A calm editorial system where architecture, material warmth, and lived-in detail meet."
            }
          </p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <label>
            <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
              Specimen Headline
            </span>

            <input
              value={
                typography
                  .specimen
                  .headline
              }
              disabled={
                disabled
              }
              onChange={(
                event,
              ) =>
                updateSpecimen(
                  "headline",
                  event
                    .target
                    .value,
                )
              }
              placeholder="Aster House"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs text-white/60 outline-none placeholder:text-white/15 focus:border-[#c5a577]/35 disabled:opacity-35"
            />
          </label>

          <label>
            <span className="text-[9px] uppercase tracking-[0.12em] text-white/20">
              Specimen Body
            </span>

            <input
              value={
                typography
                  .specimen
                  .body
              }
              disabled={
                disabled
              }
              onChange={(
                event,
              ) =>
                updateSpecimen(
                  "body",
                  event
                    .target
                    .value,
                )
              }
              placeholder="A calm editorial system..."
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs text-white/60 outline-none placeholder:text-white/15 focus:border-[#c5a577]/35 disabled:opacity-35"
            />
          </label>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <FieldLabel>
              Production Scale
            </FieldLabel>

            <p className="mt-2 text-xs leading-5 text-white/25">
              Display through H3 use the display candidate. Body, Small, and Label use the body candidate.
            </p>
          </div>

          <span
            className={`rounded-full border px-3 py-1 text-[9px] uppercase tracking-[0.1em] ${
              allRolesPresent
                ? "border-emerald-300/15 text-emerald-100/50"
                : "border-white/10 text-white/25"
            }`}
          >
            {
              rolesPresent.size
            }
            /7 roles
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {typography.scale.map(
            (
              item,
              index,
            ) => {
              const family =
                DISPLAY_ROLES.has(
                  item.role,
                )
                  ? typography
                      .displayCandidate
                      .cssStack
                  : typography
                      .bodyCandidate
                      .cssStack;

              return (
                <article
                  key={`${item.role}-${index}`}
                  className="rounded-2xl border border-white/[0.08] bg-black/10 p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                    <label>
                      <span className="text-[9px] uppercase tracking-[0.1em] text-white/20">
                        Role
                      </span>

                      <select
                        value={
                          item.role
                        }
                        disabled={
                          disabled
                        }
                        onChange={(
                          event,
                        ) =>
                          updateScale(
                            index,
                            "role",
                            event
                              .target
                              .value,
                          )
                        }
                        className="mt-2 w-full rounded-lg border border-white/10 bg-[#141411] px-2.5 py-2 text-[10px] text-white/55 outline-none disabled:opacity-35"
                      >
                        {TYPE_ROLES.map(
                          (role) => (
                            <option
                              key={
                                role
                              }
                              value={
                                role
                              }
                            >
                              {role}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    <label>
                      <span className="text-[9px] uppercase tracking-[0.1em] text-white/20">
                        Size px
                      </span>

                      <input
                        type="number"
                        min="1"
                        value={
                          item.sizePx
                        }
                        disabled={
                          disabled
                        }
                        onChange={(
                          event,
                        ) =>
                          updateScale(
                            index,
                            "sizePx",
                            Number(
                              event
                                .target
                                .value,
                            ),
                          )
                        }
                        className="mt-2 w-full rounded-lg border border-white/10 bg-black/15 px-2.5 py-2 text-[10px] text-white/55 outline-none disabled:opacity-35"
                      />
                    </label>

                    <label>
                      <span className="text-[9px] uppercase tracking-[0.1em] text-white/20">
                        Weight
                      </span>

                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={
                          item.weight
                        }
                        disabled={
                          disabled
                        }
                        onChange={(
                          event,
                        ) =>
                          updateScale(
                            index,
                            "weight",
                            Number(
                              event
                                .target
                                .value,
                            ),
                          )
                        }
                        className="mt-2 w-full rounded-lg border border-white/10 bg-black/15 px-2.5 py-2 text-[10px] text-white/55 outline-none disabled:opacity-35"
                      />
                    </label>

                    <label>
                      <span className="text-[9px] uppercase tracking-[0.1em] text-white/20">
                        Line Height
                      </span>

                      <input
                        type="number"
                        min="0.1"
                        max="4"
                        step="0.01"
                        value={
                          item.lineHeight
                        }
                        disabled={
                          disabled
                        }
                        onChange={(
                          event,
                        ) =>
                          updateScale(
                            index,
                            "lineHeight",
                            Number(
                              event
                                .target
                                .value,
                            ),
                          )
                        }
                        className="mt-2 w-full rounded-lg border border-white/10 bg-black/15 px-2.5 py-2 text-[10px] text-white/55 outline-none disabled:opacity-35"
                      />
                    </label>

                    <label>
                      <span className="text-[9px] uppercase tracking-[0.1em] text-white/20">
                        Tracking em
                      </span>

                      <input
                        type="number"
                        min="-1"
                        max="1"
                        step="0.005"
                        value={
                          item
                            .letterSpacingEm
                        }
                        disabled={
                          disabled
                        }
                        onChange={(
                          event,
                        ) =>
                          updateScale(
                            index,
                            "letterSpacingEm",
                            Number(
                              event
                                .target
                                .value,
                            ),
                          )
                        }
                        className="mt-2 w-full rounded-lg border border-white/10 bg-black/15 px-2.5 py-2 text-[10px] text-white/55 outline-none disabled:opacity-35"
                      />
                    </label>

                    <label>
                      <span className="text-[9px] uppercase tracking-[0.1em] text-white/20">
                        Transform
                      </span>

                      <select
                        value={
                          item.transform
                        }
                        disabled={
                          disabled
                        }
                        onChange={(
                          event,
                        ) =>
                          updateScale(
                            index,
                            "transform",
                            event
                              .target
                              .value,
                          )
                        }
                        className="mt-2 w-full rounded-lg border border-white/10 bg-[#141411] px-2.5 py-2 text-[10px] text-white/55 outline-none disabled:opacity-35"
                      >
                        <option value="none">
                          None
                        </option>
                        <option value="uppercase">
                          Uppercase
                        </option>
                        <option value="lowercase">
                          Lowercase
                        </option>
                        <option value="capitalize">
                          Capitalize
                        </option>
                      </select>
                    </label>
                  </div>

                  <p
                    style={{
                      fontFamily:
                        family ||
                        undefined,
                      fontSize:
                        `${Math.min(item.sizePx, 48)}px`,
                      fontWeight:
                        item.weight,
                      lineHeight:
                        item.lineHeight,
                      letterSpacing:
                        `${item.letterSpacingEm}em`,
                      textTransform:
                        item.transform,
                    }}
                    className="mt-4 overflow-hidden text-white/55"
                  >
                    {item.role} / Aster House visual rhythm
                  </p>
                </article>
              );
            },
          )}

          {typography.scale.length ===
            0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-xs leading-6 text-white/20">
              Use Seed production scale to establish the seven required roles, then refine each role intentionally.
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        <label>
          <FieldLabel>
            Hierarchy Rules
          </FieldLabel>

          <textarea
            value={
              typography.hierarchy
                .join("\n")
            }
            disabled={
              disabled
            }
            rows={7}
            onChange={(
              event,
            ) =>
              updateHierarchy(
                event
                  .target
                  .value,
              )
            }
            placeholder="One production hierarchy rule per line."
            className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm leading-6 text-white/55 outline-none placeholder:text-white/15 focus:border-[#c5a577]/35 disabled:opacity-35"
          />
        </label>

        <label>
          <FieldLabel>
            Typography Usage Notes
          </FieldLabel>

          <textarea
            value={
              typography
                .usageNotes
            }
            disabled={
              disabled
            }
            rows={7}
            onChange={(
              event,
            ) =>
              updateUsageNotes(
                event
                  .target
                  .value,
              )
            }
            placeholder="Define when each family is used, restraint rules, accessibility considerations, and production caveats."
            className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm leading-6 text-white/55 outline-none placeholder:text-white/15 focus:border-[#c5a577]/35 disabled:opacity-35"
          />
        </label>
      </div>

      <div className="mt-7 rounded-2xl border border-white/[0.08] bg-black/10 p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <FieldLabel>
              Display
            </FieldLabel>

            <p className="mt-2 text-sm text-white/55">
              {
                displayReady
                  ? "Ready"
                  : "Open"
              }
            </p>
          </div>

          <div>
            <FieldLabel>
              Body
            </FieldLabel>

            <p className="mt-2 text-sm text-white/55">
              {
                bodyReady
                  ? "Ready"
                  : "Open"
              }
            </p>
          </div>

          <div>
            <FieldLabel>
              Scale
            </FieldLabel>

            <p className="mt-2 text-sm text-white/55">
              {
                rolesPresent.size
              }
              /7 roles
            </p>
          </div>

          <div>
            <FieldLabel>
              License Gate
            </FieldLabel>

            <p className="mt-2 text-sm text-white/55">
              {
                typography
                  .displayCandidate
                  .licenseStatus ===
                    "verified" &&
                typography
                  .bodyCandidate
                  .licenseStatus ===
                    "verified"
                  ? "Verified"
                  : "Review required"
              }
            </p>
          </div>
        </div>

        <p className="mt-4 text-[10px] leading-5 text-white/20">
          Mark a font Verified only after its intended production use is confirmed. Local availability is informational and does not prove licensing.
        </p>
      </div>
    </div>
  );
}

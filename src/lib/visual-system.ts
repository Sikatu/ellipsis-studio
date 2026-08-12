import type {
  CreativeDirection,
} from "@/lib/creative-direction";

export type VisualSystemColor = {
  name: string;
  token: string;
  hex: string;
  brandRole: string;
  semanticRole: string;
  usagePercent: number | null;
  rationale: string;
};

export type VisualSystemPairing = {
  foregroundToken: string;
  backgroundToken: string;
  purpose: string;
};

export type VisualFontCategory =
  | "serif"
  | "sans-serif"
  | "display"
  | "monospace"
  | "other";

export type VisualFontSourceType =
  | "system"
  | "uploaded"
  | "reference";

export type VisualFontLicenseStatus =
  | "verified"
  | "needs-review";

export type VisualFontCandidate = {
  family: string;
  category: VisualFontCategory;
  cssStack: string;
  sourceType: VisualFontSourceType;
  licenseStatus: VisualFontLicenseStatus;
  weights: number[];
  rationale: string;
};

export type VisualTypeRole =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "body"
  | "small"
  | "label";

export type VisualTypeScaleItem = {
  role: VisualTypeRole;
  sizePx: number;
  weight: number;
  lineHeight: number;
  letterSpacingEm: number;
  transform:
    | "none"
    | "uppercase"
    | "lowercase"
    | "capitalize";
};

export type VisualSystem = {
  schemaVersion: 1;

  sourceBrief: {
    colorDirection: {
      summary: string;
      palette: Array<{
        name: string;
        role: string;
        hex: string;
        rationale: string;
      }>;
      notes: string;
    };

    typographyDirection: {
      summary: string;
      displayStyle: string;
      bodyStyle: string;
      hierarchy: string[];
      notes: string;
    };
  };

  paletteSystem: {
    colors: VisualSystemColor[];
    approvedPairings: VisualSystemPairing[];
    usageNotes: string;
    applicationNotes: string;
  };

  typographySystem: {
    displayCandidate: VisualFontCandidate;
    bodyCandidate: VisualFontCandidate;
    scale: VisualTypeScaleItem[];
    hierarchy: string[];
    specimen: {
      headline: string;
      body: string;
    };
    usageNotes: string;
  };
};

export type VisualSystemStatus =
  | "draft"
  | "approved";

export type VisualSystemVersion = {
  id: string;
  project_id: string;
  version_number: number;
  status: VisualSystemStatus;
  source_creative_direction_version_id: string;
  source_creative_direction_version_number: number;
  system: VisualSystem;
  editorial_notes: string;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VisualSystemCompletion = {
  completeCount: number;
  moduleCount: number;
  ready: boolean;
  modules: {
    palette: boolean;
    typography: boolean;
  };
};

export type RGBColor = {
  r: number;
  g: number;
  b: number;
};

export type HSLColor = {
  h: number;
  s: number;
  l: number;
};

export type WCAGContrastResult = {
  ratio: number;
  normalText:
    | "AAA"
    | "AA"
    | "fail";
  largeText:
    | "AAA"
    | "AA"
    | "fail";
};

const HEX_PATTERN =
  /^#[0-9a-f]{6}$/i;

const TOKEN_PATTERN =
  /^--[a-z0-9]+(?:-[a-z0-9]+)*$/;

const FONT_CATEGORIES =
  new Set<VisualFontCategory>([
    "serif",
    "sans-serif",
    "display",
    "monospace",
    "other",
  ]);

const FONT_SOURCE_TYPES =
  new Set<VisualFontSourceType>([
    "system",
    "uploaded",
    "reference",
  ]);

const FONT_LICENSE_STATUSES =
  new Set<VisualFontLicenseStatus>([
    "verified",
    "needs-review",
  ]);

const TYPE_ROLES =
  new Set<VisualTypeRole>([
    "display",
    "h1",
    "h2",
    "h3",
    "body",
    "small",
    "label",
  ]);

const TYPE_TRANSFORMS =
  new Set<
    VisualTypeScaleItem["transform"]
  >([
    "none",
    "uppercase",
    "lowercase",
    "capitalize",
  ]);

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function requireRecord(
  value: unknown,
  path: string,
) {
  if (!isRecord(value)) {
    throw new Error(
      `Visual system is invalid at ${path}.`,
    );
  }

  return value;
}

function requireString(
  value: unknown,
  path: string,
) {
  if (
    typeof value !== "string"
  ) {
    throw new Error(
      `Visual system is invalid at ${path}.`,
    );
  }

  return value;
}

function requireStringArray(
  value: unknown,
  path: string,
) {
  if (
    !Array.isArray(value) ||
    !value.every(
      (item) =>
        typeof item ===
        "string",
    )
  ) {
    throw new Error(
      `Visual system is invalid at ${path}.`,
    );
  }

  return value;
}

function requireNumber(
  value: unknown,
  path: string,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    throw new Error(
      `Visual system is invalid at ${path}.`,
    );
  }

  return value;
}

function requireNullableNumber(
  value: unknown,
  path: string,
) {
  if (value === null) {
    return null;
  }

  return requireNumber(
    value,
    path,
  );
}

function assertOnlyKeys(
  value: Record<
    string,
    unknown
  >,
  allowed: string[],
  path: string,
) {
  const allowedSet =
    new Set(allowed);

  const unexpected =
    Object.keys(value).find(
      (key) =>
        !allowedSet.has(key),
    );

  if (unexpected) {
    throw new Error(
      `Visual system contains an unexpected field at ${path}.${unexpected}.`,
    );
  }
}

function parseSourcePalette(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    throw new Error(
      "Visual system is invalid at sourceBrief.colorDirection.palette.",
    );
  }

  return value.map(
    (item, index) => {
      const row =
        requireRecord(
          item,
          `sourceBrief.colorDirection.palette[${index}]`,
        );

      assertOnlyKeys(
        row,
        [
          "name",
          "role",
          "hex",
          "rationale",
        ],
        `sourceBrief.colorDirection.palette[${index}]`,
      );

      const hex =
        requireString(
          row.hex,
          `sourceBrief.colorDirection.palette[${index}].hex`,
        )
          .trim()
          .toUpperCase();

      if (
        !HEX_PATTERN.test(hex)
      ) {
        throw new Error(
          `Visual system contains an invalid source HEX value at sourceBrief.colorDirection.palette[${index}].hex.`,
        );
      }

      return {
        name:
          requireString(
            row.name,
            `sourceBrief.colorDirection.palette[${index}].name`,
          ),

        role:
          requireString(
            row.role,
            `sourceBrief.colorDirection.palette[${index}].role`,
          ),

        hex,

        rationale:
          requireString(
            row.rationale,
            `sourceBrief.colorDirection.palette[${index}].rationale`,
          ),
      };
    },
  );
}

function parseSystemColors(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    throw new Error(
      "Visual system is invalid at paletteSystem.colors.",
    );
  }

  return value.map(
    (item, index) => {
      const row =
        requireRecord(
          item,
          `paletteSystem.colors[${index}]`,
        );

      assertOnlyKeys(
        row,
        [
          "name",
          "token",
          "hex",
          "brandRole",
          "semanticRole",
          "usagePercent",
          "rationale",
        ],
        `paletteSystem.colors[${index}]`,
      );

      const token =
        requireString(
          row.token,
          `paletteSystem.colors[${index}].token`,
        ).trim();

      if (
        token &&
        !TOKEN_PATTERN.test(token)
      ) {
        throw new Error(
          `Visual system contains an invalid design token at paletteSystem.colors[${index}].token.`,
        );
      }

      const hex =
        requireString(
          row.hex,
          `paletteSystem.colors[${index}].hex`,
        )
          .trim()
          .toUpperCase();

      if (
        !HEX_PATTERN.test(hex)
      ) {
        throw new Error(
          `Visual system contains an invalid HEX value at paletteSystem.colors[${index}].hex.`,
        );
      }

      const usagePercent =
        requireNullableNumber(
          row.usagePercent,
          `paletteSystem.colors[${index}].usagePercent`,
        );

      if (
        usagePercent !== null &&
        (
          usagePercent < 0 ||
          usagePercent > 100
        )
      ) {
        throw new Error(
          `Visual system contains an invalid usage percentage at paletteSystem.colors[${index}].usagePercent.`,
        );
      }

      return {
        name:
          requireString(
            row.name,
            `paletteSystem.colors[${index}].name`,
          ),

        token,

        hex,

        brandRole:
          requireString(
            row.brandRole,
            `paletteSystem.colors[${index}].brandRole`,
          ),

        semanticRole:
          requireString(
            row.semanticRole,
            `paletteSystem.colors[${index}].semanticRole`,
          ),

        usagePercent,

        rationale:
          requireString(
            row.rationale,
            `paletteSystem.colors[${index}].rationale`,
          ),
      };
    },
  );
}

function parsePairings(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    throw new Error(
      "Visual system is invalid at paletteSystem.approvedPairings.",
    );
  }

  return value.map(
    (item, index) => {
      const row =
        requireRecord(
          item,
          `paletteSystem.approvedPairings[${index}]`,
        );

      assertOnlyKeys(
        row,
        [
          "foregroundToken",
          "backgroundToken",
          "purpose",
        ],
        `paletteSystem.approvedPairings[${index}]`,
      );

      return {
        foregroundToken:
          requireString(
            row.foregroundToken,
            `paletteSystem.approvedPairings[${index}].foregroundToken`,
          ),

        backgroundToken:
          requireString(
            row.backgroundToken,
            `paletteSystem.approvedPairings[${index}].backgroundToken`,
          ),

        purpose:
          requireString(
            row.purpose,
            `paletteSystem.approvedPairings[${index}].purpose`,
          ),
      };
    },
  );
}

function parseFontCandidate(
  value: unknown,
  path: string,
): VisualFontCandidate {
  const row =
    requireRecord(
      value,
      path,
    );

  assertOnlyKeys(
    row,
    [
      "family",
      "category",
      "cssStack",
      "sourceType",
      "licenseStatus",
      "weights",
      "rationale",
    ],
    path,
  );

  if (
    typeof row.category !==
      "string" ||
    !FONT_CATEGORIES.has(
      row.category as
        VisualFontCategory,
    )
  ) {
    throw new Error(
      `Visual system is invalid at ${path}.category.`,
    );
  }

  if (
    typeof row.sourceType !==
      "string" ||
    !FONT_SOURCE_TYPES.has(
      row.sourceType as
        VisualFontSourceType,
    )
  ) {
    throw new Error(
      `Visual system is invalid at ${path}.sourceType.`,
    );
  }

  if (
    typeof row.licenseStatus !==
      "string" ||
    !FONT_LICENSE_STATUSES.has(
      row.licenseStatus as
        VisualFontLicenseStatus,
    )
  ) {
    throw new Error(
      `Visual system is invalid at ${path}.licenseStatus.`,
    );
  }

  if (
    !Array.isArray(row.weights) ||
    !row.weights.every(
      (weight) =>
        typeof weight ===
          "number" &&
        Number.isInteger(weight) &&
        weight >= 1 &&
        weight <= 1000,
    )
  ) {
    throw new Error(
      `Visual system is invalid at ${path}.weights.`,
    );
  }

  return {
    family:
      requireString(
        row.family,
        `${path}.family`,
      ),

    category:
      row.category as
        VisualFontCategory,

    cssStack:
      requireString(
        row.cssStack,
        `${path}.cssStack`,
      ),

    sourceType:
      row.sourceType as
        VisualFontSourceType,

    licenseStatus:
      row.licenseStatus as
        VisualFontLicenseStatus,

    weights:
      row.weights,

    rationale:
      requireString(
        row.rationale,
        `${path}.rationale`,
      ),
  };
}

function parseScale(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    throw new Error(
      "Visual system is invalid at typographySystem.scale.",
    );
  }

  return value.map(
    (item, index) => {
      const path =
        `typographySystem.scale[${index}]`;

      const row =
        requireRecord(
          item,
          path,
        );

      assertOnlyKeys(
        row,
        [
          "role",
          "sizePx",
          "weight",
          "lineHeight",
          "letterSpacingEm",
          "transform",
        ],
        path,
      );

      if (
        typeof row.role !==
          "string" ||
        !TYPE_ROLES.has(
          row.role as
            VisualTypeRole,
        )
      ) {
        throw new Error(
          `Visual system is invalid at ${path}.role.`,
        );
      }

      if (
        typeof row.transform !==
          "string" ||
        !TYPE_TRANSFORMS.has(
          row.transform as
            VisualTypeScaleItem["transform"],
        )
      ) {
        throw new Error(
          `Visual system is invalid at ${path}.transform.`,
        );
      }

      const sizePx =
        requireNumber(
          row.sizePx,
          `${path}.sizePx`,
        );

      const weight =
        requireNumber(
          row.weight,
          `${path}.weight`,
        );

      const lineHeight =
        requireNumber(
          row.lineHeight,
          `${path}.lineHeight`,
        );

      const letterSpacingEm =
        requireNumber(
          row.letterSpacingEm,
          `${path}.letterSpacingEm`,
        );

      if (
        sizePx <= 0 ||
        weight < 1 ||
        weight > 1000 ||
        lineHeight <= 0 ||
        lineHeight > 4 ||
        letterSpacingEm < -1 ||
        letterSpacingEm > 1
      ) {
        throw new Error(
          `Visual system contains an out-of-range typography value at ${path}.`,
        );
      }

      return {
        role:
          row.role as
            VisualTypeRole,

        sizePx,
        weight,
        lineHeight,
        letterSpacingEm,

        transform:
          row.transform as
            VisualTypeScaleItem["transform"],
      };
    },
  );
}

export function normalizeHex(
  value: string,
) {
  const hex =
    value.trim().toUpperCase();

  return HEX_PATTERN.test(hex)
    ? hex
    : null;
}

export function hexToRgb(
  value: string,
): RGBColor | null {
  const hex =
    normalizeHex(value);

  if (!hex) {
    return null;
  }

  return {
    r:
      Number.parseInt(
        hex.slice(1, 3),
        16,
      ),

    g:
      Number.parseInt(
        hex.slice(3, 5),
        16,
      ),

    b:
      Number.parseInt(
        hex.slice(5, 7),
        16,
      ),
  };
}

export function rgbToHsl(
  color: RGBColor,
): HSLColor {
  const r =
    color.r / 255;

  const g =
    color.g / 255;

  const b =
    color.b / 255;

  const max =
    Math.max(r, g, b);

  const min =
    Math.min(r, g, b);

  const delta =
    max - min;

  let h = 0;

  if (delta !== 0) {
    if (max === r) {
      h =
        60 *
        (
          (
            (g - b) /
            delta
          ) % 6
        );
    } else if (
      max === g
    ) {
      h =
        60 *
        (
          (b - r) /
          delta +
          2
        );
    } else {
      h =
        60 *
        (
          (r - g) /
          delta +
          4
        );
    }
  }

  if (h < 0) {
    h += 360;
  }

  const l =
    (max + min) / 2;

  const s =
    delta === 0
      ? 0
      : delta /
        (
          1 -
          Math.abs(
            2 * l - 1,
          )
        );

  return {
    h:
      Math.round(
        h * 10,
      ) / 10,

    s:
      Math.round(
        s * 1000,
      ) / 10,

    l:
      Math.round(
        l * 1000,
      ) / 10,
  };
}

function linearizeChannel(
  value: number,
) {
  const channel =
    value / 255;

  return channel <=
    0.04045
    ? channel / 12.92
    : Math.pow(
        (
          channel +
          0.055
        ) / 1.055,
        2.4,
      );
}

export function relativeLuminance(
  value: string,
) {
  const rgb =
    hexToRgb(value);

  if (!rgb) {
    return null;
  }

  return (
    0.2126 *
      linearizeChannel(
        rgb.r,
      ) +
    0.7152 *
      linearizeChannel(
        rgb.g,
      ) +
    0.0722 *
      linearizeChannel(
        rgb.b,
      )
  );
}

export function contrastRatio(
  foreground: string,
  background: string,
) {
  const foregroundLuminance =
    relativeLuminance(
      foreground,
    );

  const backgroundLuminance =
    relativeLuminance(
      background,
    );

  if (
    foregroundLuminance ===
      null ||
    backgroundLuminance ===
      null
  ) {
    return null;
  }

  const lighter =
    Math.max(
      foregroundLuminance,
      backgroundLuminance,
    );

  const darker =
    Math.min(
      foregroundLuminance,
      backgroundLuminance,
    );

  return (
    Math.round(
      (
        (
          lighter + 0.05
        ) /
        (
          darker + 0.05
        )
      ) *
        100,
    ) / 100
  );
}

export function wcagContrastResult(
  foreground: string,
  background: string,
): WCAGContrastResult | null {
  const ratio =
    contrastRatio(
      foreground,
      background,
    );

  if (ratio === null) {
    return null;
  }

  return {
    ratio,

    normalText:
      ratio >= 7
        ? "AAA"
        : ratio >= 4.5
          ? "AA"
          : "fail",

    largeText:
      ratio >= 4.5
        ? "AAA"
        : ratio >= 3
          ? "AA"
          : "fail",
  };
}

export function buildVisualSystemSeed(
  direction: CreativeDirection,
): VisualSystem {
  return {
    schemaVersion: 1,

    sourceBrief: {
      colorDirection: {
        summary:
          direction
            .colorDirection
            .summary,

        palette:
          direction
            .colorDirection
            .palette
            .map(
              (color) => ({
                name:
                  color.name,

                role:
                  color.role,

                hex:
                  color.hex
                    .trim()
                    .toUpperCase(),

                rationale:
                  color.rationale,
              }),
            ),

        notes:
          direction
            .colorDirection
            .notes,
      },

      typographyDirection: {
        summary:
          direction
            .typographyDirection
            .summary,

        displayStyle:
          direction
            .typographyDirection
            .displayStyle,

        bodyStyle:
          direction
            .typographyDirection
            .bodyStyle,

        hierarchy:
          [
            ...direction
              .typographyDirection
              .hierarchy,
          ],

        notes:
          direction
            .typographyDirection
            .notes,
      },
    },

    paletteSystem: {
      colors:
        direction
          .colorDirection
          .palette
          .map(
            (color) => ({
              name:
                color.name,

              token: "",

              hex:
                color.hex
                  .trim()
                  .toUpperCase(),

              brandRole:
                color.role,

              semanticRole: "",

              usagePercent:
                null,

              rationale:
                color.rationale,
            }),
          ),

      approvedPairings: [],
      usageNotes: "",
      applicationNotes: "",
    },

    typographySystem: {
      displayCandidate: {
        family: "",
        category: "other",
        cssStack: "",
        sourceType: "reference",
        licenseStatus:
          "needs-review",
        weights: [],
        rationale: "",
      },

      bodyCandidate: {
        family: "",
        category: "other",
        cssStack: "",
        sourceType: "reference",
        licenseStatus:
          "needs-review",
        weights: [],
        rationale: "",
      },

      scale: [],
      hierarchy: [],

      specimen: {
        headline: "",
        body: "",
      },

      usageNotes: "",
    },
  };
}

export function parseVisualSystem(
  value: unknown,
): VisualSystem {
  const root =
    requireRecord(
      value,
      "root",
    );

  assertOnlyKeys(
    root,
    [
      "schemaVersion",
      "sourceBrief",
      "paletteSystem",
      "typographySystem",
    ],
    "root",
  );

  if (
    root.schemaVersion !== 1
  ) {
    throw new Error(
      "Visual system schema version is unsupported.",
    );
  }

  const sourceBrief =
    requireRecord(
      root.sourceBrief,
      "sourceBrief",
    );

  const colorDirection =
    requireRecord(
      sourceBrief
        .colorDirection,
      "sourceBrief.colorDirection",
    );

  const typographyDirection =
    requireRecord(
      sourceBrief
        .typographyDirection,
      "sourceBrief.typographyDirection",
    );

  const paletteSystem =
    requireRecord(
      root.paletteSystem,
      "paletteSystem",
    );

  const typographySystem =
    requireRecord(
      root.typographySystem,
      "typographySystem",
    );

  const specimen =
    requireRecord(
      typographySystem
        .specimen,
      "typographySystem.specimen",
    );

  assertOnlyKeys(
    sourceBrief,
    [
      "colorDirection",
      "typographyDirection",
    ],
    "sourceBrief",
  );

  assertOnlyKeys(
    colorDirection,
    [
      "summary",
      "palette",
      "notes",
    ],
    "sourceBrief.colorDirection",
  );

  assertOnlyKeys(
    typographyDirection,
    [
      "summary",
      "displayStyle",
      "bodyStyle",
      "hierarchy",
      "notes",
    ],
    "sourceBrief.typographyDirection",
  );

  assertOnlyKeys(
    paletteSystem,
    [
      "colors",
      "approvedPairings",
      "usageNotes",
      "applicationNotes",
    ],
    "paletteSystem",
  );

  assertOnlyKeys(
    typographySystem,
    [
      "displayCandidate",
      "bodyCandidate",
      "scale",
      "hierarchy",
      "specimen",
      "usageNotes",
    ],
    "typographySystem",
  );

  assertOnlyKeys(
    specimen,
    [
      "headline",
      "body",
    ],
    "typographySystem.specimen",
  );

  return {
    schemaVersion: 1,

    sourceBrief: {
      colorDirection: {
        summary:
          requireString(
            colorDirection
              .summary,
            "sourceBrief.colorDirection.summary",
          ),

        palette:
          parseSourcePalette(
            colorDirection
              .palette,
          ),

        notes:
          requireString(
            colorDirection
              .notes,
            "sourceBrief.colorDirection.notes",
          ),
      },

      typographyDirection: {
        summary:
          requireString(
            typographyDirection
              .summary,
            "sourceBrief.typographyDirection.summary",
          ),

        displayStyle:
          requireString(
            typographyDirection
              .displayStyle,
            "sourceBrief.typographyDirection.displayStyle",
          ),

        bodyStyle:
          requireString(
            typographyDirection
              .bodyStyle,
            "sourceBrief.typographyDirection.bodyStyle",
          ),

        hierarchy:
          requireStringArray(
            typographyDirection
              .hierarchy,
            "sourceBrief.typographyDirection.hierarchy",
          ),

        notes:
          requireString(
            typographyDirection
              .notes,
            "sourceBrief.typographyDirection.notes",
          ),
      },
    },

    paletteSystem: {
      colors:
        parseSystemColors(
          paletteSystem
            .colors,
        ),

      approvedPairings:
        parsePairings(
          paletteSystem
            .approvedPairings,
        ),

      usageNotes:
        requireString(
          paletteSystem
            .usageNotes,
          "paletteSystem.usageNotes",
        ),

      applicationNotes:
        requireString(
          paletteSystem
            .applicationNotes,
          "paletteSystem.applicationNotes",
        ),
    },

    typographySystem: {
      displayCandidate:
        parseFontCandidate(
          typographySystem
            .displayCandidate,
          "typographySystem.displayCandidate",
        ),

      bodyCandidate:
        parseFontCandidate(
          typographySystem
            .bodyCandidate,
          "typographySystem.bodyCandidate",
        ),

      scale:
        parseScale(
          typographySystem
            .scale,
        ),

      hierarchy:
        requireStringArray(
          typographySystem
            .hierarchy,
          "typographySystem.hierarchy",
        ),

      specimen: {
        headline:
          requireString(
            specimen.headline,
            "typographySystem.specimen.headline",
          ),

        body:
          requireString(
            specimen.body,
            "typographySystem.specimen.body",
          ),
      },

      usageNotes:
        requireString(
          typographySystem
            .usageNotes,
          "typographySystem.usageNotes",
        ),
    },
  };
}

function hasText(
  value: string,
) {
  return (
    value.trim().length > 0
  );
}

function fontCandidateReady(
  candidate:
    VisualFontCandidate,
) {
  return (
    hasText(
      candidate.family,
    ) &&
    hasText(
      candidate.cssStack,
    ) &&
    candidate.weights
      .length > 0 &&
    hasText(
      candidate.rationale,
    ) &&
    candidate.licenseStatus ===
      "verified"
  );
}

function paletteReady(
  system: VisualSystem,
) {
  const colors =
    system.paletteSystem
      .colors;

  if (colors.length < 3) {
    return false;
  }

  const tokenSet =
    new Set<string>();

  let usageTotal = 0;

  for (
    const color of colors
  ) {
    if (
      !hasText(color.name) ||
      !TOKEN_PATTERN.test(
        color.token,
      ) ||
      !HEX_PATTERN.test(
        color.hex,
      ) ||
      !hasText(
        color.brandRole,
      ) ||
      !hasText(
        color.semanticRole,
      ) ||
      !hasText(
        color.rationale,
      ) ||
      color.usagePercent ===
        null
    ) {
      return false;
    }

    if (
      tokenSet.has(
        color.token,
      )
    ) {
      return false;
    }

    tokenSet.add(
      color.token,
    );

    usageTotal +=
      color.usagePercent;
  }

  if (
    Math.abs(
      usageTotal - 100,
    ) > 0.01
  ) {
    return false;
  }

  if (
    !hasText(
      system.paletteSystem
        .usageNotes,
    ) ||
    !hasText(
      system.paletteSystem
        .applicationNotes,
    )
  ) {
    return false;
  }

  if (
    system.paletteSystem
      .approvedPairings
      .length < 1
  ) {
    return false;
  }

  const colorByToken =
    new Map(
      colors.map(
        (color) => [
          color.token,
          color,
        ],
      ),
    );

  return system
    .paletteSystem
    .approvedPairings
    .every(
      (pairing) => {
        const foreground =
          colorByToken.get(
            pairing
              .foregroundToken,
          );

        const background =
          colorByToken.get(
            pairing
              .backgroundToken,
          );

        if (
          !foreground ||
          !background ||
          foreground.token ===
            background.token ||
          !hasText(
            pairing.purpose,
          )
        ) {
          return false;
        }

        const ratio =
          contrastRatio(
            foreground.hex,
            background.hex,
          );

        return (
          ratio !== null &&
          ratio >= 4.5
        );
      },
    );
}

function typographyReady(
  system: VisualSystem,
) {
  if (
    !fontCandidateReady(
      system
        .typographySystem
        .displayCandidate,
    ) ||
    !fontCandidateReady(
      system
        .typographySystem
        .bodyCandidate,
    )
  ) {
    return false;
  }

  const requiredRoles:
    VisualTypeRole[] = [
      "display",
      "h1",
      "h2",
      "h3",
      "body",
      "small",
      "label",
    ];

  const roles =
    new Set(
      system
        .typographySystem
        .scale
        .map(
          (item) =>
            item.role,
        ),
    );

  if (
    !requiredRoles.every(
      (role) =>
        roles.has(role),
    )
  ) {
    return false;
  }

  return (
    system
      .typographySystem
      .hierarchy.length > 0 &&
    hasText(
      system
        .typographySystem
        .specimen.headline,
    ) &&
    hasText(
      system
        .typographySystem
        .specimen.body,
    ) &&
    hasText(
      system
        .typographySystem
        .usageNotes,
    )
  );
}

export function evaluateVisualSystemCompletion(
  system: VisualSystem,
): VisualSystemCompletion {
  const modules = {
    palette:
      paletteReady(system),

    typography:
      typographyReady(
        system,
      ),
  };

  const moduleCount =
    Object.keys(modules)
      .length;

  const completeCount =
    Object.values(modules)
      .filter(Boolean)
      .length;

  return {
    completeCount,
    moduleCount,

    ready:
      completeCount ===
      moduleCount,

    modules,
  };
}

export function visualSystemPayloadSize(
  system: VisualSystem,
) {
  return new TextEncoder()
    .encode(
      JSON.stringify(system),
    )
    .byteLength;
}

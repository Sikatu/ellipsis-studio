import type {
  AIStrategyOutput,
} from "@/lib/ai-strategy";

export type CreativeDirectionColor = {
  name: string;
  role: string;
  hex: string;
  rationale: string;
};

export type CreativeDirection = {
  schemaVersion: 1;

  brandCore: {
    positioning: string;
    brandPromise: string;
    brandEssence: string;

    personality: {
      summary: string;
      traits: string[];
    };
  };

  visualTerritory: {
    summary: string;
    principles: string[];
    avoid: string[];
  };

  colorDirection: {
    summary: string;
    palette: CreativeDirectionColor[];
    notes: string;
  };

  typographyDirection: {
    summary: string;
    displayStyle: string;
    bodyStyle: string;
    hierarchy: string[];
    notes: string;
  };

  logoDirection: {
    summary: string;
    characteristics: string[];
    symbolDirection: string;
    wordmarkDirection: string;
    avoid: string[];
  };

  imageryDirection: {
    summary: string;
    photography: string;
    composition: string;
    lighting: string;
    texture: string;
    subjectTreatment: string;
    avoid: string[];
  };

  voiceSystem: {
    summary: string;
    principles: string[];
    use: string[];
    avoid: string[];
  };

  creativeGuardrails: {
    mustFeel: string[];
    mustNeverFeel: string[];
    risks: string[];
  };
};

export type CreativeDirectionStatus =
  | "draft"
  | "approved";

export type CreativeDirectionVersion = {
  id: string;
  project_id: string;
  version_number: number;
  status: CreativeDirectionStatus;
  source_strategy_version_id: string;
  source_strategy_version_number: number;
  direction: CreativeDirection;
  editorial_notes: string;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreativeDirectionCompletion = {
  completeCount: number;
  moduleCount: number;
  ready: boolean;

  modules: {
    brandCore: boolean;
    visualTerritory: boolean;
    colorDirection: boolean;
    typographyDirection: boolean;
    logoDirection: boolean;
    imageryDirection: boolean;
    voiceSystem: boolean;
    creativeGuardrails: boolean;
  };
};

const HEX_PATTERN =
  /^#[0-9a-f]{6}$/i;

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
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
      `Creative direction is invalid at ${path}.`,
    );
  }

  return value;
}

function requireString(
  value: unknown,
  path: string,
) {
  if (
    typeof value !==
    "string"
  ) {
    throw new Error(
      `Creative direction is invalid at ${path}.`,
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
      `Creative direction is invalid at ${path}.`,
    );
  }

  return value;
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
      `Creative direction contains an unexpected field at ${path}.${unexpected}.`,
    );
  }
}

function parsePalette(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    throw new Error(
      "Creative direction is invalid at colorDirection.palette.",
    );
  }

  return value.map(
    (item, index) => {
      const row =
        requireRecord(
          item,
          `colorDirection.palette[${index}]`,
        );

      assertOnlyKeys(
        row,
        [
          "name",
          "role",
          "hex",
          "rationale",
        ],
        `colorDirection.palette[${index}]`,
      );

      const hex =
        requireString(
          row.hex,
          `colorDirection.palette[${index}].hex`,
        ).trim();

      if (
        hex &&
        !HEX_PATTERN.test(hex)
      ) {
        throw new Error(
          `Creative direction contains an invalid HEX value at colorDirection.palette[${index}].hex.`,
        );
      }

      return {
        name:
          requireString(
            row.name,
            `colorDirection.palette[${index}].name`,
          ),

        role:
          requireString(
            row.role,
            `colorDirection.palette[${index}].role`,
          ),

        hex,

        rationale:
          requireString(
            row.rationale,
            `colorDirection.palette[${index}].rationale`,
          ),
      };
    },
  );
}

export function buildCreativeDirectionSeed(
  strategy: AIStrategyOutput,
): CreativeDirection {
  return {
    schemaVersion: 1,

    brandCore: {
      positioning:
        strategy.positioning,

      brandPromise:
        strategy.brandPromise,

      brandEssence:
        strategy.brandEssence,

      personality: {
        summary:
          strategy.personality
            .summary,

        traits:
          [...strategy.personality
            .traits],
      },
    },

    visualTerritory: {
      summary:
        strategy.visualDirection
          .summary,

      principles:
        [...strategy.visualDirection
          .principles],

      avoid:
        [...strategy.visualDirection
          .avoid],
    },

    colorDirection: {
      summary: "",
      palette: [],
      notes: "",
    },

    typographyDirection: {
      summary: "",
      displayStyle: "",
      bodyStyle: "",
      hierarchy: [],
      notes: "",
    },

    logoDirection: {
      summary: "",
      characteristics: [],
      symbolDirection: "",
      wordmarkDirection: "",
      avoid: [],
    },

    imageryDirection: {
      summary: "",
      photography: "",
      composition: "",
      lighting: "",
      texture: "",
      subjectTreatment: "",
      avoid: [],
    },

    voiceSystem: {
      summary:
        strategy.voiceDirection
          .summary,

      principles:
        [...strategy.voiceDirection
          .principles],

      use: [],

      avoid:
        [...strategy.voiceDirection
          .avoid],
    },

    creativeGuardrails: {
      mustFeel:
        [...strategy.personality
          .traits],

      mustNeverFeel:
        [...strategy.visualDirection
          .avoid],

      risks:
        [...strategy.strategicRisks],
    },
  };
}

export function parseCreativeDirection(
  value: unknown,
): CreativeDirection {
  const root =
    requireRecord(
      value,
      "root",
    );

  assertOnlyKeys(
    root,
    [
      "schemaVersion",
      "brandCore",
      "visualTerritory",
      "colorDirection",
      "typographyDirection",
      "logoDirection",
      "imageryDirection",
      "voiceSystem",
      "creativeGuardrails",
    ],
    "root",
  );

  if (
    root.schemaVersion !== 1
  ) {
    throw new Error(
      "Creative direction schema version is unsupported.",
    );
  }

  const brandCore =
    requireRecord(
      root.brandCore,
      "brandCore",
    );

  const personality =
    requireRecord(
      brandCore.personality,
      "brandCore.personality",
    );

  const visualTerritory =
    requireRecord(
      root.visualTerritory,
      "visualTerritory",
    );

  const colorDirection =
    requireRecord(
      root.colorDirection,
      "colorDirection",
    );

  const typographyDirection =
    requireRecord(
      root.typographyDirection,
      "typographyDirection",
    );

  const logoDirection =
    requireRecord(
      root.logoDirection,
      "logoDirection",
    );

  const imageryDirection =
    requireRecord(
      root.imageryDirection,
      "imageryDirection",
    );

  const voiceSystem =
    requireRecord(
      root.voiceSystem,
      "voiceSystem",
    );

  const creativeGuardrails =
    requireRecord(
      root.creativeGuardrails,
      "creativeGuardrails",
    );

  assertOnlyKeys(
    brandCore,
    [
      "positioning",
      "brandPromise",
      "brandEssence",
      "personality",
    ],
    "brandCore",
  );

  assertOnlyKeys(
    personality,
    [
      "summary",
      "traits",
    ],
    "brandCore.personality",
  );

  assertOnlyKeys(
    visualTerritory,
    [
      "summary",
      "principles",
      "avoid",
    ],
    "visualTerritory",
  );

  assertOnlyKeys(
    colorDirection,
    [
      "summary",
      "palette",
      "notes",
    ],
    "colorDirection",
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
    "typographyDirection",
  );

  assertOnlyKeys(
    logoDirection,
    [
      "summary",
      "characteristics",
      "symbolDirection",
      "wordmarkDirection",
      "avoid",
    ],
    "logoDirection",
  );

  assertOnlyKeys(
    imageryDirection,
    [
      "summary",
      "photography",
      "composition",
      "lighting",
      "texture",
      "subjectTreatment",
      "avoid",
    ],
    "imageryDirection",
  );

  assertOnlyKeys(
    voiceSystem,
    [
      "summary",
      "principles",
      "use",
      "avoid",
    ],
    "voiceSystem",
  );

  assertOnlyKeys(
    creativeGuardrails,
    [
      "mustFeel",
      "mustNeverFeel",
      "risks",
    ],
    "creativeGuardrails",
  );

  return {
    schemaVersion: 1,

    brandCore: {
      positioning:
        requireString(
          brandCore.positioning,
          "brandCore.positioning",
        ),

      brandPromise:
        requireString(
          brandCore.brandPromise,
          "brandCore.brandPromise",
        ),

      brandEssence:
        requireString(
          brandCore.brandEssence,
          "brandCore.brandEssence",
        ),

      personality: {
        summary:
          requireString(
            personality.summary,
            "brandCore.personality.summary",
          ),

        traits:
          requireStringArray(
            personality.traits,
            "brandCore.personality.traits",
          ),
      },
    },

    visualTerritory: {
      summary:
        requireString(
          visualTerritory.summary,
          "visualTerritory.summary",
        ),

      principles:
        requireStringArray(
          visualTerritory.principles,
          "visualTerritory.principles",
        ),

      avoid:
        requireStringArray(
          visualTerritory.avoid,
          "visualTerritory.avoid",
        ),
    },

    colorDirection: {
      summary:
        requireString(
          colorDirection.summary,
          "colorDirection.summary",
        ),

      palette:
        parsePalette(
          colorDirection.palette,
        ),

      notes:
        requireString(
          colorDirection.notes,
          "colorDirection.notes",
        ),
    },

    typographyDirection: {
      summary:
        requireString(
          typographyDirection.summary,
          "typographyDirection.summary",
        ),

      displayStyle:
        requireString(
          typographyDirection.displayStyle,
          "typographyDirection.displayStyle",
        ),

      bodyStyle:
        requireString(
          typographyDirection.bodyStyle,
          "typographyDirection.bodyStyle",
        ),

      hierarchy:
        requireStringArray(
          typographyDirection.hierarchy,
          "typographyDirection.hierarchy",
        ),

      notes:
        requireString(
          typographyDirection.notes,
          "typographyDirection.notes",
        ),
    },

    logoDirection: {
      summary:
        requireString(
          logoDirection.summary,
          "logoDirection.summary",
        ),

      characteristics:
        requireStringArray(
          logoDirection.characteristics,
          "logoDirection.characteristics",
        ),

      symbolDirection:
        requireString(
          logoDirection.symbolDirection,
          "logoDirection.symbolDirection",
        ),

      wordmarkDirection:
        requireString(
          logoDirection.wordmarkDirection,
          "logoDirection.wordmarkDirection",
        ),

      avoid:
        requireStringArray(
          logoDirection.avoid,
          "logoDirection.avoid",
        ),
    },

    imageryDirection: {
      summary:
        requireString(
          imageryDirection.summary,
          "imageryDirection.summary",
        ),

      photography:
        requireString(
          imageryDirection.photography,
          "imageryDirection.photography",
        ),

      composition:
        requireString(
          imageryDirection.composition,
          "imageryDirection.composition",
        ),

      lighting:
        requireString(
          imageryDirection.lighting,
          "imageryDirection.lighting",
        ),

      texture:
        requireString(
          imageryDirection.texture,
          "imageryDirection.texture",
        ),

      subjectTreatment:
        requireString(
          imageryDirection.subjectTreatment,
          "imageryDirection.subjectTreatment",
        ),

      avoid:
        requireStringArray(
          imageryDirection.avoid,
          "imageryDirection.avoid",
        ),
    },

    voiceSystem: {
      summary:
        requireString(
          voiceSystem.summary,
          "voiceSystem.summary",
        ),

      principles:
        requireStringArray(
          voiceSystem.principles,
          "voiceSystem.principles",
        ),

      use:
        requireStringArray(
          voiceSystem.use,
          "voiceSystem.use",
        ),

      avoid:
        requireStringArray(
          voiceSystem.avoid,
          "voiceSystem.avoid",
        ),
    },

    creativeGuardrails: {
      mustFeel:
        requireStringArray(
          creativeGuardrails.mustFeel,
          "creativeGuardrails.mustFeel",
        ),

      mustNeverFeel:
        requireStringArray(
          creativeGuardrails.mustNeverFeel,
          "creativeGuardrails.mustNeverFeel",
        ),

      risks:
        requireStringArray(
          creativeGuardrails.risks,
          "creativeGuardrails.risks",
        ),
    },
  };
}

function hasText(
  value: string,
) {
  return value.trim().length > 0;
}

function validPalette(
  palette:
    CreativeDirectionColor[],
) {
  return (
    palette.length >= 3 &&
    palette.every(
      (color) =>
        hasText(color.name) &&
        hasText(color.role) &&
        HEX_PATTERN.test(
          color.hex,
        ),
    )
  );
}

export function evaluateCreativeDirectionCompletion(
  direction:
    CreativeDirection,
): CreativeDirectionCompletion {
  const modules = {
    brandCore:
      hasText(
        direction.brandCore
          .positioning,
      ) &&
      hasText(
        direction.brandCore
          .brandPromise,
      ) &&
      hasText(
        direction.brandCore
          .brandEssence,
      ) &&
      direction.brandCore
        .personality.traits
        .length > 0,

    visualTerritory:
      hasText(
        direction.visualTerritory
          .summary,
      ) &&
      direction.visualTerritory
        .principles.length > 0,

    colorDirection:
      hasText(
        direction.colorDirection
          .summary,
      ) &&
      validPalette(
        direction.colorDirection
          .palette,
      ),

    typographyDirection:
      hasText(
        direction
          .typographyDirection
          .summary,
      ) &&
      hasText(
        direction
          .typographyDirection
          .displayStyle,
      ) &&
      hasText(
        direction
          .typographyDirection
          .bodyStyle,
      ),

    logoDirection:
      hasText(
        direction.logoDirection
          .summary,
      ) &&
      direction.logoDirection
        .characteristics
        .length > 0,

    imageryDirection:
      hasText(
        direction.imageryDirection
          .summary,
      ) &&
      (
        hasText(
          direction.imageryDirection
            .photography,
        ) ||
        hasText(
          direction.imageryDirection
            .subjectTreatment,
        )
      ),

    voiceSystem:
      hasText(
        direction.voiceSystem
          .summary,
      ) &&
      direction.voiceSystem
        .principles.length > 0,

    creativeGuardrails:
      direction.creativeGuardrails
        .mustFeel.length > 0 &&
      direction.creativeGuardrails
        .mustNeverFeel.length > 0,
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

export function creativeDirectionPayloadSize(
  direction:
    CreativeDirection,
) {
  return new TextEncoder()
    .encode(
      JSON.stringify(direction),
    )
    .byteLength;
}
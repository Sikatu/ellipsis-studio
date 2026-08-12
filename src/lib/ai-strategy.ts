export const
AI_STRATEGIST_PROMPT_VERSION =
  "brand_strategist_v1";

export const
AI_STRATEGIST_DEFAULT_MODEL =
  "gpt-5.1";

export type AIStrategyOutput = {
  executiveSummary: string;

  positioning: string;

  audience: string;

  brandPromise: string;

  brandEssence: string;

  personality: {
    summary: string;
    traits: string[];
  };

  visualDirection: {
    summary: string;
    principles: string[];
    avoid: string[];
  };

  voiceDirection: {
    summary: string;
    principles: string[];
    avoid: string[];
  };

  creativeGuardrails: string[];

  strategicRisks: string[];

  evidenceCaveats: string[];
};

export const AI_STRATEGY_SCHEMA = {
  type: "object",

  additionalProperties: false,

  required: [
    "executiveSummary",
    "positioning",
    "audience",
    "brandPromise",
    "brandEssence",
    "personality",
    "visualDirection",
    "voiceDirection",
    "creativeGuardrails",
    "strategicRisks",
    "evidenceCaveats",
  ],

  properties: {
    executiveSummary: {
      type: "string",
    },

    positioning: {
      type: "string",
    },

    audience: {
      type: "string",
    },

    brandPromise: {
      type: "string",
    },

    brandEssence: {
      type: "string",
    },

    personality: {
      type: "object",

      additionalProperties: false,

      required: [
        "summary",
        "traits",
      ],

      properties: {
        summary: {
          type: "string",
        },

        traits: {
          type: "array",

          items: {
            type: "string",
          },
        },
      },
    },

    visualDirection: {
      type: "object",

      additionalProperties: false,

      required: [
        "summary",
        "principles",
        "avoid",
      ],

      properties: {
        summary: {
          type: "string",
        },

        principles: {
          type: "array",

          items: {
            type: "string",
          },
        },

        avoid: {
          type: "array",

          items: {
            type: "string",
          },
        },
      },
    },

    voiceDirection: {
      type: "object",

      additionalProperties: false,

      required: [
        "summary",
        "principles",
        "avoid",
      ],

      properties: {
        summary: {
          type: "string",
        },

        principles: {
          type: "array",

          items: {
            type: "string",
          },
        },

        avoid: {
          type: "array",

          items: {
            type: "string",
          },
        },
      },
    },

    creativeGuardrails: {
      type: "array",

      items: {
        type: "string",
      },
    },

    strategicRisks: {
      type: "array",

      items: {
        type: "string",
      },
    },

    evidenceCaveats: {
      type: "array",

      items: {
        type: "string",
      },
    },
  },
} as const;

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

function isStringArray(
  value: unknown,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item ===
        "string",
    )
  );
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
      `AI Strategist output is invalid at ${path}.`,
    );
  }

  return value;
}

function requireStringArray(
  value: unknown,
  path: string,
) {
  if (
    !isStringArray(value)
  ) {
    throw new Error(
      `AI Strategist output is invalid at ${path}.`,
    );
  }

  return value;
}

function requireRecord(
  value: unknown,
  path: string,
) {
  if (!isRecord(value)) {
    throw new Error(
      `AI Strategist output is invalid at ${path}.`,
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

  const unexpectedKey =
    Object.keys(value).find(
      (key) =>
        !allowedSet.has(
          key,
        ),
    );

  if (unexpectedKey) {
    throw new Error(
      `AI Strategist output contains an unexpected field at ${path}.${unexpectedKey}.`,
    );
  }
}

export function parseAIStrategyOutput(
  value: unknown,
): AIStrategyOutput {
  const parsed =
    typeof value ===
    "string"
      ? JSON.parse(value)
      : value;

  const root =
    requireRecord(
      parsed,
      "root",
    );

  const personality =
    requireRecord(
      root.personality,
      "personality",
    );

  const visualDirection =
    requireRecord(
      root.visualDirection,
      "visualDirection",
    );

  const voiceDirection =
    requireRecord(
      root.voiceDirection,
      "voiceDirection",
    );

  assertOnlyKeys(
    personality,
    [
      "summary",
      "traits",
    ],
    "personality",
  );

  assertOnlyKeys(
    visualDirection,
    [
      "summary",
      "principles",
      "avoid",
    ],
    "visualDirection",
  );

  assertOnlyKeys(
    voiceDirection,
    [
      "summary",
      "principles",
      "avoid",
    ],
    "voiceDirection",
  );

  const output: AIStrategyOutput = {
    executiveSummary:
      requireString(
        root.executiveSummary,
        "executiveSummary",
      ),

    positioning:
      requireString(
        root.positioning,
        "positioning",
      ),

    audience:
      requireString(
        root.audience,
        "audience",
      ),

    brandPromise:
      requireString(
        root.brandPromise,
        "brandPromise",
      ),

    brandEssence:
      requireString(
        root.brandEssence,
        "brandEssence",
      ),

    personality: {
      summary:
        requireString(
          personality.summary,
          "personality.summary",
        ),

      traits:
        requireStringArray(
          personality.traits,
          "personality.traits",
        ),
    },

    visualDirection: {
      summary:
        requireString(
          visualDirection.summary,
          "visualDirection.summary",
        ),

      principles:
        requireStringArray(
          visualDirection.principles,
          "visualDirection.principles",
        ),

      avoid:
        requireStringArray(
          visualDirection.avoid,
          "visualDirection.avoid",
        ),
    },

    voiceDirection: {
      summary:
        requireString(
          voiceDirection.summary,
          "voiceDirection.summary",
        ),

      principles:
        requireStringArray(
          voiceDirection.principles,
          "voiceDirection.principles",
        ),

      avoid:
        requireStringArray(
          voiceDirection.avoid,
          "voiceDirection.avoid",
        ),
    },

    creativeGuardrails:
      requireStringArray(
        root.creativeGuardrails,
        "creativeGuardrails",
      ),

    strategicRisks:
      requireStringArray(
        root.strategicRisks,
        "strategicRisks",
      ),

    evidenceCaveats:
      requireStringArray(
        root.evidenceCaveats,
        "evidenceCaveats",
      ),
  };

  assertOnlyKeys(
    root,
    [
      "executiveSummary",
      "positioning",
      "audience",
      "brandPromise",
      "brandEssence",
      "personality",
      "visualDirection",
      "voiceDirection",
      "creativeGuardrails",
      "strategicRisks",
      "evidenceCaveats",
    ],
    "root",
  );

  return output;
}

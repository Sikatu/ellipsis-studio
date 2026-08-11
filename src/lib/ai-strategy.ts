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
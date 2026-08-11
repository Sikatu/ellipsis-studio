import {
  formatIntelligenceAnswer,
  getQuestionTitle,
  isIntelligenceAnswered,
  type BrandIntelligence,
  type ResponseLike,
} from "@/lib/discovery-intelligence";

export type StrategyStatus =
  | "ready"
  | "developing"
  | "insufficient";

export type StrategyEvidence = {
  questionId: string;
  title: string;
  value: string;
  quality: number;
};

export type StrategyDeliverable = {
  id: string;
  label: string;
  category: string;
  status: StrategyStatus;
  statement: string;
  guidance: string;
  evidenceScore: number;
  evidence: StrategyEvidence[];
  missing: string[];
};

export type StrategyRisk = {
  id: string;
  severity: "review" | "blocking";
  title: string;
  detail: string;
};

export type StrategySynthesis = {
  status: StrategyStatus;
  readyCount: number;
  developingCount: number;
  insufficientCount: number;
  deliverableCount: number;
  evidenceScore: number;
  reportReady: boolean;
  deliverables: StrategyDeliverable[];
  risks: StrategyRisk[];
};

function answerQuality(value: unknown) {
  if (!isIntelligenceAnswered(value)) {
    return 0;
  }

  if (typeof value === "number") {
    return 1;
  }

  if (Array.isArray(value)) {
    const validItems = value.filter(
      (item) =>
        typeof item === "string" &&
        item.trim().length > 0,
    );

    if (validItems.length >= 3) {
      return 1;
    }

    if (validItems.length === 2) {
      return 0.85;
    }

    return 0.65;
  }

  if (typeof value === "string") {
    const length = value.trim().length;

    if (length >= 80) {
      return 1;
    }

    if (length >= 40) {
      return 0.85;
    }

    if (length >= 15) {
      return 0.65;
    }

    return 0.35;
  }

  return 0;
}

function arrayAnswer(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string" &&
        item.trim().length > 0,
    )
    .map((item) => item.trim());
}

function textAnswer(value: unknown) {
  return formatIntelligenceAnswer(value);
}

function naturalList(items: string[]) {
  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items
    .slice(0, -1)
    .join(", ")}, and ${items.at(-1)}`;
}

function scaleDirection(
  value: unknown,
  left: string,
  right: string,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return "";
  }

  if (value <= 1) {
    return `strongly ${left.toLowerCase()}`;
  }

  if (value === 2) {
    return `leaning ${left.toLowerCase()}`;
  }

  if (value === 3) {
    return `balanced between ${left.toLowerCase()} and ${right.toLowerCase()}`;
  }

  if (value === 4) {
    return `leaning ${right.toLowerCase()}`;
  }

  return `strongly ${right.toLowerCase()}`;
}

function sentence(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/[.!?]$/.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}.`;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce(
      (total, value) => total + value,
      0,
    ) / values.length
  );
}

export function buildStrategySynthesis(
  responses: ResponseLike[],
  intelligence: BrandIntelligence,
): StrategySynthesis {
  const responseById = new Map(
    responses.map((response) => [
      response.question_id,
      response.answer,
    ]),
  );

  const answer = (id: string) =>
    responseById.get(id);

  function evidenceFor(
    ids: string[],
  ): StrategyEvidence[] {
    return ids
      .filter((id) =>
        isIntelligenceAnswered(
          answer(id),
        ),
      )
      .map((id) => ({
        questionId: id,
        title: getQuestionTitle(id),
        value:
          textAnswer(answer(id)) ||
          "Response available",
        quality:
          answerQuality(answer(id)),
      }));
  }

  function missingFor(ids: string[]) {
    return ids
      .filter(
        (id) =>
          !isIntelligenceAnswered(
            answer(id),
          ),
      )
      .map((id) =>
        getQuestionTitle(id),
      );
  }

  function statusFor(
    ids: string[],
    minimumReady: number,
    minimumDeveloping = 1,
  ): {
    status: StrategyStatus;
    score: number;
  } {
    const evidence =
      evidenceFor(ids);

    const score = Math.round(
      average(
        evidence.map(
          (item) => item.quality,
        ),
      ) * 100,
    );

    if (
      evidence.length >= minimumReady &&
      score >= 65
    ) {
      return {
        status: "ready",
        score,
      };
    }

    if (
      evidence.length >= minimumDeveloping
    ) {
      return {
        status: "developing",
        score,
      };
    }

    return {
      status: "insufficient",
      score: 0,
    };
  }

  function deliverable(
    config: {
      id: string;
      label: string;
      category: string;
      ids: string[];
      minimumReady: number;
      minimumDeveloping?: number;
      statement: (
        status: StrategyStatus,
      ) => string;
      guidance: (
        status: StrategyStatus,
      ) => string;
    },
  ): StrategyDeliverable {
    const result = statusFor(
      config.ids,
      config.minimumReady,
      config.minimumDeveloping ??
        1,
    );

    return {
      id: config.id,
      label: config.label,
      category: config.category,
      status: result.status,
      statement:
        config.statement(
          result.status,
        ),
      guidance:
        config.guidance(
          result.status,
        ),
      evidenceScore: result.score,
      evidence:
        evidenceFor(config.ids),
      missing:
        missingFor(config.ids),
    };
  }

  const idealCustomer =
    textAnswer(
      answer("idealCustomer"),
    );

  const customerProblem =
    textAnswer(
      answer("customerProblem"),
    );

  const customerAfter =
    arrayAnswer(
      answer("customerAfter"),
    );

  const marketPosition =
    textAnswer(
      answer("marketPosition"),
    );

  const differentiator =
    textAnswer(
      answer("differentiator"),
    );

  const knownFor =
    textAnswer(
      answer("knownFor"),
    );

  const priority =
    textAnswer(
      answer("priority"),
    );

  const brandingGoals =
    arrayAnswer(
      answer("brandingGoals"),
    );

  const personality =
    arrayAnswer(
      answer("personality"),
    );

  const modernity =
    scaleDirection(
      answer("modernity"),
      "Traditional",
      "Modern",
    );

  const expression =
    scaleDirection(
      answer("expression"),
      "Minimal",
      "Expressive",
    );

  const exclusivity =
    scaleDirection(
      answer("exclusivity"),
      "Accessible",
      "Exclusive",
    );

  const visualStyles =
    arrayAnswer(
      answer("visualStyles"),
    );

  const colors =
    textAnswer(
      answer("colors"),
    );

  const visualAvoid =
    textAnswer(
      answer("visualAvoid"),
    );

  const voice =
    arrayAnswer(
      answer("voice"),
    );

  const tone =
    scaleDirection(
      answer("tone"),
      "Formal",
      "Casual",
    );

  const inspiration =
    textAnswer(
      answer("inspiration"),
    );

  const neverFeel =
    textAnswer(
      answer("neverFeel"),
    );

  const finalLove =
    textAnswer(
      answer("finalLove"),
    );

  const deliverables: StrategyDeliverable[] = [
    deliverable({
      id: "audience-definition",
      label: "Audience Definition",
      category: "Audience",
      ids: [
        "idealCustomer",
        "customerProblem",
        "customerAfter",
      ],
      minimumReady: 3,

      statement(status) {
        if (
          status === "insufficient"
        ) {
          return "Insufficient evidence to define the primary audience.";
        }

        const parts: string[] = [];

        if (idealCustomer) {
          parts.push(
            `The primary audience is ${sentence(
              idealCustomer,
            )}`,
          );
        }

        if (customerProblem) {
          parts.push(
            `Their central problem is ${sentence(
              customerProblem,
            )}`,
          );
        }

        if (
          customerAfter.length > 0
        ) {
          parts.push(
            `The intended customer outcome is to feel ${naturalList(
              customerAfter,
            )}.`,
          );
        }

        return parts.join(" ");
      },

      guidance(status) {
        return status === "ready"
          ? "Use this definition to filter messaging, visual decisions, offers, and channel choices."
          : "Treat this as a working audience hypothesis until the missing or low-detail evidence is strengthened.";
      },
    }),

    deliverable({
      id: "positioning-thesis",
      label: "Positioning Thesis",
      category: "Positioning",
      ids: [
        "marketPosition",
        "differentiator",
        "knownFor",
      ],
      minimumReady: 3,
      minimumDeveloping: 2,

      statement(status) {
        if (
          status === "insufficient"
        ) {
          return "Insufficient evidence to establish a defensible positioning thesis.";
        }

        const parts: string[] = [];

        if (marketPosition) {
          parts.push(
            `Position the brand in the ${marketPosition} space`,
          );
        }

        if (differentiator) {
          parts.push(
            `with differentiation anchored in ${differentiator}`,
          );
        }

        if (knownFor) {
          parts.push(
            `and build ownership around ${knownFor}`,
          );
        }

        return `${parts.join(
          ", ",
        )}.`;
      },

      guidance(status) {
        return status === "ready"
          ? "This can serve as the internal strategic positioning anchor."
          : "The positioning is directional only. The brand ownership idea must be explicit before this becomes final.";
      },
    }),

    deliverable({
      id: "brand-promise",
      label: "Brand Promise",
      category: "Positioning",
      ids: [
        "customerAfter",
        "differentiator",
      ],
      minimumReady: 2,

      statement(status) {
        if (
          status === "insufficient"
        ) {
          return "Insufficient evidence to articulate a credible brand promise.";
        }

        if (
          customerAfter.length > 0 &&
          differentiator
        ) {
          return `The brand should consistently create an experience that leaves customers feeling ${naturalList(
            customerAfter,
          )}, supported by the distinct value of ${differentiator}.`;
        }

        if (
          customerAfter.length > 0
        ) {
          return `The emerging promise is an experience that leaves customers feeling ${naturalList(
            customerAfter,
          )}.`;
        }

        return `The emerging promise should be grounded in ${differentiator}.`;
      },

      guidance(status) {
        return status === "ready"
          ? "Use this as the experiential standard the identity and customer journey should reinforce."
          : "Do not turn this into external copy yet. More supporting evidence is needed.";
      },
    }),

    deliverable({
      id: "brand-objective",
      label: "Primary Brand Objective",
      category: "Goals",
      ids: [
        "priority",
        "brandingGoals",
      ],
      minimumReady: 2,

      statement(status) {
        if (
          status === "insufficient"
        ) {
          return "The primary branding objective is not clear enough yet.";
        }

        if (
          priority &&
          brandingGoals.length > 0
        ) {
          return `The primary objective is ${sentence(
            priority,
          )} Supporting branding goals include ${naturalList(
            brandingGoals,
          )}.`;
        }

        if (priority) {
          return `The current primary objective is ${sentence(
            priority,
          )}`;
        }

        return `Current branding goals are ${naturalList(
          brandingGoals,
        )}.`;
      },

      guidance(status) {
        return status === "ready"
          ? "Use this to judge whether proposed identity directions are commercially relevant."
          : "Confirm which objective has priority before evaluating creative directions.";
      },
    }),

    deliverable({
      id: "brand-essence",
      label: "Brand Essence",
      category: "Direction",
      ids: [
        "personality",
        "knownFor",
        "finalLove",
      ],
      minimumReady: 2,
      minimumDeveloping: 1,

      statement(status) {
        if (
          status === "insufficient"
        ) {
          return "Brand essence cannot be responsibly synthesized until personality or ownership evidence is available.";
        }

        const parts: string[] = [];

        if (
          personality.length > 0
        ) {
          parts.push(
            `The brand should embody ${naturalList(
              personality,
            )}`,
          );
        }

        if (knownFor) {
          parts.push(
            `while becoming associated with ${knownFor}`,
          );
        }

        if (finalLove) {
          parts.push(
            `and ultimately succeed by achieving ${finalLove}`,
          );
        }

        return `${parts.join(
          ", ",
        )}.`;
      },

      guidance(status) {
        return status === "ready"
          ? "This is an internal creative north star, not necessarily a public tagline."
          : "Keep this provisional until later discovery sections provide stronger evidence.";
      },
    }),

    deliverable({
      id: "personality-direction",
      label: "Personality Direction",
      category: "Direction",
      ids: [
        "personality",
        "modernity",
        "expression",
        "exclusivity",
      ],
      minimumReady: 3,
      minimumDeveloping: 1,

      statement(status) {
        if (
          status === "insufficient"
        ) {
          return "Insufficient evidence to define the future brand personality.";
        }

        const parts: string[] = [];

        if (
          personality.length > 0
        ) {
          parts.push(
            `Core characteristics: ${naturalList(
              personality,
            )}`,
          );
        }

        const scales = [
          modernity,
          expression,
          exclusivity,
        ].filter(Boolean);

        if (scales.length > 0) {
          parts.push(
            `The identity is ${naturalList(
              scales,
            )}`,
          );
        }

        return `${parts.join(
          ". ",
        )}.`;
      },

      guidance(status) {
        return status === "ready"
          ? "Use these traits and spectrum positions as behavioral constraints for identity concepts."
          : "Avoid locking a creative personality system until more scale evidence is available.";
      },
    }),

    deliverable({
      id: "visual-principles",
      label: "Visual Principles",
      category: "Direction",
      ids: [
        "visualStyles",
        "colors",
        "visualAvoid",
      ],
      minimumReady: 2,
      minimumDeveloping: 1,

      statement(status) {
        if (
          status === "insufficient"
        ) {
          return "Visual principles cannot be established until the client reaches Visual Direction.";
        }

        const parts: string[] = [];

        if (
          visualStyles.length > 0
        ) {
          parts.push(
            `Prioritize ${naturalList(
              visualStyles,
            )}`,
          );
        }

        if (colors) {
          parts.push(
            `Explore color cues around ${colors}`,
          );
        }

        if (visualAvoid) {
          parts.push(
            `Avoid ${visualAvoid}`,
          );
        }

        return `${parts.join(
          ". ",
        )}.`;
      },

      guidance(status) {
        return status === "ready"
          ? "Translate these principles into moodboards, typography, palette, image direction, and composition."
          : "Treat visual recommendations as incomplete until both preferences and boundaries are known.";
      },
    }),

    deliverable({
      id: "voice-principles",
      label: "Voice Principles",
      category: "Direction",
      ids: [
        "voice",
        "tone",
        "inspiration",
      ],
      minimumReady: 2,
      minimumDeveloping: 1,

      statement(status) {
        if (
          status === "insufficient"
        ) {
          return "Voice principles cannot be established until communication preferences are available.";
        }

        const parts: string[] = [];

        if (voice.length > 0) {
          parts.push(
            `The voice should feel ${naturalList(
              voice,
            )}`,
          );
        }

        if (tone) {
          parts.push(
            `with communication ${tone}`,
          );
        }

        if (inspiration) {
          parts.push(
            `Creative reference points include ${inspiration}`,
          );
        }

        return `${parts.join(
          ". ",
        )}.`;
      },

      guidance(status) {
        return status === "ready"
          ? "Use this to guide website copy, captions, client communication, and verbal identity."
          : "Do not formalize voice guidelines until both characteristics and tone are established.";
      },
    }),

    deliverable({
      id: "creative-guardrails",
      label: "Creative Guardrails",
      category: "Alignment",
      ids: [
        "neverFeel",
        "visualAvoid",
        "finalLove",
      ],
      minimumReady: 2,
      minimumDeveloping: 1,

      statement(status) {
        if (
          status === "insufficient"
        ) {
          return "Final creative guardrails have not yet been defined.";
        }

        const parts: string[] = [];

        if (neverFeel) {
          parts.push(
            `The brand must never feel ${neverFeel}`,
          );
        }

        if (visualAvoid) {
          parts.push(
            `It should not visually become ${visualAvoid}`,
          );
        }

        if (finalLove) {
          parts.push(
            `Success should ultimately feel like ${finalLove}`,
          );
        }

        return `${parts.join(
          ". ",
        )}.`;
      },

      guidance(status) {
        return status === "ready"
          ? "Use these guardrails during creative review to reject strategically wrong directions early."
          : "Final creative approval criteria remain incomplete.";
      },
    }),
  ];

  const risks: StrategyRisk[] = [];

  for (
    const flag
    of intelligence.alignmentFlags
  ) {
    risks.push({
      id: flag.id,
      severity:
        flag.severity === "conflict"
          ? "blocking"
          : "review",
      title: flag.title,
      detail: flag.detail,
    });
  }

  const lowQuality =
    deliverables.filter(
      (item) =>
        item.status !==
          "insufficient" &&
        item.evidenceScore < 50,
    );

  for (const item of lowQuality) {
    risks.push({
      id:
        `low-quality-${item.id}`,
      severity: "review",
      title:
        `Low-detail evidence: ${item.label}`,
      detail:
        "The required answers exist, but the available responses are too brief to support a high-confidence strategic conclusion.",
    });
  }

  const positioning =
    deliverables.find(
      (item) =>
        item.id ===
        "positioning-thesis",
    );

  if (
    positioning?.status !== "ready"
  ) {
    risks.push({
      id: "positioning-not-ready",
      severity: "blocking",
      title:
        "Positioning is not strategy-ready",
      detail:
        "A final positioning system should not be produced until market position, differentiation, and the idea the brand wants to own are sufficiently defined.",
    });
  }

  const directionItems =
    deliverables.filter(
      (item) =>
        [
          "brand-essence",
          "personality-direction",
          "visual-principles",
          "voice-principles",
        ].includes(item.id),
    );

  if (
    directionItems.every(
      (item) =>
        item.status ===
        "insufficient",
    )
  ) {
    risks.push({
      id: "direction-not-started",
      severity: "blocking",
      title:
        "Creative direction evidence is not available yet",
      detail:
        "Personality, visual, and voice evidence should be collected before the studio commits to a final identity direction.",
    });
  }

  const readyCount =
    deliverables.filter(
      (item) =>
        item.status === "ready",
    ).length;

  const developingCount =
    deliverables.filter(
      (item) =>
        item.status ===
        "developing",
    ).length;

  const insufficientCount =
    deliverables.filter(
      (item) =>
        item.status ===
        "insufficient",
    ).length;

  const evidenceScore =
    Math.round(
      average(
        deliverables.map(
          (item) =>
            item.evidenceScore,
        ),
      ),
    );

  let status: StrategyStatus =
    "insufficient";

  if (
    readyCount >=
      Math.ceil(
        deliverables.length *
          0.75,
      ) &&
    insufficientCount === 0
  ) {
    status = "ready";
  } else if (
    readyCount +
      developingCount >=
    Math.ceil(
      deliverables.length * 0.5,
    )
  ) {
    status = "developing";
  }

  const blockingRisks =
    risks.filter(
      (risk) =>
        risk.severity ===
        "blocking",
    );

  const reportReady =
    status === "ready" &&
    blockingRisks.length === 0 &&
    intelligence.missingRequired
      .length === 0;

  return {
    status,
    readyCount,
    developingCount,
    insufficientCount,
    deliverableCount:
      deliverables.length,
    evidenceScore,
    reportReady,
    deliverables,
    risks,
  };
}
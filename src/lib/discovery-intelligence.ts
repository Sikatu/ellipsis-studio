import {
  questionnaireSections,
  questions,
} from "@/lib/questionnaire";

export type SignalStrength =
  | "strong"
  | "developing"
  | "insufficient";

export type IntelligenceQuestion = {
  id: string;
  section: string;
  title: string;
  type: string;
  required?: boolean;
  options?: readonly string[];
  leftLabel?: string;
  rightLabel?: string;
};

export type DiscoverySection = {
  id: string;
  label: string;
  description: string;
  questionIds: string[];
};

export type ResponseLike = {
  question_id: string;
  answer: unknown;
  updated_at?: string;
};

export type StrategicSignal = {
  id: string;
  label: string;
  value: string;
  strength: SignalStrength;
  sourceQuestionId: string | null;
  sourceTitle: string | null;
};

export type ScaleSignal = {
  id: string;
  title: string;
  leftLabel: string;
  rightLabel: string;
  value: number | null;
  answered: boolean;
};

export type IntelligenceQuestionResult = {
  id: string;
  section: string;
  title: string;
  type: string;
  required: boolean;
  leftLabel?: string;
  rightLabel?: string;
  answer: unknown;
  answered: boolean;
};

export type IntelligenceSectionResult = {
  id: string;
  label: string;
  totalCount: number;
  answeredCount: number;
  requiredCount: number;
  requiredAnsweredCount: number;
  strength: SignalStrength;
  questions: IntelligenceQuestionResult[];
};

export type AlignmentFlag = {
  id: string;
  severity: "review" | "conflict";
  title: string;
  detail: string;
};

export type MissingIntelligence = {
  id: string;
  section: string;
  title: string;
};

export type BrandIntelligence = {
  questionCount: number;
  answeredCount: number;
  requiredCount: number;
  requiredAnsweredCount: number;
  completion: number;
  overallStrength: SignalStrength;
  strategicSignals: StrategicSignal[];
  scaleSignals: ScaleSignal[];
  advancedSections: IntelligenceSectionResult[];
  alignmentFlags: AlignmentFlag[];
  missingRequired: MissingIntelligence[];
};

const questionMetadata =
  questions as unknown as IntelligenceQuestion[];

const questionnaireOrder =
  questionnaireSections as unknown as readonly string[];

const questionById = new Map(
  questionMetadata.map((question) => [
    question.id,
    question,
  ]),
);

export const allQuestionIds =
  questionMetadata.map(
    (question) => question.id,
  );

const sectionDescriptions: Record<
  string,
  string
> = {
  Business:
    "Foundational context about the company, offer, website, and origin.",
  Goals:
    "What the client wants the new brand to accomplish.",
  Audience:
    "Who the brand serves and the transformation it should support.",
  Positioning:
    "Where the brand sits in the market and what makes it distinct.",
  Personality:
    "The characteristics and behavioral qualities the future identity should express.",
  Visual:
    "The visual language, aesthetic direction, color preferences, and boundaries.",
  Voice:
    "How the brand should sound, communicate, and relate to its audience.",
  Final:
    "Final boundaries and the client's definition of a successful identity.",
};

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getQuestionTitle(
  questionId: string,
) {
  return (
    questionById.get(questionId)?.title ??
    questionId
      .replace(
        /([a-z])([A-Z])/g,
        "$1 $2",
      )
      .replace(/[_-]+/g, " ")
      .replace(
        /\b\w/g,
        (character) =>
          character.toUpperCase(),
      )
  );
}

export function getDiscoverySections(
  allowedSections?: readonly string[],
): DiscoverySection[] {
  const selectedSections =
    allowedSections ??
    questionnaireOrder;

  return selectedSections
    .map((section) => {
      const sectionQuestions =
        questionMetadata.filter(
          (question) =>
            question.section === section,
        );

      return {
        id: slug(section),
        label: section,
        description:
          sectionDescriptions[section] ??
          "Discovery responses from this section.",
        questionIds:
          sectionQuestions.map(
            (question) => question.id,
          ),
      };
    })
    .filter(
      (section) =>
        section.questionIds.length > 0,
    );
}

export function isIntelligenceAnswered(
  value: unknown,
) {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.some(
      (item) =>
        typeof item === "string" &&
        item.trim().length > 0,
    );
  }

  return false;
}

export function formatIntelligenceAnswer(
  value: unknown,
) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .filter(
        (item): item is string =>
          typeof item === "string" &&
          item.trim().length > 0,
      )
      .map((item) => item.trim())
      .join(" · ");
  }

  return "";
}

function strengthFromCoverage(
  answered: number,
  total: number,
): SignalStrength {
  if (total <= 0 || answered <= 0) {
    return "insufficient";
  }

  const coverage =
    answered / total;

  if (coverage >= 0.75) {
    return "strong";
  }

  return "developing";
}

function strengthFromAnswer(
  value: unknown,
): SignalStrength {
  if (!isIntelligenceAnswered(value)) {
    return "insufficient";
  }

  if (typeof value === "number") {
    return "strong";
  }

  if (Array.isArray(value)) {
    const validItems = value.filter(
      (item) =>
        typeof item === "string" &&
        item.trim().length > 0,
    );

    return validItems.length >= 2
      ? "strong"
      : "developing";
  }

  if (typeof value === "string") {
    return value.trim().length >= 20
      ? "strong"
      : "developing";
  }

  return "developing";
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string",
    )
    .map((item) => item.trim())
    .filter(Boolean);
}

function numericValue(
  value: unknown,
) {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    const numberValue =
      Number(value);

    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  return null;
}

function lowerText(value: unknown) {
  return formatIntelligenceAnswer(
    value,
  ).toLowerCase();
}

function containsAny(
  value: string,
  words: readonly string[],
) {
  return words.some((word) =>
    value.includes(word),
  );
}

export function buildBrandIntelligence(
  responses: ResponseLike[],
): BrandIntelligence {
  const responseById = new Map(
    responses.map((response) => [
      response.question_id,
      response.answer,
    ]),
  );

  const answerFor = (
    questionId: string,
  ) => responseById.get(questionId);

  const answeredQuestions =
    questionMetadata.filter((question) =>
      isIntelligenceAnswered(
        answerFor(question.id),
      ),
    );

  const requiredQuestions =
    questionMetadata.filter(
      (question) => question.required,
    );

  const requiredAnswered =
    requiredQuestions.filter(
      (question) =>
        isIntelligenceAnswered(
          answerFor(question.id),
        ),
    );

  function strategicSignal(
    id: string,
    label: string,
    candidateQuestionIds: string[],
  ): StrategicSignal {
    const sourceId =
      candidateQuestionIds.find(
        (questionId) =>
          isIntelligenceAnswered(
            answerFor(questionId),
          ),
      ) ?? null;

    const value =
      sourceId === null
        ? ""
        : formatIntelligenceAnswer(
            answerFor(sourceId),
          );

    return {
      id,
      label,
      value:
        value ||
        "Not answered yet",
      strength:
        sourceId === null
          ? "insufficient"
          : strengthFromAnswer(
              answerFor(sourceId),
            ),
      sourceQuestionId: sourceId,
      sourceTitle:
        sourceId === null
          ? null
          : getQuestionTitle(sourceId),
    };
  }

  const strategicSignals = [
    strategicSignal(
      "primary-audience",
      "Primary audience",
      ["idealCustomer"],
    ),
    strategicSignal(
      "customer-problem",
      "Customer problem",
      ["customerProblem"],
    ),
    strategicSignal(
      "transformation",
      "Desired transformation",
      ["customerAfter"],
    ),
    strategicSignal(
      "market-position",
      "Market position",
      ["marketPosition"],
    ),
    strategicSignal(
      "differentiator",
      "Differentiator",
      ["differentiator"],
    ),
    strategicSignal(
      "known-for",
      "Known-for idea",
      ["knownFor"],
    ),
    strategicSignal(
      "primary-objective",
      "Primary brand objective",
      [
        "priority",
        "brandingGoals",
      ],
    ),
  ];

  const scaleSignals =
    questionMetadata
      .filter(
        (question) =>
          question.type === "scale",
      )
      .map((question) => {
        const value = numericValue(
          answerFor(question.id),
        );

        return {
          id: question.id,
          title: question.title,
          leftLabel:
            question.leftLabel ??
            "Low",
          rightLabel:
            question.rightLabel ??
            "High",
          value,
          answered: value !== null,
        };
      });

  const advancedSectionNames = [
    "Personality",
    "Visual",
    "Voice",
    "Final",
  ];

  const advancedSections =
    advancedSectionNames.map(
      (section) => {
        const sectionQuestions =
          questionMetadata.filter(
            (question) =>
              question.section === section,
          );

        const questionResults =
          sectionQuestions.map(
            (question) => {
              const answer =
                answerFor(question.id);

              return {
                id: question.id,
                section:
                  question.section,
                title:
                  question.title,
                type:
                  question.type,
                required:
                  Boolean(
                    question.required,
                  ),
                leftLabel:
                  question.leftLabel,
                rightLabel:
                  question.rightLabel,
                answer,
                answered:
                  isIntelligenceAnswered(
                    answer,
                  ),
              };
            },
          );

        const answeredCount =
          questionResults.filter(
            (question) =>
              question.answered,
          ).length;

        const requiredResults =
          questionResults.filter(
            (question) =>
              question.required,
          );

        const requiredAnsweredCount =
          requiredResults.filter(
            (question) =>
              question.answered,
          ).length;

        return {
          id: slug(section),
          label: section,
          totalCount:
            questionResults.length,
          answeredCount,
          requiredCount:
            requiredResults.length,
          requiredAnsweredCount,
          strength:
            strengthFromCoverage(
              answeredCount,
              questionResults.length,
            ),
          questions:
            questionResults,
        };
      },
    );

  const alignmentFlags:
    AlignmentFlag[] = [];

  const premiumIntentText = [
    lowerText(
      answerFor("marketPosition"),
    ),
    lowerText(
      answerFor("brandingGoals"),
    ),
    lowerText(
      answerFor("priority"),
    ),
  ].join(" ");

  const premiumIntent =
    containsAny(
      premiumIntentText,
      [
        "premium",
        "luxury",
        "exclusive",
        "high-end",
        "high end",
        "increase prices",
        "higher prices",
      ],
    );

  const exclusivity =
    numericValue(
      answerFor("exclusivity"),
    );

  if (
    premiumIntent &&
    exclusivity !== null &&
    exclusivity <= 2
  ) {
    alignmentFlags.push({
      id: "premium-accessibility",
      severity: "review",
      title:
        "Premium ambition vs. accessibility",
      detail:
        "The strategic answers signal premium or higher-value ambitions while the exclusivity scale currently leans strongly accessible. This may be intentional, but it should be resolved during positioning.",
    });
  }

  const expression =
    numericValue(
      answerFor("expression"),
    );

  const visualSelections =
    stringArray(
      answerFor("visualStyles"),
    );

  const visualSelectionText =
    visualSelections
      .join(" ")
      .toLowerCase();

  if (
    expression !== null &&
    expression >= 4 &&
    containsAny(
      visualSelectionText,
      [
        "minimal",
        "minimalist",
        "restrained",
      ],
    )
  ) {
    alignmentFlags.push({
      id: "minimal-expressive",
      severity: "review",
      title:
        "Minimal visual language vs. expressive identity",
      detail:
        "The selected visual direction includes restrained or minimal cues while the expression scale leans strongly expressive. The design system will need a deliberate balance.",
    });
  }

  const tone =
    numericValue(
      answerFor("tone"),
    );

  const voiceSelections =
    stringArray(
      answerFor("voice"),
    );

  const voiceText =
    voiceSelections
      .join(" ")
      .toLowerCase();

  if (
    tone !== null &&
    tone >= 4 &&
    containsAny(
      voiceText,
      [
        "formal",
        "authoritative",
        "professional",
      ],
    )
  ) {
    alignmentFlags.push({
      id: "formal-casual",
      severity: "review",
      title:
        "Formal voice cues vs. casual tone",
      detail:
        "The selected voice characteristics contain formal or authoritative cues while the tone scale leans casual. Define where authority ends and conversational warmth begins.",
    });
  }

  if (
    tone !== null &&
    tone <= 2 &&
    containsAny(
      voiceText,
      [
        "casual",
        "playful",
        "conversational",
      ],
    )
  ) {
    alignmentFlags.push({
      id: "casual-formal",
      severity: "review",
      title:
        "Casual voice cues vs. formal tone",
      detail:
        "The selected voice characteristics contain casual or playful cues while the tone scale leans formal. This should be clarified before writing voice guidelines.",
    });
  }

  const visualAvoid =
    lowerText(
      answerFor("visualAvoid"),
    );

  for (
    const selectedStyle
    of visualSelections
  ) {
    const normalized =
      selectedStyle
        .trim()
        .toLowerCase();

    if (
      normalized.length >= 4 &&
      visualAvoid.includes(normalized)
    ) {
      alignmentFlags.push({
        id:
          `visual-avoid-${slug(
            normalized,
          )}`,
        severity: "conflict",
        title:
          "Visual preference conflicts with visual boundary",
        detail:
          `"${selectedStyle}" appears both as a preferred visual direction and inside the client's description of what the brand should avoid.`,
      });
    }
  }

  const personalitySelections =
    stringArray(
      answerFor("personality"),
    );

  const neverFeel =
    lowerText(
      answerFor("neverFeel"),
    );

  for (
    const personality
    of personalitySelections
  ) {
    const normalized =
      personality
        .trim()
        .toLowerCase();

    if (
      normalized.length >= 4 &&
      neverFeel.includes(normalized)
    ) {
      alignmentFlags.push({
        id:
          `personality-boundary-${slug(
            normalized,
          )}`,
        severity: "conflict",
        title:
          "Personality conflicts with final boundary",
        detail:
          `"${personality}" is selected as a future brand characteristic but also appears in the client's description of what the brand should never feel like.`,
      });
    }
  }

  const modernity =
    numericValue(
      answerFor("modernity"),
    );

  const combinedStyleLanguage = [
    ...personalitySelections,
    ...visualSelections,
  ]
    .join(" ")
    .toLowerCase();

  if (
    modernity !== null &&
    modernity >= 4 &&
    containsAny(
      combinedStyleLanguage,
      [
        "traditional",
        "heritage",
        "classic",
      ],
    )
  ) {
    alignmentFlags.push({
      id: "modern-classic-tension",
      severity: "review",
      title:
        "Modernity scale vs. classic cues",
      detail:
        "The modernity scale leans modern while selected personality or visual cues reference classic, traditional, or heritage qualities. This can work, but the intended balance should be explicit.",
    });
  }

  if (
    modernity !== null &&
    modernity <= 2 &&
    containsAny(
      combinedStyleLanguage,
      [
        "modern",
        "contemporary",
        "futuristic",
      ],
    )
  ) {
    alignmentFlags.push({
      id: "traditional-modern-tension",
      severity: "review",
      title:
        "Traditional scale vs. modern cues",
      detail:
        "The modernity scale leans traditional while selected personality or visual cues reference modern or contemporary qualities. Clarify which direction should lead.",
    });
  }

  const missingRequired =
    requiredQuestions
      .filter(
        (question) =>
          !isIntelligenceAnswered(
            answerFor(question.id),
          ),
      )
      .map((question) => ({
        id: question.id,
        section:
          question.section,
        title:
          question.title,
      }));

  const questionCount =
    questionMetadata.length;

  const answeredCount =
    answeredQuestions.length;

  const completion =
    questionCount === 0
      ? 0
      : Math.round(
          (answeredCount /
            questionCount) *
            100,
        );

  return {
    questionCount,
    answeredCount,
    requiredCount:
      requiredQuestions.length,
    requiredAnsweredCount:
      requiredAnswered.length,
    completion,
    overallStrength:
      strengthFromCoverage(
        answeredCount,
        questionCount,
      ),
    strategicSignals,
    scaleSignals,
    advancedSections,
    alignmentFlags,
    missingRequired,
  };
}
import type {
  BrandIntelligence,
  IntelligenceQuestionResult,
  SignalStrength,
} from "@/lib/discovery-intelligence";

type ReadinessLevel =
  | "Early"
  | "Developing"
  | "Strong"
  | "Ready";

function strengthLabel(
  strength: SignalStrength,
) {
  if (strength === "strong") {
    return "Strong";
  }

  if (strength === "developing") {
    return "Developing";
  }

  return "Insufficient data";
}

function strengthClasses(
  strength: SignalStrength,
) {
  if (strength === "strong") {
    return "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200/80";
  }

  if (strength === "developing") {
    return "border-[#c5a577]/20 bg-[#c5a577]/[0.07] text-[#d9bd94]";
  }

  return "border-white/10 bg-white/[0.025] text-white/35";
}

function StrengthBadge({
  strength,
}: {
  strength: SignalStrength;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-medium tracking-[0.08em] uppercase ${strengthClasses(
        strength,
      )}`}
    >
      {strengthLabel(strength)}
    </span>
  );
}

function formatAnswer(
  value: unknown,
) {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
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
      .map((item) =>
        item.trim(),
      );
  }

  return null;
}

function readiness(
  intelligence: BrandIntelligence,
): {
  score: number;
  level: ReadinessLevel;
  description: string;
} {
  const strategicAvailable =
    intelligence.strategicSignals.filter(
      (signal) =>
        signal.strength !==
        "insufficient",
    ).length;

  const strategicTotal =
    intelligence.strategicSignals.length;

  const strategicCoverage =
    strategicTotal > 0
      ? strategicAvailable /
        strategicTotal
      : 0;

  const requiredCoverage =
    intelligence.requiredCount > 0
      ? intelligence.requiredAnsweredCount /
        intelligence.requiredCount
      : 0;

  const directionSections =
    intelligence.advancedSections.filter(
      (section) =>
        [
          "Personality",
          "Visual",
          "Voice",
        ].includes(section.label),
    );

  const directionTotal =
    directionSections.reduce(
      (total, section) =>
        total +
        section.totalCount,
      0,
    );

  const directionAnswered =
    directionSections.reduce(
      (total, section) =>
        total +
        section.answeredCount,
      0,
    );

  const directionCoverage =
    directionTotal > 0
      ? directionAnswered /
        directionTotal
      : 0;

  const score = Math.round(
    strategicCoverage * 55 +
      requiredCoverage * 30 +
      directionCoverage * 15,
  );

  if (
    score >= 90 &&
    intelligence.missingRequired
      .length === 0
  ) {
    return {
      score,
      level: "Ready",
      description:
        "Discovery evidence is sufficient for full strategy synthesis.",
    };
  }

  if (score >= 70) {
    return {
      score,
      level: "Strong",
      description:
        "Most strategic foundations are established, with several refinements still pending.",
    };
  }

  if (score >= 35) {
    return {
      score,
      level: "Developing",
      description:
        "Core strategic signals are emerging, but important direction evidence is still missing.",
    };
  }

  return {
    score,
    level: "Early",
    description:
      "There is not yet enough discovery evidence for reliable strategic direction.",
  };
}

function QuestionAnswer({
  question,
}: {
  question: IntelligenceQuestionResult;
}) {
  const formatted =
    formatAnswer(question.answer);

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-[10px] font-medium tracking-[0.13em] text-white/25 uppercase">
            {question.required
              ? "Required"
              : "Optional"}
          </p>

          <h4 className="mt-2 text-sm font-medium leading-6 text-white/65">
            {question.title}
          </h4>
        </div>

        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#c5a577]" />
      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-4">
        {Array.isArray(formatted) ? (
          <div className="flex flex-wrap gap-2">
            {formatted.map(
              (item, index) => (
                <span
                  key={`${item}-${index}`}
                  className="rounded-full border border-[#c5a577]/20 bg-[#c5a577]/[0.06] px-3 py-1.5 text-xs text-[#d9c09b]"
                >
                  {item}
                </span>
              ),
            )}
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-7 text-white/60">
            {formatted}
          </p>
        )}
      </div>
    </article>
  );
}

function ScaleCard({
  title,
  leftLabel,
  rightLabel,
  value,
}: {
  title: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
}) {
  let position = 0;

  if (value >= 1 && value <= 5) {
    position =
      ((value - 1) / 4) * 100;
  } else if (
    value >= 0 &&
    value <= 10
  ) {
    position = value * 10;
  } else {
    position = Math.min(
      100,
      Math.max(0, value),
    );
  }

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-start justify-between gap-5">
        <p className="text-sm font-medium leading-6 text-white/65">
          {title}
        </p>

        <span className="text-xs text-[#cdb188]">
          {value}
        </span>
      </div>

      <div className="mt-6">
        <div className="relative h-1 rounded-full bg-white/10">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-[#c5a577]"
            style={{
              width: `${position}%`,
            }}
          />

          <span
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#11110f] bg-[#d8bd92]"
            style={{
              left: `${position}%`,
            }}
          />
        </div>

        <div className="mt-3 flex justify-between text-[10px] text-white/30">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      </div>
    </article>
  );
}

const unlocks: Record<
  string,
  string[]
> = {
  Personality: [
    "Dominant personality traits",
    "Traditional / Modern direction",
    "Minimal / Expressive direction",
    "Accessible / Exclusive direction",
  ],
  Visual: [
    "Preferred visual language",
    "Color direction",
    "Visual boundaries",
  ],
  Voice: [
    "Voice characteristics",
    "Formal / Casual direction",
    "Communication guidance",
  ],
  Final: [
    "Non-negotiable brand boundaries",
    "Definition of creative success",
  ],
};

function EmptyDirectionSection({
  label,
  total,
}: {
  label: string;
  total: number;
}) {
  const items =
    unlocks[label] ?? [
      "Additional strategic direction",
    ];

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.018] p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
        <div>
          <p className="text-[10px] font-medium tracking-[0.16em] text-[#c5a577] uppercase">
            Discovery Intelligence
          </p>

          <h3 className="mt-3 text-2xl font-medium tracking-[-0.025em]">
            {label}
          </h3>

          <p className="mt-3 text-sm text-white/30">
            0 of {total} answered
          </p>
        </div>

        <StrengthBadge strength="insufficient" />
      </div>

      <div className="mt-7 border-t border-white/[0.07] pt-6">
        <p className="text-xs font-medium text-white/35">
          Complete this section to unlock:
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 text-xs text-white/30"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#c5a577]/50" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function BrandIntelligenceAnalysis({
  intelligence,
}: {
  intelligence: BrandIntelligence;
}) {
  const strategyReadiness =
    readiness(intelligence);

  return (
    <section
      id="analysis"
      className="scroll-mt-24 border-t border-white/10 py-12 sm:py-16"
    >
      <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[#c5a577] uppercase">
            Strategic Intelligence
          </p>

          <h2 className="mt-3 text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
            Brand analysis.
          </h2>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/40">
            Evidence-based strategic signals derived directly from the discovery questionnaire.
          </p>
        </div>

        <StrengthBadge
          strength={
            intelligence.overallStrength
          }
        />
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Discovery progress
          </p>

          <p className="mt-5 text-4xl font-medium tracking-[-0.04em]">
            {intelligence.completion}%
          </p>

          <p className="mt-4 text-xs leading-5 text-white/30">
            {intelligence.answeredCount} of{" "}
            {intelligence.questionCount} questions answered
          </p>
        </article>

        <article className="rounded-2xl border border-[#c5a577]/20 bg-[#c5a577]/[0.055] p-6">
          <p className="text-[10px] tracking-[0.15em] text-[#c9a777] uppercase">
            Strategy readiness
          </p>

          <p className="mt-5 text-2xl font-medium tracking-[-0.025em]">
            {strategyReadiness.level}
          </p>

          <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#c5a577]"
              style={{
                width: `${strategyReadiness.score}%`,
              }}
            />
          </div>

          <p className="mt-4 text-xs leading-5 text-white/35">
            {strategyReadiness.score}% evidence readiness
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Required evidence
          </p>

          <p className="mt-5 text-4xl font-medium tracking-[-0.04em]">
            {intelligence.requiredAnsweredCount}/
            {intelligence.requiredCount}
          </p>

          <p className="mt-4 text-xs leading-5 text-white/30">
            Required answers currently available
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Missing evidence
          </p>

          <p className="mt-5 text-4xl font-medium tracking-[-0.04em]">
            {intelligence.missingRequired.length}
          </p>

          <p className="mt-4 text-xs leading-5 text-white/30">
            Required answers still needed
          </p>
        </article>
      </div>

      <div className="mt-5 rounded-2xl border border-white/[0.07] px-5 py-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <p className="text-xs font-medium text-white/45">
            Strategy readiness:{" "}
            <span className="text-[#d2b486]">
              {strategyReadiness.level}
            </span>
          </p>

          <p className="max-w-3xl text-xs leading-5 text-white/30">
            {strategyReadiness.description}
          </p>
        </div>
      </div>

      <div className="mt-12">
        <p className="text-[10px] font-medium tracking-[0.16em] text-white/30 uppercase">
          Strategic Signals
        </p>

        <h3 className="mt-3 text-2xl font-medium tracking-[-0.025em]">
          What we know so far.
        </h3>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {intelligence.strategicSignals.map(
            (signal) => (
              <article
                key={signal.id}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[10px] font-medium tracking-[0.14em] text-white/30 uppercase">
                    {signal.label}
                  </p>

                  <StrengthBadge
                    strength={
                      signal.strength
                    }
                  />
                </div>

                <p
                  className={`mt-4 text-sm leading-7 ${
                    signal.strength ===
                    "insufficient"
                      ? "text-white/25"
                      : "text-white/65"
                  }`}
                >
                  {signal.value}
                </p>
              </article>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

export function BrandDirectionWorkspace({
  intelligence,
}: {
  intelligence: BrandIntelligence;
}) {
  const answeredScales =
    intelligence.scaleSignals.filter(
      (scale) => scale.answered,
    );

  const missingScaleCount =
    intelligence.scaleSignals.length -
    answeredScales.length;

  return (
    <section
      id="direction"
      className="scroll-mt-24 border-t border-white/10 py-12 sm:py-16"
    >
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-[#c5a577] uppercase">
          Brand Direction
        </p>

        <h2 className="mt-3 text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
          Personality, visual and voice.
        </h2>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/40">
          Directional evidence becomes more detailed as the client reaches the later discovery sections.
        </p>
      </div>

      <div className="mt-10">
        <div className="flex items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-medium tracking-[0.15em] text-white/30 uppercase">
              Brand Spectrum
            </p>

            <h3 className="mt-3 text-2xl font-medium">
              Personality and voice scales.
            </h3>
          </div>

          <span className="text-xs text-white/25">
            {answeredScales.length} of{" "}
            {intelligence.scaleSignals.length} available
          </span>
        </div>

        {answeredScales.length > 0 ? (
          <>
            <div className="mt-6 grid gap-3 lg:grid-cols-2">
              {answeredScales.map(
                (scale) => (
                  <ScaleCard
                    key={scale.id}
                    title={scale.title}
                    leftLabel={scale.leftLabel}
                    rightLabel={scale.rightLabel}
                    value={scale.value as number}
                  />
                ),
              )}
            </div>

            {missingScaleCount > 0 && (
              <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-5 py-4 text-xs text-white/30">
                {missingScaleCount} additional spectrum{" "}
                {missingScaleCount === 1
                  ? "dimension"
                  : "dimensions"}{" "}
                will unlock as discovery continues.
              </div>
            )}
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 px-6 py-8">
            <p className="text-sm font-medium text-white/45">
              Brand spectrum is not available yet.
            </p>

            <p className="mt-3 max-w-2xl text-xs leading-6 text-white/25">
              Traditional / Modern, Minimal / Expressive, Accessible / Exclusive, and Formal / Casual will appear here once those questions are answered.
            </p>
          </div>
        )}
      </div>

      <div className="mt-10 space-y-3">
        {intelligence.advancedSections.map(
          (section) => {
            if (
              section.answeredCount === 0
            ) {
              return (
                <EmptyDirectionSection
                  key={section.id}
                  label={section.label}
                  total={section.totalCount}
                />
              );
            }

            const answered =
              section.questions.filter(
                (question) =>
                  question.answered,
              );

            const unanswered =
              section.totalCount -
              section.answeredCount;

            return (
              <section
                key={section.id}
                className="rounded-3xl border border-white/10 bg-white/[0.018] p-6 sm:p-8"
              >
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                  <div>
                    <p className="text-[10px] font-medium tracking-[0.16em] text-[#c5a577] uppercase">
                      Discovery Intelligence
                    </p>

                    <h3 className="mt-3 text-2xl font-medium">
                      {section.label}
                    </h3>

                    <p className="mt-3 text-sm text-white/30">
                      {section.answeredCount} of{" "}
                      {section.totalCount} answered
                    </p>
                  </div>

                  <StrengthBadge
                    strength={
                      section.strength
                    }
                  />
                </div>

                <div className="mt-7 grid gap-3 lg:grid-cols-2">
                  {answered.map(
                    (question) => (
                      <QuestionAnswer
                        key={question.id}
                        question={question}
                      />
                    ),
                  )}
                </div>

                {unanswered > 0 && (
                  <p className="mt-5 text-xs text-white/25">
                    {unanswered} additional{" "}
                    {unanswered === 1
                      ? "answer"
                      : "answers"}{" "}
                    still needed in this section.
                  </p>
                )}
              </section>
            );
          },
        )}
      </div>
    </section>
  );
}

export function BrandAlignmentWorkspace({
  intelligence,
}: {
  intelligence: BrandIntelligence;
}) {
  const groupedMissing =
    intelligence.missingRequired.reduce<
      Record<
        string,
        typeof intelligence.missingRequired
      >
    >((groups, item) => {
      if (!groups[item.section]) {
        groups[item.section] = [];
      }

      groups[item.section].push(item);

      return groups;
    }, {});

  return (
    <section
      id="alignment"
      className="scroll-mt-24 border-t border-white/10 py-12 sm:py-16"
    >
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-[#c5a577] uppercase">
          Strategic Alignment
        </p>

        <h2 className="mt-3 text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
          Alignment and readiness.
        </h2>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/40">
          Review strategic tensions and identify exactly what evidence is still required before strategy synthesis.
        </p>
      </div>

      <div className="mt-9">
        <p className="text-[10px] font-medium tracking-[0.15em] text-white/30 uppercase">
          Alignment Flags
        </p>

        {intelligence.alignmentFlags.length ===
        0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-6 py-8">
            <p className="text-sm text-white/40">
              No clear contradictions are detectable from the responses currently available.
            </p>

            <p className="mt-3 text-xs leading-6 text-white/25">
              Additional checks will activate automatically as later discovery sections are completed.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {intelligence.alignmentFlags.map(
              (flag) => (
                <article
                  key={flag.id}
                  className={`rounded-2xl border p-6 ${
                    flag.severity ===
                    "conflict"
                      ? "border-red-300/15 bg-red-300/[0.045]"
                      : "border-[#c5a577]/20 bg-[#c5a577]/[0.045]"
                  }`}
                >
                  <p className="text-[10px] font-medium tracking-[0.15em] text-white/30 uppercase">
                    {flag.severity ===
                    "conflict"
                      ? "Conflict"
                      : "Review"}
                  </p>

                  <h3 className="mt-3 text-base font-medium">
                    {flag.title}
                  </h3>

                  <p className="mt-4 text-sm leading-7 text-white/50">
                    {flag.detail}
                  </p>
                </article>
              ),
            )}
          </div>
        )}
      </div>

      <div className="mt-12">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-[10px] font-medium tracking-[0.15em] text-white/30 uppercase">
              Missing Intelligence
            </p>

            <h3 className="mt-3 text-2xl font-medium">
              What we cannot conclude yet.
            </h3>
          </div>

          <span className="text-xs text-white/30">
            {intelligence.missingRequired.length} required answers missing
          </span>
        </div>

        {intelligence.missingRequired.length ===
        0 ? (
          <div className="mt-6 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045] p-6">
            <p className="text-sm text-emerald-100/70">
              All required discovery intelligence is available.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {Object.entries(
              groupedMissing,
            ).map(
              ([section, items]) => (
                <article
                  key={section}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
                >
                  <div className="flex items-center justify-between gap-5">
                    <p className="text-xs font-medium text-[#ceb184]">
                      {section}
                    </p>

                    <span className="text-[10px] text-white/25">
                      {items.length} missing
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {items.map((item) => (
                      <p
                        key={item.id}
                        className="text-xs leading-5 text-white/35"
                      >
                        • {item.title}
                      </p>
                    ))}
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
}
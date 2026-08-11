import type {
  StrategyDeliverable,
  StrategyStatus,
  StrategySynthesis,
} from "@/lib/strategy-synthesis";

function statusLabel(
  status: StrategyStatus,
) {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "developing") {
    return "Developing";
  }

  return "Insufficient";
}

function statusClass(
  status: StrategyStatus,
) {
  if (status === "ready") {
    return "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200/80";
  }

  if (status === "developing") {
    return "border-[#c5a577]/20 bg-[#c5a577]/[0.07] text-[#d9bd94]";
  }

  return "border-white/10 bg-white/[0.025] text-white/35";
}

function StatusBadge({
  status,
}: {
  status: StrategyStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-medium tracking-[0.09em] uppercase ${statusClass(
        status,
      )}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function DeliverableCard({
  item,
}: {
  item: StrategyDeliverable;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-[10px] font-medium tracking-[0.16em] text-[#c5a577] uppercase">
            {item.category}
          </p>

          <h3 className="mt-3 text-xl font-medium tracking-[-0.02em]">
            {item.label}
          </h3>
        </div>

        <StatusBadge
          status={item.status}
        />
      </div>

      <div className="mt-6 border-t border-white/[0.07] pt-6">
        <p
          className={`text-sm leading-7 ${
            item.status ===
            "insufficient"
              ? "text-white/30"
              : "text-white/70"
          }`}
        >
          {item.statement}
        </p>
      </div>

      {item.status !==
        "insufficient" && (
        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/10 p-4">
          <p className="text-[10px] tracking-[0.14em] text-white/25 uppercase">
            Strategic use
          </p>

          <p className="mt-2 text-xs leading-6 text-white/40">
            {item.guidance}
          </p>
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-5">
          <p className="text-[10px] tracking-[0.14em] text-white/25 uppercase">
            Evidence quality
          </p>

          <span className="text-xs text-white/35">
            {item.evidenceScore}%
          </span>
        </div>

        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#c5a577]"
            style={{
              width: `${item.evidenceScore}%`,
            }}
          />
        </div>
      </div>

      {item.evidence.length > 0 && (
        <div className="mt-6 border-t border-white/[0.06] pt-5">
          <p className="text-[10px] tracking-[0.14em] text-white/20 uppercase">
            Evidence
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {item.evidence.map(
              (evidence) => (
                <span
                  key={
                    evidence.questionId
                  }
                  title={evidence.value}
                  className="rounded-full border border-white/[0.08] px-3 py-1.5 text-[10px] text-white/35"
                >
                  {evidence.title}
                </span>
              ),
            )}
          </div>
        </div>
      )}

      {item.missing.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] tracking-[0.14em] text-white/20 uppercase">
            Still needed
          </p>

          <p className="mt-2 text-xs leading-6 text-white/30">
            {item.missing.join(
              " / ",
            )}
          </p>
        </div>
      )}
    </article>
  );
}

export default function BrandStrategySynthesis({
  synthesis,
}: {
  synthesis: StrategySynthesis;
}) {
  return (
    <section
      id="strategy"
      className="scroll-mt-24 border-t border-white/10 py-12 sm:py-16"
    >
      <div className="flex flex-col justify-between gap-7 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[#c5a577] uppercase">
            Strategy Synthesis
          </p>

          <h2 className="mt-3 text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
            Working brand strategy.
          </h2>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/40">
            Structured strategy assembled from the discovery evidence currently available. Conclusions remain provisional until sufficient evidence exists.
          </p>
        </div>

        <StatusBadge
          status={synthesis.status}
        />
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Strategy status
          </p>

          <p className="mt-5 text-2xl font-medium">
            {statusLabel(
              synthesis.status,
            )}
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Ready
          </p>

          <p className="mt-5 text-4xl font-medium tracking-[-0.04em]">
            {synthesis.readyCount}
          </p>

          <p className="mt-3 text-xs text-white/30">
            of{" "}
            {synthesis.deliverableCount}{" "}
            strategic outputs
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Evidence quality
          </p>

          <p className="mt-5 text-4xl font-medium tracking-[-0.04em]">
            {synthesis.evidenceScore}%
          </p>
        </article>

        <article
          className={`rounded-2xl border p-6 ${
            synthesis.reportReady
              ? "border-emerald-300/15 bg-emerald-300/[0.045]"
              : "border-[#c5a577]/20 bg-[#c5a577]/[0.045]"
          }`}
        >
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Strategy report
          </p>

          <p className="mt-5 text-lg font-medium">
            {synthesis.reportReady
              ? "Ready to generate"
              : "Not ready yet"}
          </p>
        </article>
      </div>

      <div className="mt-12">
        <p className="text-[10px] font-medium tracking-[0.16em] text-white/30 uppercase">
          Strategic Deliverables
        </p>

        <h3 className="mt-3 text-2xl font-medium tracking-[-0.025em]">
          What the evidence supports.
        </h3>

        <div className="mt-6 grid gap-3 xl:grid-cols-2">
          {synthesis.deliverables.map(
            (item) => (
              <DeliverableCard
                key={item.id}
                item={item}
              />
            ),
          )}
        </div>
      </div>

      <div className="mt-14 border-t border-white/10 pt-12">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-[10px] font-medium tracking-[0.16em] text-white/30 uppercase">
              Strategy Risks
            </p>

            <h3 className="mt-3 text-2xl font-medium tracking-[-0.025em]">
              What still needs resolution.
            </h3>
          </div>

          <span className="text-xs text-white/30">
            {synthesis.risks.length}{" "}
            {synthesis.risks.length ===
            1
              ? "item"
              : "items"}
          </span>
        </div>

        {synthesis.risks.length ===
        0 ? (
          <div className="mt-6 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045] p-6">
            <p className="text-sm text-emerald-100/70">
              No unresolved strategic risks are currently detected.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {synthesis.risks.map(
              (risk) => (
                <article
                  key={risk.id}
                  className={`rounded-2xl border p-5 ${
                    risk.severity ===
                    "blocking"
                      ? "border-red-300/15 bg-red-300/[0.04]"
                      : "border-[#c5a577]/20 bg-[#c5a577]/[0.04]"
                  }`}
                >
                  <p className="text-[10px] font-medium tracking-[0.14em] text-white/25 uppercase">
                    {risk.severity ===
                    "blocking"
                      ? "Blocking"
                      : "Review"}
                  </p>

                  <h4 className="mt-3 text-sm font-medium">
                    {risk.title}
                  </h4>

                  <p className="mt-3 text-xs leading-6 text-white/40">
                    {risk.detail}
                  </p>
                </article>
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
}
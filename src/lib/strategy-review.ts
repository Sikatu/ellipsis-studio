import type {
  StrategyDeliverable,
  StrategySynthesis,
} from "@/lib/strategy-synthesis";

export type StrategyReviewStatus =
  | "pending"
  | "approved"
  | "needs_revision"
  | "rejected";

export type StrategyReviewLike = {
  deliverable_id: string;
  status: StrategyReviewStatus;
  notes?: string | null;
  source_fingerprint: string;
};

export type StrategyApprovalGate = {
  ready: boolean;
  reportReady: boolean;
  approvedCount: number;
  deliverableCount: number;
  staleCount: number;
  waitingEvidence: number;
  missingApprovals: string[];
  staleApprovals: string[];
};

function fnv1a(value: string) {
  let hash = 0x811c9dc5;

  for (
    let index = 0;
    index < value.length;
    index++
  ) {
    hash ^= value.charCodeAt(index);

    hash = Math.imul(
      hash,
      0x01000193,
    );
  }

  return `fnv1a:${(
    hash >>> 0
  )
    .toString(16)
    .padStart(8, "0")}`;
}

export function buildStrategyFingerprint(
  item: StrategyDeliverable,
) {
  const source = JSON.stringify({
    id: item.id,
    status: item.status,
    statement: item.statement,
    evidenceScore:
      item.evidenceScore,
    evidence:
      item.evidence.map(
        (evidence) => ({
          id:
            evidence.questionId,
          value:
            evidence.value,
          quality:
            evidence.quality,
        }),
      ),
    missing: item.missing,
  });

  return fnv1a(source);
}

export function evaluateStrategyApprovalGate(
  synthesis: StrategySynthesis,
  reviews: StrategyReviewLike[],
): StrategyApprovalGate {
  const reviewMap = new Map(
    reviews.map((review) => [
      review.deliverable_id,
      review,
    ]),
  );

  let approvedCount = 0;
  let staleCount = 0;
  let waitingEvidence = 0;

  const missingApprovals: string[] =
    [];

  const staleApprovals: string[] =
    [];

  for (
    const item
    of synthesis.deliverables
  ) {
    if (
      item.status ===
      "insufficient"
    ) {
      waitingEvidence++;

      missingApprovals.push(
        item.label,
      );

      continue;
    }

    const review =
      reviewMap.get(item.id);

    if (!review) {
      missingApprovals.push(
        item.label,
      );

      continue;
    }

    const currentFingerprint =
      buildStrategyFingerprint(item);

    if (
      review.source_fingerprint !==
      currentFingerprint
    ) {
      staleCount++;

      staleApprovals.push(
        item.label,
      );

      continue;
    }

    if (
      review.status ===
      "approved"
    ) {
      approvedCount++;

      continue;
    }

    missingApprovals.push(
      item.label,
    );
  }

  const ready =
    synthesis.reportReady &&
    approvedCount ===
      synthesis.deliverableCount &&
    staleCount === 0 &&
    waitingEvidence === 0;

  return {
    ready,
    reportReady:
      synthesis.reportReady,
    approvedCount,
    deliverableCount:
      synthesis.deliverableCount,
    staleCount,
    waitingEvidence,
    missingApprovals,
    staleApprovals,
  };
}

export function buildApprovedStrategyPackageFingerprint(
  synthesis: StrategySynthesis,
  reviews: StrategyReviewLike[],
) {
  const reviewMap = new Map(
    reviews.map((review) => [
      review.deliverable_id,
      review,
    ]),
  );

  return fnv1a(
    JSON.stringify(
      synthesis.deliverables.map(
        (item) => {
          const review =
            reviewMap.get(item.id);

          return {
            id: item.id,
            fingerprint:
              buildStrategyFingerprint(
                item,
              ),
            reviewStatus:
              review?.status ??
              "pending",
            studioNotes:
              review?.notes ??
              "",
          };
        },
      ),
    ),
  );
}
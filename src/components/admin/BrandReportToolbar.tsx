"use client";

import Link from "next/link";

export default function BrandReportToolbar({
  projectId,
  reportId,
  clientId,
  brandName,
  reportNumber,
  status,
}: {
  projectId: string;

  reportId:
    | string
    | null;

  clientId: string;

  brandName: string;

  reportNumber:
    | number
    | null;

  status:
    | "draft"
    | "ready"
    | "issued"
    | null;
}) {
  const printable =
    status === "ready" ||
    status === "issued";

  const nativePdfAvailable =
    printable &&
    Boolean(
      reportId,
    );

  return (
    <div className="flex w-full items-center justify-between gap-4">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">
          ELLIPSIS Report Preview
        </p>

        <p className="mt-1 text-sm text-white/65">
          {brandName}

          {reportNumber
            ? ` | Report ${reportNumber}`
            : ""}

          {status
            ? ` | ${status}`
            : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={`/admin/clients/${clientId}#report-production`}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-xs text-white/45 transition hover:border-white/20 hover:text-white/75"
        >
          Back to production
        </Link>

        {nativePdfAvailable &&
          reportId && (
          <Link
            href={`/api/admin/reports/pdf?projectId=${encodeURIComponent(
              projectId,
            )}&reportId=${encodeURIComponent(
              reportId,
            )}`}
            className="rounded-xl bg-[#f4f0e8] px-4 py-2.5 text-xs font-semibold text-[#11110f] transition hover:bg-white"
          >
            Download PDF
          </Link>
        )}

        {printable && (
          <button
            type="button"
            onClick={() =>
              window.print()
            }
            className="rounded-xl border border-white/10 px-4 py-2.5 text-xs text-white/50 transition hover:border-white/20 hover:text-white/80"
          >
            Browser Print
          </button>
        )}
      </div>
    </div>
  );
}
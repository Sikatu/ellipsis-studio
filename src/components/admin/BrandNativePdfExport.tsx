import Link from "next/link";

type ExportReport = {
  id: string;

  report_number: number;

  status:
    | "draft"
    | "ready"
    | "issued";
};

export default function BrandNativePdfExport({
  projectId,
  workingReport,
  issuedReports,
}: {
  projectId: string;

  workingReport:
    | ExportReport
    | null;

  issuedReports:
    ExportReport[];
}) {
  const readyReport =
    workingReport?.status ===
      "ready"
      ? workingReport
      : null;

  const downloadable = [
    ...(readyReport
      ? [
          readyReport,
        ]
      : []),

    ...issuedReports,
  ];

  return (
    <div className="mt-12 rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-medium tracking-[0.15em] text-[#c5a577] uppercase">
            Native PDF
          </p>

          <h3 className="mt-2 text-2xl font-medium">
            Server-rendered client file.
          </h3>

          <p className="mt-3 max-w-2xl text-xs leading-6 text-white/30">
            PDF export is generated directly on the server from the frozen production report snapshot. Draft reports cannot be downloaded.
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full border px-4 py-2 text-[10px] font-medium ${
            downloadable.length >
            0
              ? "border-emerald-300/20 bg-emerald-300/[0.04] text-emerald-100/65"
              : "border-white/10 text-white/30"
          }`}
        >
          {downloadable.length >
          0
            ? "PDF available"
            : "Locked until Ready"}
        </span>
      </div>

      {downloadable.length >
      0 ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {downloadable.map(
            (report) => (
              <Link
                key={
                  report.id
                }
                href={`/api/admin/reports/pdf?projectId=${encodeURIComponent(
                  projectId,
                )}&reportId=${encodeURIComponent(
                  report.id,
                )}`}
                className="rounded-xl bg-[#f5f0e6] px-5 py-3 text-xs font-semibold text-[#11110f] transition hover:bg-white"
              >
                Download Report {
                  report.report_number
                } PDF
              </Link>
            ),
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-white/[0.07] px-4 py-4 text-xs leading-6 text-white/25">
          Mark a production report Ready before native PDF export becomes available.
        </div>
      )}
    </div>
  );
}
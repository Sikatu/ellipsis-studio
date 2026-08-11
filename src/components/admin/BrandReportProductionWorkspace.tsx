"use client";

import Link from "next/link";

import BrandNativePdfExport from "@/components/admin/BrandNativePdfExport";

import BrandDeliverableVault from "@/components/admin/BrandDeliverableVault";

import BrandClientDeliveryPortal from "@/components/admin/BrandClientDeliveryPortal";

import BrandDeliveryAuditTrail from "@/components/admin/BrandDeliveryAuditTrail";

import BrandDeliveryOperations from "@/components/admin/BrandDeliveryOperations";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  defaultReportConfiguration,
  reportSectionOptions,
  type StrategyReportConfiguration,
  type StrategyReportRecord,
} from "@/lib/report-production";

type ApprovedVersion = {
  id: string;
  versionNumber: number;
  approvedAt: string | null;
};

type WorkspacePayload = {
  project: {
    id: string;
    title: string;
  };

  approvedVersions:
    ApprovedVersion[];

  workingReport:
    StrategyReportRecord | null;

  reports:
    StrategyReportRecord[];

  error?: string;
};

const fieldClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-white/70 outline-none transition placeholder:text-white/20 focus:border-[#c5a577]/40";

function dateLabel(
  value: string | null,
) {
  if (!value) {
    return "Not issued";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}

export default function BrandReportProductionWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const [
    workspace,
    setWorkspace,
  ] = useState<
    WorkspacePayload | null
  >(null);

  const [
    configuration,
    setConfiguration,
  ] = useState<
    StrategyReportConfiguration | null
  >(null);

  const [
    selectedSource,
    setSelectedSource,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState<
    string | null
  >(null);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const loadWorkspace =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              `/api/admin/reports?projectId=${encodeURIComponent(
                projectId,
              )}`,
              {
                cache:
                  "no-store",
              },
            );

          const payload =
            (await response.json()) as
              WorkspacePayload;

          if (!response.ok) {
            throw new Error(
              payload.error ||
                "Could not load report production.",
            );
          }

          setWorkspace(
            payload,
          );

          if (
            payload.workingReport
          ) {
            setConfiguration(
              payload
                .workingReport
                .configuration,
            );
          }
          else {
            setConfiguration(
              defaultReportConfiguration(
                payload.project.title,
              ),
            );
          }

          setSelectedSource(
            (current) =>
              current ||
              payload
                .approvedVersions[0]
                ?.id ||
              "",
          );

          setError(null);
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load report production.",
          );
        } finally {
          setLoading(false);
        }
      },
      [projectId],
    );

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void loadWorkspace();
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [loadWorkspace]);

  const working =
    workspace?.workingReport ??
    null;

  const dirty =
    useMemo(() => {
      if (
        !working ||
        !configuration
      ) {
        return false;
      }

      return (
        JSON.stringify(
          working.configuration,
        ) !==
        JSON.stringify(
          configuration,
        )
      );
    }, [
      configuration,
      working,
    ]);

  async function createReport() {
    if (!selectedSource) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response =
        await fetch(
          "/api/admin/reports",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "create",

                projectId,

                sourceStrategyVersionId:
                  selectedSource,
              }),
          },
        );

      const payload =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Could not create report.",
        );
      }

      await loadWorkspace();

      setMessage(
        "Production report draft created from the approved Final Strategy snapshot.",
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create report.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveConfiguration() {
    if (
      !working ||
      !configuration ||
      working.status !==
        "draft"
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response =
        await fetch(
          "/api/admin/reports",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                projectId,

                reportId:
                  working.id,

                configuration,
              }),
          },
        );

      const payload =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Could not save report configuration.",
        );
      }

      await loadWorkspace();

      setMessage(
        "Report configuration saved.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save report configuration.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function performAction(
    action:
      | "ready"
      | "reopen"
      | "issue",
  ) {
    if (!working) {
      return;
    }

    if (
      action === "ready" &&
      dirty
    ) {
      setError(
        "Save the report configuration before marking it ready.",
      );

      return;
    }

    if (
      action === "issue"
    ) {
      const confirmed =
        window.confirm(
          "Issue this report? Issued reports become immutable production records.",
        );

      if (!confirmed) {
        return;
      }
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response =
        await fetch(
          "/api/admin/reports",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action,

                projectId,

                reportId:
                  working.id,
              }),
          },
        );

      const payload =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Report status update failed.",
        );
      }

      await loadWorkspace();

      setMessage(
        action === "issue"
          ? "Report issued and frozen as an immutable production record."
          : action === "ready"
            ? "Report marked ready for client delivery."
            : "Report reopened for editing.",
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Report status update failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function discardReport() {
    if (!working) {
      return;
    }

    const confirmed =
      window.confirm(
        "Discard this working production report? Issued reports are never affected.",
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response =
        await fetch(
          `/api/admin/reports?projectId=${encodeURIComponent(
            projectId,
          )}&reportId=${encodeURIComponent(
            working.id,
          )}`,
          {
            method:
              "DELETE",
          },
        );

      const payload =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Could not discard report.",
        );
      }

      await loadWorkspace();

      setMessage(
        "Working production report discarded.",
      );
    } catch (discardError) {
      setError(
        discardError instanceof Error
          ? discardError.message
          : "Could not discard report.",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateConfiguration<
    K extends keyof StrategyReportConfiguration,
  >(
    key: K,
    value:
      StrategyReportConfiguration[K],
  ) {
    setConfiguration(
      (current) =>
        current
          ? {
              ...current,
              [key]:
                value,
            }
          : current,
    );
  }

  function toggleSection(
    sectionId:
      StrategyReportConfiguration[
        "includedSections"
      ][number],
  ) {
    if (!configuration) {
      return;
    }

    const included =
      configuration
        .includedSections;

    if (
      included.includes(
        sectionId,
      )
    ) {
      if (
        included.length === 1
      ) {
        return;
      }

      updateConfiguration(
        "includedSections",
        included.filter(
          (item) =>
            item !==
            sectionId,
        ),
      );

      return;
    }

    updateConfiguration(
      "includedSections",
      [
        ...included,
        sectionId,
      ],
    );
  }

  if (loading) {
    return (
      <section
        id="report-production"
        className="scroll-mt-24 border-t border-white/10 py-12 sm:py-16"
      >
        <p className="text-sm text-white/30">
          Loading report production...
        </p>
      </section>
    );
  }

  const approvedVersions =
    workspace?.approvedVersions ??
    [];

  const reports =
    workspace?.reports ??
    [];

  const issuedReports =
    reports.filter(
      (report) =>
        report.status ===
        "issued",
    );

  return (
    <section
      id="report-production"
      className="scroll-mt-24 border-t border-white/10 py-12 sm:py-16"
    >
      <div className="flex flex-col justify-between gap-7 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[#c5a577] uppercase">
            Report Production
          </p>

          <h2 className="mt-3 text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
            From strategy to deliverable.
          </h2>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/40">
            Configure a client-facing report from an approved Final Strategy snapshot. Issued reports are preserved independently from future strategy revisions.
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/[0.025] px-4 py-2 text-xs font-medium text-white/40">
          {working
            ? working.status ===
                "ready"
              ? "Ready"
              : "Production draft"
            : issuedReports.length >
                0
              ? `${issuedReports.length} issued`
              : "No production report"}
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Approved strategies
          </p>

          <p className="mt-5 text-3xl font-medium tracking-[-0.04em]">
            {approvedVersions.length}
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Working report
          </p>

          <p className="mt-5 text-lg font-medium">
            {working
              ? `R${working.report_number}`
              : "None"}
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Issued
          </p>

          <p className="mt-5 text-3xl font-medium tracking-[-0.04em]">
            {issuedReports.length}
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-[10px] tracking-[0.15em] text-white/30 uppercase">
            Source
          </p>

          <p className="mt-5 text-sm font-medium text-white/60">
            {working
              ? `Strategy v${working.source_strategy_version_number}`
              : "Not selected"}
          </p>
        </article>
      </div>

      {message && (
        <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] px-5 py-4 text-xs leading-6 text-emerald-100/70">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-2xl border border-red-300/15 bg-red-300/[0.04] px-5 py-4 text-xs leading-6 text-red-100/70">
          {error}
        </div>
      )}

      {!working &&
        approvedVersions.length ===
          0 && (
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
            <p className="text-xs font-medium text-white/60">
              Report production is locked.
            </p>

            <p className="mt-3 max-w-3xl text-xs leading-6 text-white/30">
              Approve a Final Strategy version first. Production reports can only originate from immutable studio-approved strategy versions.
            </p>
          </div>
        )}

      {!working &&
        approvedVersions.length >
          0 && (
          <div className="mt-6 rounded-2xl border border-[#c5a577]/20 bg-[#c5a577]/[0.04] p-6">
            <p className="text-xs font-medium text-[#ddc39c]">
              Create a production report.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block flex-1">
                <span className="text-[10px] tracking-[0.14em] text-white/30 uppercase">
                  Approved source version
                </span>

                <select
                  className={fieldClass}
                  value={
                    selectedSource
                  }
                  onChange={(event) =>
                    setSelectedSource(
                      event.target.value,
                    )
                  }
                >
                  {approvedVersions.map(
                    (version) => (
                      <option
                        key={version.id}
                        value={version.id}
                      >
                        Strategy v{
                          version.versionNumber
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <button
                type="button"
                disabled={
                  saving ||
                  !selectedSource
                }
                onClick={() =>
                  void createReport()
                }
                className="rounded-xl bg-[#f5f0e6] px-5 py-3 text-xs font-semibold text-[#11110f] transition hover:bg-white disabled:opacity-30"
              >
                Create production report
              </button>
            </div>
          </div>
        )}

      {working &&
        configuration && (
          <div className="mt-8">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-[10px] tracking-[0.15em] text-[#c5a577] uppercase">
                    Production Report
                  </p>

                  <p className="mt-2 text-2xl font-medium">
                    Report {
                      working.report_number
                    }
                  </p>

                  <p className="mt-2 text-xs text-white/25">
                    Strategy v{
                      working.source_strategy_version_number
                    } · {
                      working.status
                    }
                  </p>
                </div>

                <Link
                  href={`/admin/reports/${projectId}?reportId=${encodeURIComponent(
                    working.id,
                  )}`}
                  target="_blank"
                  className="rounded-xl border border-white/10 px-5 py-3 text-xs text-white/55 transition hover:border-white/20 hover:text-white"
                >
                  Open preview
                </Link>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <label className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
                <span className="text-[10px] tracking-[0.14em] text-white/30 uppercase">
                  Report title
                </span>

                <input
                  disabled={
                    working.status !==
                    "draft"
                  }
                  className={fieldClass}
                  value={
                    configuration.reportTitle
                  }
                  onChange={(event) =>
                    updateConfiguration(
                      "reportTitle",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
                <span className="text-[10px] tracking-[0.14em] text-white/30 uppercase">
                  Prepared for
                </span>

                <input
                  disabled={
                    working.status !==
                    "draft"
                  }
                  className={fieldClass}
                  value={
                    configuration.preparedFor
                  }
                  onChange={(event) =>
                    updateConfiguration(
                      "preparedFor",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
                <span className="text-[10px] tracking-[0.14em] text-white/30 uppercase">
                  Prepared by
                </span>

                <input
                  disabled={
                    working.status !==
                    "draft"
                  }
                  className={fieldClass}
                  value={
                    configuration.preparedBy
                  }
                  onChange={(event) =>
                    updateConfiguration(
                      "preparedBy",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
                <span className="text-[10px] tracking-[0.14em] text-white/30 uppercase">
                  Cover statement
                </span>

                <textarea
                  rows={4}
                  disabled={
                    working.status !==
                    "draft"
                  }
                  className={fieldClass}
                  value={
                    configuration.coverStatement
                  }
                  onChange={(event) =>
                    updateConfiguration(
                      "coverStatement",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6 lg:col-span-2">
                <span className="text-[10px] tracking-[0.14em] text-white/30 uppercase">
                  Report subtitle
                </span>

                <textarea
                  rows={4}
                  disabled={
                    working.status !==
                    "draft"
                  }
                  className={fieldClass}
                  value={
                    configuration.reportSubtitle
                  }
                  onChange={(event) =>
                    updateConfiguration(
                      "reportSubtitle",
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>

            <div className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6">
              <p className="text-[10px] tracking-[0.14em] text-white/30 uppercase">
                Included sections
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {reportSectionOptions.map(
                  (section) => {
                    const checked =
                      configuration
                        .includedSections
                        .includes(
                          section.id,
                        );

                    return (
                      <button
                        key={section.id}
                        type="button"
                        disabled={
                          working.status !==
                          "draft"
                        }
                        onClick={() =>
                          toggleSection(
                            section.id,
                          )
                        }
                        className={`rounded-xl border px-4 py-3 text-left text-xs transition ${
                          checked
                            ? "border-[#c5a577]/30 bg-[#c5a577]/[0.06] text-[#ddc39c]"
                            : "border-white/[0.08] text-white/30"
                        } disabled:cursor-not-allowed`}
                      >
                        {checked
                          ? "Included · "
                          : "Excluded · "}
                        {section.label}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {working.status ===
                "draft" && (
                <>
                  <button
                    type="button"
                    disabled={
                      saving ||
                      !dirty
                    }
                    onClick={() =>
                      void saveConfiguration()
                    }
                    className="rounded-xl bg-[#f5f0e6] px-5 py-3 text-xs font-semibold text-[#11110f] transition hover:bg-white disabled:opacity-30"
                  >
                    Save configuration
                  </button>

                  <button
                    type="button"
                    disabled={
                      saving ||
                      dirty
                    }
                    onClick={() =>
                      void performAction(
                        "ready",
                      )
                    }
                    className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.04] px-5 py-3 text-xs text-emerald-100/70 transition disabled:opacity-30"
                  >
                    Mark ready
                  </button>
                </>
              )}

              {working.status ===
                "ready" && (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void performAction(
                        "reopen",
                      )
                    }
                    className="rounded-xl border border-white/10 px-5 py-3 text-xs text-white/45"
                  >
                    Reopen draft
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void performAction(
                        "issue",
                      )
                    }
                    className="rounded-xl bg-[#f5f0e6] px-5 py-3 text-xs font-semibold text-[#11110f]"
                  >
                    Issue report
                  </button>
                </>
              )}

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void discardReport()
                }
                className="rounded-xl border border-white/10 px-5 py-3 text-xs text-white/30 transition hover:border-red-300/20 hover:text-red-100/60 disabled:opacity-30"
              >
                Discard working report
              </button>

              {dirty && (
                <span className="text-[10px] text-[#c5a577]/65">
                  Unsaved production changes
                </span>
              )}
            </div>
          </div>
        )}

      <div className="mt-12">
        <p className="text-[10px] font-medium tracking-[0.15em] text-white/25 uppercase">
          Production history
        </p>

        <h3 className="mt-2 text-2xl font-medium">
          Issued deliverables.
        </h3>

        {reports.length ===
        0 ? (
          <div className="mt-5 rounded-2xl border border-white/[0.08] p-6 text-xs text-white/30">
            No production reports have been created yet.
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            {reports.map(
              (report) => (
                <article
                  key={report.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.015] px-5 py-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="text-sm font-medium text-white/65">
                      Report {
                        report.report_number
                      }
                    </p>

                    <p className="mt-1 text-[10px] text-white/25">
                      Strategy v{
                        report.source_strategy_version_number
                      } · {
                        report.status
                      }
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-white/20">
                      {report.status ===
                      "issued"
                        ? dateLabel(
                            report.issued_at,
                          )
                        : dateLabel(
                            report.updated_at,
                          )}
                    </span>

                    <Link
                      href={`/admin/reports/${projectId}?reportId=${encodeURIComponent(
                        report.id,
                      )}`}
                      target="_blank"
                      className="rounded-xl border border-white/10 px-3 py-2 text-[10px] text-white/45"
                    >
                      Preview
                    </Link>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </div>
      <BrandNativePdfExport
        projectId={projectId}
        workingReport={working}
        issuedReports={issuedReports}
      />
      <BrandDeliverableVault
        projectId={projectId}
        workingReport={working}
      />
      <BrandClientDeliveryPortal
        projectId={projectId}
      />
      <BrandDeliveryAuditTrail
        projectId={projectId}
      />
      <BrandDeliveryOperations
        projectId={projectId}
      />

    </section>
  );
}
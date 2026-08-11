"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type WorkingReport = {
  id: string;

  report_number: number;

  status:
    | "draft"
    | "ready"
    | "issued";
};

type Deliverable = {
  id: string;

  project_id: string;

  report_id: string;

  report_number: number;

  filename: string;

  mime_type: string;

  byte_size: number;

  sha256: string;

  source_strategy_version_number:
    number;

  generated_at: string;

  created_at: string;
};

type VaultPayload = {
  deliverables:
    Deliverable[];

  error?:
    string;
};

function formatBytes(
  value: number,
) {
  if (
    value <
    1024
  ) {
    return `${value} B`;
  }

  if (
    value <
    1024 * 1024
  ) {
    return `${(
      value /
      1024
    ).toFixed(1)} KB`;
  }

  return `${(
    value /
    (
      1024 *
      1024
    )
  ).toFixed(1)} MB`;
}

function formatDate(
  value: string,
) {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl
    .DateTimeFormat(
      "en",
      {
        month:
          "short",

        day:
          "numeric",

        year:
          "numeric",

        hour:
          "numeric",

        minute:
          "2-digit",
      },
    )
    .format(
      date,
    );
}

function hideLegacyIssueButton() {
  const root =
    document
      .getElementById(
        "report-production",
      );

  if (!root) {
    return;
  }

  for (
    const button
    of Array.from(
      root.querySelectorAll(
        "button",
      ),
    )
  ) {
    if (
      button.textContent
        ?.trim() ===
      "Issue report"
    ) {
      button.hidden =
        true;

      button.setAttribute(
        "data-ellipsis-vault-superseded",
        "true",
      );
    }
  }
}

export default function BrandDeliverableVault({
  projectId,
  workingReport,
}: {
  projectId: string;

  workingReport:
    | WorkingReport
    | null;
}) {
  const [
    deliverables,
    setDeliverables,
  ] =
    useState<
      Deliverable[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    sealing,
    setSealing,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const loadVault =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              `/api/admin/deliverables?projectId=${encodeURIComponent(
                projectId,
              )}`,
              {
                cache:
                  "no-store",
              },
            );

          const payload =
            await response.json() as
              VaultPayload;

          if (
            !response.ok
          ) {
            throw new Error(
              payload.error ||
                "Could not load Deliverable Vault.",
            );
          }

          setDeliverables(
            payload.deliverables ??
              [],
          );
        }
        catch (
          loadError
        ) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load Deliverable Vault.",
          );
        }
        finally {
          setLoading(
            false,
          );
        }
      },
      [
        projectId,
      ],
    );

  useEffect(
    () => {
      const timer =
        window.setTimeout(
          () => {
            void loadVault();

            hideLegacyIssueButton();
          },
          0,
        );

      return () =>
        window.clearTimeout(
          timer,
        );
    },
    [
      loadVault,
      workingReport
        ?.status,
    ],
  );

  async function sealAndIssue() {
    if (
      !workingReport ||
      workingReport.status !==
        "ready"
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Seal Report ${workingReport.report_number} as the official issued PDF? The stored file and its SHA-256 fingerprint will become immutable.`,
      );

    if (!confirmed) {
      return;
    }

    setSealing(
      true,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          "/api/admin/deliverables",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "seal_and_issue",

                projectId,

                reportId:
                  workingReport.id,
              }),
          },
        );

      const payload =
        await response.json() as
          {
            error?:
              string;
          };

      if (
        !response.ok
      ) {
        throw new Error(
          payload.error ||
            "Could not seal and issue the report.",
        );
      }

      window.location
        .reload();
    }
    catch (
      sealError
    ) {
      setError(
        sealError instanceof Error
          ? sealError.message
          : "Could not seal and issue the report.",
      );

      setSealing(
        false,
      );
    }
  }

  return (
    <div className="mt-12 rounded-2xl border border-[#c5a577]/15 bg-[#c5a577]/[0.025] p-6 sm:p-7">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#c5a577] uppercase">
            Deliverable Vault
          </p>

          <h3 className="mt-2 text-2xl font-medium">
            Immutable issued files.
          </h3>

          <p className="mt-3 max-w-2xl text-xs leading-6 text-white/35">
            Final client PDFs are generated once, fingerprinted with SHA-256, stored privately, and preserved independently from future strategy revisions.
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-white/10 px-4 py-2 text-[10px] text-white/40">
          {
            deliverables.length
          } sealed {
            deliverables.length ===
              1
              ? "file"
              : "files"
          }
        </span>
      </div>

      {workingReport
        ?.status ===
        "ready" && (
        <div className="mt-6 rounded-xl border border-[#c5a577]/20 bg-[#c5a577]/[0.04] p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-medium text-white/70">
                Report {
                  workingReport
                    .report_number
                } is Ready.
              </p>

              <p className="mt-2 max-w-xl text-xs leading-6 text-white/30">
                Sealing creates the official client PDF, records its integrity fingerprint, stores it in the private vault, and changes the report to Issued.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void sealAndIssue()
              }
              disabled={
                sealing
              }
              className="shrink-0 rounded-xl bg-[#f4f0e8] px-5 py-3 text-xs font-semibold text-[#11110f] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {
                sealing
                  ? "Sealing..."
                  : "Seal & issue PDF"
              }
            </button>
          </div>
        </div>
      )}

      {workingReport
        ?.status ===
        "draft" && (
        <div className="mt-6 rounded-xl border border-white/[0.07] px-4 py-4 text-xs leading-6 text-white/25">
          Mark the production report Ready before it can be sealed into the Deliverable Vault.
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-xl border border-red-300/15 bg-red-300/[0.04] px-4 py-3 text-xs leading-6 text-red-100/70">
          {error}
        </div>
      )}

      <div className="mt-7 border-t border-white/[0.07] pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] text-white/20 uppercase">
              Vault history
            </p>

            <p className="mt-2 text-sm text-white/55">
              Official files preserved for this project.
            </p>
          </div>

          {loading && (
            <span className="text-[10px] text-white/25">
              Loading...
            </span>
          )}
        </div>

        {!loading &&
          deliverables.length ===
            0 && (
            <div className="mt-5 rounded-xl border border-white/[0.07] px-4 py-5 text-xs leading-6 text-white/25">
              No sealed deliverables yet.
            </div>
          )}

        {deliverables.length >
          0 && (
          <div className="mt-5 space-y-3">
            {deliverables.map(
              (
                deliverable,
              ) => (
                <article
                  key={
                    deliverable.id
                  }
                  className="rounded-xl border border-white/[0.08] bg-black/10 p-5"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[#c5a577]/20 bg-[#c5a577]/[0.05] px-3 py-1 text-[9px] font-semibold tracking-[0.12em] text-[#d9bd94] uppercase">
                          Report {
                            deliverable
                              .report_number
                          }
                        </span>

                        <span className="text-[10px] text-white/25">
                          Strategy v{
                            deliverable
                              .source_strategy_version_number
                          }
                        </span>
                      </div>

                      <p className="mt-3 truncate text-sm font-medium text-white/70">
                        {
                          deliverable
                            .filename
                        }
                      </p>

                      <p className="mt-2 text-[10px] leading-5 text-white/25">
                        {
                          formatBytes(
                            deliverable
                              .byte_size,
                          )
                        }
                        {" | "}
                        {
                          formatDate(
                            deliverable
                              .generated_at,
                          )
                        }
                      </p>

                      <p className="mt-2 break-all font-mono text-[9px] leading-5 text-white/20">
                        SHA-256 {
                          deliverable
                            .sha256
                        }
                      </p>
                    </div>

                    <a
                      href={`/api/admin/deliverables?fileId=${encodeURIComponent(
                        deliverable.id,
                      )}`}
                      className="shrink-0 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-medium text-white/55 transition hover:border-white/20 hover:text-white/80"
                    >
                      Download sealed PDF
                    </a>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
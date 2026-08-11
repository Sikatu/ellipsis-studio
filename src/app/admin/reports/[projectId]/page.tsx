import {
  notFound,
  redirect,
} from "next/navigation";

import BrandReportToolbar from "@/components/admin/BrandReportToolbar";

import {
  isAIStrategyOutput,
} from "@/lib/final-strategy";

import {
  normalizeReportConfiguration,
} from "@/lib/report-production";

import {
  buildStrategyReportSections,
} from "@/lib/strategy-report";

import {
  createClient,
} from "@/lib/supabase/server";

import styles from "./report.module.css";

export const dynamic =
  "force-dynamic";

export const metadata = {
  title:
    "Brand Strategy Report | ELLIPSIS",
};

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "Production draft";
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

  return new Intl.DateTimeFormat(
    "en",
    {
      month:
        "long",

      day:
        "numeric",

      year:
        "numeric",
    },
  ).format(date);
}

export default async function BrandStrategyReportPage({
  params,
  searchParams,
}: {
  params: Promise<{
    projectId: string;
  }>;

  searchParams: Promise<{
    reportId?: string;
  }>;
}) {
  const {
    projectId,
  } = await params;

  const {
    reportId,
  } = await searchParams;

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/admin/login",
    );
  }

  const {
    data: profile,
  } = await supabase
    .from("admin_profiles")
    .select("user_id")
    .eq(
      "user_id",
      user.id,
    )
    .maybeSingle();

  if (!profile) {
    redirect(
      "/admin/login",
    );
  }

  const {
    data: project,
    error: projectError,
  } = await supabase
    .from("discovery_projects")
    .select(
      "id,title,client_id",
    )
    .eq(
      "id",
      projectId,
    )
    .maybeSingle();

  if (
    projectError ||
    !project
  ) {
    notFound();
  }

  let report:
    | {
        id: string;
        report_number: number;
        status: string;
        source_strategy_version_number: number;
        strategy_snapshot: unknown;
        configuration: unknown;
        issued_at: string | null;
      }
    | null = null;

  if (reportId) {
    const {
      data,
      error,
    } = await supabase
      .from("strategy_reports")
      .select(
        "id,report_number,status,source_strategy_version_number,strategy_snapshot,configuration,issued_at",
      )
      .eq(
        "id",
        reportId,
      )
      .eq(
        "project_id",
        projectId,
      )
      .maybeSingle();

    if (error) {
      throw new Error(
        error.message,
      );
    }

    report = data;
  }
  else {
    const {
      data,
      error,
    } = await supabase
      .from("strategy_reports")
      .select(
        "id,report_number,status,source_strategy_version_number,strategy_snapshot,configuration,issued_at",
      )
      .eq(
        "project_id",
        projectId,
      )
      .eq(
        "status",
        "issued",
      )
      .order(
        "report_number",
        {
          ascending:
            false,
        },
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        error.message,
      );
    }

    report = data;
  }

  const reportStatus =
    report?.status ===
      "draft" ||
    report?.status ===
      "ready" ||
    report?.status ===
      "issued"
      ? report.status
      : null;

  if (
    !report ||
    !reportStatus ||
    !isAIStrategyOutput(
      report.strategy_snapshot,
    )
  ) {
    return (
      <main
        className={
          styles.screenCanvas
        }
      >
        <div
          className={
            styles.toolbar
          }
        >
          <BrandReportToolbar
            projectId={
              projectId
            }
            reportId={
              null
            }
            clientId={
              project.client_id
            }
            brandName={
              project.title
            }
            reportNumber={
              null
            }
            status={null}
          />
        </div>

        <section
          className={
            styles.locked
          }
        >
          <p
            className={
              styles.lockedKicker
            }
          >
            Brand Strategy Report
          </p>

          <h1
            className={
              styles.lockedTitle
            }
          >
            Report unavailable.
          </h1>

          <p
            className={
              styles.lockedText
            }
          >
            No production report snapshot is available yet. Create one from an approved Final Strategy in the Report Production workspace.
          </p>
        </section>
      </main>
    );
  }

  const configuration =
    normalizeReportConfiguration(
      report.configuration,
      project.title,
    );

  const sections =
    buildStrategyReportSections(
      report.strategy_snapshot,
      configuration
        .includedSections,
    );

  return (
    <main
      className={
        styles.screenCanvas
      }
    >
      <div
        className={
          styles.toolbar
        }
      >
        <BrandReportToolbar
          projectId={
            projectId
          }
          reportId={
            report.id
          }
          clientId={
            project.client_id
          }
          brandName={
            project.title
          }
          reportNumber={
            report.report_number
          }
          status={
            reportStatus
          }
        />
      </div>

      {reportStatus ===
        "draft" && (
        <div
          className={
            styles.draftNotice
          }
        >
          DRAFT PREVIEW · NOT READY FOR CLIENT DELIVERY
        </div>
      )}

      <div
        className={
          styles.report
        }
      >
        <section
          className={
            styles.coverPage
          }
        >
          <div
            className={
              styles.coverTop
            }
          >
            <span
              className={
                styles.wordmark
              }
            >
              ELLIPSIS
            </span>

            <div
              className={
                styles.coverMeta
              }
            >
              <div>
                {
                  configuration
                    .reportTitle
                }
              </div>

              <div>
                Report{" "}
                {
                  report.report_number
                }
              </div>
            </div>
          </div>

          <div
            className={
              styles.coverCenter
            }
          >
            <p
              className={
                styles.coverKicker
              }
            >
              {
                configuration
                  .reportTitle
              }
            </p>

            <h1
              className={
                styles.coverTitle
              }
            >
              {
                project.title
              }
            </h1>

            <p
              className={
                styles.coverSubtitle
              }
            >
              {
                configuration
                  .reportSubtitle
              }
            </p>

            {configuration
              .coverStatement && (
              <p
                className={
                  styles.coverStatement
                }
              >
                {
                  configuration
                    .coverStatement
                }
              </p>
            )}
          </div>

          <div
            className={
              styles.coverFooter
            }
          >
            <div>
              <div
                className={
                  styles.coverFooterLabel
                }
              >
                Prepared For
              </div>

              <div
                className={
                  styles.coverFooterValue
                }
              >
                {
                  configuration
                    .preparedFor
                }
              </div>
            </div>

            <div>
              <div
                className={
                  styles.coverFooterLabel
                }
              >
                Prepared By
              </div>

              <div
                className={
                  styles.coverFooterValue
                }
              >
                {
                  configuration
                    .preparedBy
                }
              </div>
            </div>

            <div>
              <div
                className={
                  styles.coverFooterLabel
                }
              >
                Strategy Source
              </div>

              <div
                className={
                  styles.coverFooterValue
                }
              >
                Approved Strategy v{
                  report.source_strategy_version_number
                }
              </div>
            </div>

            <div>
              <div
                className={
                  styles.coverFooterLabel
                }
              >
                Issued
              </div>

              <div
                className={
                  styles.coverFooterValue
                }
              >
                {
                  formatDate(
                    report.issued_at,
                  )
                }
              </div>
            </div>
          </div>
        </section>

        {sections.map(
          (section) => (
            <section
              key={
                section.id
              }
              className={
                styles.sectionPage
              }
            >
              <div
                className={
                  styles.sectionTop
                }
              >
                <span
                  className={
                    styles.sectionNumber
                  }
                >
                  {
                    section.number
                  }
                </span>

                <span
                  className={
                    styles.sectionBrand
                  }
                >
                  ELLIPSIS · {
                    configuration
                      .reportTitle
                  }
                </span>
              </div>

              <div
                className={
                  styles.sectionIntro
                }
              >
                <p
                  className={
                    styles.eyebrow
                  }
                >
                  {
                    section.eyebrow
                  }
                </p>

                <h2
                  className={
                    styles.sectionTitle
                  }
                >
                  {
                    section.title
                  }
                </h2>
              </div>

              {section
                .paragraphs
                .length > 0 && (
                <div
                  className={
                    styles.paragraphs
                  }
                >
                  {section
                    .paragraphs
                    .map(
                      (
                        paragraph,
                        index,
                      ) => (
                        <p
                          key={
                            `${section.id}-${index}`
                          }
                          className={
                            styles.paragraph
                          }
                        >
                          {
                            paragraph
                          }
                        </p>
                      ),
                    )}
                </div>
              )}

              {section
                .groups
                .length > 0 && (
                <div
                  className={
                    styles.groupGrid
                  }
                >
                  {section.groups.map(
                    (group) => (
                      <div
                        key={
                          `${section.id}-${group.label}`
                        }
                        className={
                          styles.group
                        }
                      >
                        <p
                          className={
                            styles.groupLabel
                          }
                        >
                          {
                            group.label
                          }
                        </p>

                        <ul
                          className={
                            styles.list
                          }
                        >
                          {group.items.map(
                            (
                              item,
                              index,
                            ) => (
                              <li
                                key={
                                  `${group.label}-${index}`
                                }
                                className={
                                  styles.listItem
                                }
                              >
                                {
                                  item
                                }
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    ),
                  )}
                </div>
              )}

              <footer
                className={
                  styles.sectionFooter
                }
              >
                <span>
                  {
                    project.title
                  }
                </span>

                <span>
                  Report{" "}
                  {
                    report.report_number
                  } · {
                    reportStatus
                  }
                </span>
              </footer>
            </section>
          ),
        )}
      </div>
    </main>
  );
}
import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import ProjectDeliverablesPanel from "@/components/admin/ProjectDeliverablesPanel";
import ProjectWorkboard from "@/components/admin/ProjectWorkboard";
import ProjectWorkspaceEditor from "@/components/admin/ProjectWorkspaceEditor";
import StudioNav from "@/components/admin/StudioNav";
import {
  createClient,
} from "@/lib/supabase/server";

export const metadata = {
  title: "Project Workspace",
};

async function requireAdmin() {
  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
  } =
    await supabase.auth
      .getUser();

  if (!user) {
    redirect(
      "/admin/login",
    );
  }

  const {
    data:
      profile,
  } =
    await supabase
      .from(
        "admin_profiles",
      )
      .select(
        "user_id",
      )
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

  return {
    supabase,
  };
}

function label(
  value: string,
) {
  return value
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character
          .toUpperCase(),
    );
}

function formatDate(
  value:
    string |
    null,
) {
  if (!value) {
    return "Not set";
  }

  const parsed =
    new Date(
      value.length ===
        10
        ? `${value}T00:00:00`
        : value,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return new Intl
    .DateTimeFormat(
      "en-US",
      {
        dateStyle:
          "medium",
      },
    )
    .format(
      parsed,
    );
}

function money(
  cents:
    number |
    null,
  currency:
    string,
) {
  if (
    cents ===
      null
  ) {
    return "Not set";
  }

  try {
    return new Intl
      .NumberFormat(
        "en-US",
        {
          style:
            "currency",
          currency,
        },
      )
      .format(
        cents /
          100,
      );
  }
  catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

export default async function ProjectDetailPage({
  params,
}: {
  params:
    Promise<{
      projectId:
        string;
    }>;
}) {
  const {
    projectId,
  } =
    await params;

  const {
    supabase,
  } =
    await requireAdmin();

  const {
    data:
      project,
    error:
      projectError,
  } =
    await supabase
      .from(
        "studio_projects",
      )
      .select(
        "id,client_id,title,project_type,description,status,priority,start_date,target_date,completed_at,progress,archived_at,created_at,updated_at",
      )
      .eq(
        "id",
        projectId,
      )
      .maybeSingle();

  if (projectError) {
    throw new Error(
      `Unable to load project: ${projectError.message}`,
    );
  }

  if (!project) {
    notFound();
  }

  const [
    clientResult,
    ownerDetailsResult,
    invoicesResult,
    tasksResult,
    milestonesResult,
    deliverablesResult,
    membersResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "clients",
        )
        .select(
          "id,brand_name,contact_name,email,status",
        )
        .eq(
          "id",
          project.client_id,
        )
        .maybeSingle(),

      supabase
        .from(
          "studio_project_owner_details",
        )
        .select(
          "project_id,budget_cents,currency,internal_notes,created_at,updated_at",
        )
        .eq(
          "project_id",
          project.id,
        )
        .maybeSingle(),

      supabase
        .from(
          "invoices",
        )
        .select(
          "id,invoice_number,status,currency,total_cents,due_date,created_at",
        )
        .eq(
          "client_id",
          project.client_id,
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          6,
        ),

      supabase
        .from(
          "studio_project_tasks",
        )
        .select(
          "id,project_id,milestone_id,assignee_member_id,title,description,status,priority,due_date,sort_order,completed_at,created_at,updated_at",
        )
        .eq(
          "project_id",
          project.id,
        )
        .order(
          "sort_order",
          {
            ascending:
              true,
          },
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        ),

      supabase
        .from(
          "studio_project_milestones",
        )
        .select(
          "id,project_id,title,description,due_date,completed_at,sort_order,created_at,updated_at",
        )
        .eq(
          "project_id",
          project.id,
        )
        .order(
          "sort_order",
          {
            ascending:
              true,
          },
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        ),

      supabase
        .from(
          "studio_project_deliverables",
        )
        .select(
          "id,project_id,created_by,title,description,deliverable_type,source_kind,version_number,review_status,approval_status,external_url,storage_bucket,storage_path,filename,mime_type,byte_size,sha256,approved_at,delivered_at,sort_order,created_at,updated_at",
        )
        .eq(
          "project_id",
          project.id,
        )
        .order(
          "sort_order",
          {
            ascending:
              true,
          },
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        ),

      supabase
        .from(
          "workspace_members",
        )
        .select(
          "id,display_name,role,status",
        )
        .order(
          "display_name",
          {
            ascending:
              true,
          },
        ),
    ]);

  const firstError =
    clientResult.error ||
    ownerDetailsResult.error ||
    invoicesResult.error ||
    tasksResult.error ||
    milestonesResult.error ||
    deliverablesResult.error ||
    membersResult.error;

  if (firstError) {
    throw new Error(
      `Unable to load project workspace: ${firstError.message}`,
    );
  }

  const client =
    clientResult.data;

  const ownerDetails =
    ownerDetailsResult
      .data;

  const invoices =
    invoicesResult.data ??
    [];

  const tasks =
    tasksResult.data ??
    [];

  const milestones =
    milestonesResult.data ??
    [];

  const deliverables =
    deliverablesResult.data ??
    [];

  const workspaceMembers =
    membersResult.data ??
    [];

  return (
    <main className="min-h-screen bg-[#11110f] text-[#f4f0e8]">
      <StudioNav active="projects" />

      <div className="mx-auto w-full max-w-7xl px-6 pb-20 pt-12 sm:px-8 lg:px-10 lg:pt-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin/projects"
            className="text-[9px] font-semibold uppercase tracking-[0.13em] text-white/30 transition hover:text-white/60"
          >
            Ã¢â€ Â Projects
          </Link>

          {client && (
            <Link
              href={`/admin/clients/${client.id}`}
              className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#c8ad84]/50 transition hover:text-[#ead6b5]"
            >
              Client workspace
            </Link>
          )}
        </div>

        <section className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8ad84]/55">
              {client
                ?.brand_name ??
                "Client"}{" "}
              /{" "}
              {label(
                project.project_type,
              )}
            </p>

            <h1 className="mt-5 text-4xl font-medium tracking-[-0.055em] sm:text-6xl">
              {
                project.title
              }
            </h1>

            {project.description && (
              <p className="mt-5 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-white/40">
                {
                  project.description
                }
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[#c8ad84]/20 bg-[#c8ad84]/[0.05] px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#ead6b5]/70">
              {label(
                project.status,
              )}
            </span>

            <span className="rounded-full border border-white/10 px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/35">
              {label(
                project.priority,
              )}{" "}
              priority
            </span>

            {project.archived_at && (
              <span className="rounded-full border border-white/10 px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30">
                Archived
              </span>
            )}
          </div>
        </section>

        <section className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <p className="text-[9px] uppercase tracking-[0.14em] text-white/25">
              Progress
            </p>

            <p className="mt-4 text-3xl font-medium">
              {
                project.progress
              }
              %
            </p>

            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full bg-[#c8ad84]"
                style={{
                  width:
                    `${Math.max(
                      0,
                      Math.min(
                        100,
                        project.progress,
                      ),
                    )}%`,
                }}
              />
            </div>
          </article>

          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <p className="text-[9px] uppercase tracking-[0.14em] text-white/25">
              Start
            </p>

            <p className="mt-4 text-sm text-white/65">
              {formatDate(
                project.start_date,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <p className="text-[9px] uppercase tracking-[0.14em] text-white/25">
              Target
            </p>

            <p className="mt-4 text-sm text-white/65">
              {formatDate(
                project.target_date,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-[#c8ad84]/15 bg-[#c8ad84]/[0.03] p-5">
            <p className="text-[9px] uppercase tracking-[0.14em] text-[#c8ad84]/50">
              Owner budget
            </p>

            <p className="mt-4 text-sm text-[#ead6b5]/75">
              {money(
                ownerDetails
                  ?.budget_cents ??
                  null,
                ownerDetails
                  ?.currency ??
                  "USD",
              )}
            </p>
          </article>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 lg:col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c8ad84]/55">
              Client
            </p>

            <h2 className="mt-4 text-xl font-medium">
              {client
                ?.brand_name ??
                "Unavailable"}
            </h2>

            <div className="mt-4 space-y-2 text-sm text-white/35">
              {client
                ?.contact_name && (
                <p>
                  {
                    client.contact_name
                  }
                </p>
              )}

              {client
                ?.email && (
                <p>
                  {
                    client.email
                  }
                </p>
              )}

              <p>
                Client status:{" "}
                {label(
                  client
                    ?.status ??
                    "unknown",
                )}
              </p>
            </div>
          </article>

          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c8ad84]/55">
              Timeline
            </p>

            <div className="mt-4 space-y-3 text-sm text-white/38">
              <p>
                Created{" "}
                {formatDate(
                  project.created_at,
                )}
              </p>

              <p>
                Updated{" "}
                {formatDate(
                  project.updated_at,
                )}
              </p>

              <p>
                Completed{" "}
                {formatDate(
                  project.completed_at,
                )}
              </p>
            </div>
          </article>
        </section>

        <section className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c8ad84]/55">
                Client invoice context
              </p>

              <h2 className="mt-3 text-xl font-medium tracking-[-0.035em]">
                Recent invoices for this client
              </h2>

              <p className="mt-3 max-w-2xl text-xs leading-6 text-white/30">
                These invoices belong to the client. They are not yet explicitly linked to this project.
              </p>
            </div>

            <Link
              href="/admin/invoices"
              className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/35 transition hover:text-white/65"
            >
              Open invoices
            </Link>
          </div>

          {invoices.length ===
          0 ? (
            <p className="mt-8 text-sm text-white/30">
              No invoices exist for this client yet.
            </p>
          ) : (
            <div className="mt-8 divide-y divide-white/[0.06] border-y border-white/[0.06]">
              {invoices.map(
                (
                  invoice,
                ) => (
                  <Link
                    key={
                      invoice.id
                    }
                    href={`/admin/invoices/${invoice.id}`}
                    className="flex flex-col gap-3 py-4 transition hover:bg-white/[0.015] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {
                          invoice.invoice_number
                        }
                      </p>

                      <p className="mt-1 text-xs text-white/28">
                        Due{" "}
                        {formatDate(
                          invoice.due_date,
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-xs text-white/35">
                        {label(
                          invoice.status,
                        )}
                      </span>

                      <span className="text-sm text-white/60">
                        {money(
                          invoice.total_cents,
                          invoice.currency,
                        )}
                      </span>
                    </div>
                  </Link>
                ),
              )}
            </div>
          )}
        </section>

        <ProjectWorkspaceEditor
          project={
            project
          }
          ownerDetails={
            ownerDetails
          }
        />

        <ProjectWorkboard
          projectId={
            project.id
          }
          archived={
            Boolean(
              project.archived_at,
            )
          }
          initialTasks={
            tasks
          }
          initialMilestones={
            milestones
          }
          members={
            workspaceMembers
          }
        />

        <ProjectDeliverablesPanel
          projectId={
            project.id
          }
          archived={
            Boolean(
              project.archived_at,
            )
          }
          initialDeliverables={
            deliverables
          }
        />

        <section className="mt-10">
          <article className="rounded-2xl border border-dashed border-white/[0.09] p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-medium">
                Activity
              </h2>

              <span className="rounded-full border border-white/[0.08] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
                S12.5
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-white/30">
              Append-oriented project events and operational history will live here.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
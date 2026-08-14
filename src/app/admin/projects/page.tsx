import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import StudioNav from "@/components/admin/StudioNav";
import {
  createClient,
} from "@/lib/supabase/server";

export const metadata = {
  title: "Projects",
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
    user,
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

  const date =
    new Date(
      `${value}T00:00:00`,
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
      "en-US",
      {
        dateStyle:
          "medium",
      },
    )
    .format(
      date,
    );
}

export default async function ProjectsPage() {
  const {
    supabase,
  } =
    await requireAdmin();

  const [
    projectsResult,
    clientsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "studio_projects",
        )
        .select(
          "id,client_id,title,project_type,status,priority,start_date,target_date,progress,archived_at,created_at,updated_at",
        )
        .order(
          "updated_at",
          {
            ascending:
              false,
          },
        ),

      supabase
        .from(
          "clients",
        )
        .select(
          "id,brand_name",
        ),
    ]);

  const firstError =
    projectsResult.error ||
    clientsResult.error;

  if (firstError) {
    throw new Error(
      `Unable to load project workspace: ${firstError.message}`,
    );
  }

  const projects =
    projectsResult.data ??
    [];

  const clientById =
    new Map(
      (
        clientsResult.data ??
        []
      ).map(
        (
          client,
        ) => [
          client.id,
          client,
        ],
      ),
    );

  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10,
      );

  const liveProjects =
    projects.filter(
      (
        project,
      ) =>
        !project
          .archived_at,
    );

  const activeCount =
    liveProjects.filter(
      (
        project,
      ) =>
        project.status ===
          "active",
    ).length;

  const attentionCount =
    liveProjects.filter(
      (
        project,
      ) =>
        (
          project.priority ===
            "urgent" ||
          project.priority ===
            "high"
        ) &&
        project.status !==
          "completed" &&
        project.status !==
          "cancelled",
    ).length;

  const overdueCount =
    liveProjects.filter(
      (
        project,
      ) =>
        Boolean(
          project.target_date &&
          project.target_date <
            today &&
          project.status !==
            "completed" &&
          project.status !==
            "cancelled",
        ),
    ).length;

  return (
    <main className="min-h-screen bg-[#11110f] text-[#f4f0e8]">
      <StudioNav active="projects" />

      <div className="mx-auto w-full max-w-7xl px-6 pb-20 pt-12 sm:px-8 lg:px-10 lg:pt-16">
        <section className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c8ad84]/55">
              ELLIPSIS Studio / Projects
            </p>

            <h1 className="mt-5 text-4xl font-medium tracking-[-0.055em] sm:text-5xl">
              Every engagement in one operational view.
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/38 sm:text-[15px]">
              Track client work from planning through delivery without mixing Brand Discovery, invoices, or private financial context into parallel systems.
            </p>
          </div>

          <Link
            href="/admin/projects/new"
            className="w-fit rounded-xl bg-[#f4f0e8] px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.13em] text-[#11110f] transition hover:bg-white"
          >
            New project
          </Link>
        </section>

        <section className="mt-12 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label:
                "Live projects",
              value:
                liveProjects
                  .length,
            },
            {
              label:
                "Active",
              value:
                activeCount,
            },
            {
              label:
                "Needs attention",
              value:
                attentionCount,
            },
            {
              label:
                "Overdue",
              value:
                overdueCount,
            },
          ].map(
            (
              item,
            ) => (
              <article
                key={
                  item.label
                }
                className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5"
              >
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/25">
                  {
                    item.label
                  }
                </p>

                <p className="mt-4 text-3xl font-medium tracking-[-0.045em]">
                  {
                    item.value
                  }
                </p>
              </article>
            ),
          )}
        </section>

        <section className="mt-10">
          {projects.length ===
          0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
              <p className="text-lg font-medium">
                No operational projects yet.
              </p>

              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/35">
                Create the first project and connect it to one of your existing clients.
              </p>

              <Link
                href="/admin/projects/new"
                className="mt-7 inline-flex rounded-xl border border-[#c8ad84]/25 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.13em] text-[#ead6b5]"
              >
                Create first project
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {projects.map(
                (
                  project,
                ) => {
                  const client =
                    clientById.get(
                      project.client_id,
                    );

                  return (
                    <Link
                      key={
                        project.id
                      }
                      href={`/admin/projects/${project.id}`}
                      className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition hover:border-[#c8ad84]/20 hover:bg-white/[0.03]"
                    >
                      <div className="flex items-start justify-between gap-6">
                        <div>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#c8ad84]/50">
                            {client
                              ?.brand_name ??
                              "Client"}
                          </p>

                          <h2 className="mt-3 text-xl font-medium tracking-[-0.035em] transition group-hover:text-white">
                            {
                              project.title
                            }
                          </h2>
                        </div>

                        {project.archived_at && (
                          <span className="rounded-full border border-white/10 px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
                            Archived
                          </span>
                        )}
                      </div>

                      <div className="mt-7 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/[0.08] px-3 py-1.5 text-[9px] text-white/35">
                          {label(
                            project.status,
                          )}
                        </span>

                        <span className="rounded-full border border-white/[0.08] px-3 py-1.5 text-[9px] text-white/35">
                          {label(
                            project.priority,
                          )}{" "}
                          priority
                        </span>

                        <span className="rounded-full border border-white/[0.08] px-3 py-1.5 text-[9px] text-white/35">
                          {label(
                            project.project_type,
                          )}
                        </span>
                      </div>

                      <div className="mt-7">
                        <div className="flex items-center justify-between text-[9px] text-white/30">
                          <span>
                            Progress
                          </span>

                          <span>
                            {
                              project.progress
                            }
                            %
                          </span>
                        </div>

                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
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
                      </div>

                      <div className="mt-7 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-5 text-xs">
                        <div>
                          <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/20">
                            Start
                          </p>

                          <p className="mt-2 text-white/45">
                            {formatDate(
                              project.start_date,
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/20">
                            Target
                          </p>

                          <p className="mt-2 text-white/45">
                            {formatDate(
                              project.target_date,
                            )}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                },
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
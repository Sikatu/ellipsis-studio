import Link from "next/link";
import { redirect } from "next/navigation";

import AdminRealtimeRefresh from "@/components/admin/AdminRealtimeRefresh";
import CreateDiscovery from "@/components/admin/CreateDiscovery";
import LogoutButton from "@/components/admin/LogoutButton";
import { createClient } from "@/lib/supabase/server";

type ClientRecord = {
  id: string;
  brand_name: string;
  contact_name: string | null;
  email: string | null;
  created_at: string;
};

type ProjectRecord = {
  id: string;
  client_id: string;
  title: string;
  status: string;
  progress: number;
  updated_at: string;
  submitted_at: string | null;
};

function statusLabel(
  status: string | undefined,
) {
  if (!status) {
    return "No project";
  }

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const [
    {
      data: clients,
      error: clientError,
    },
    {
      data: projects,
      error: projectError,
    },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, brand_name, contact_name, email, created_at",
      )
      .eq(
        "status",
        "active",
      )
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("discovery_projects")
      .select(
        "id, client_id, title, status, progress, updated_at, submitted_at",
      )
      .order("updated_at", {
        ascending: false,
      }),
  ]);

  const clientRows =
    (clients ?? []) as ClientRecord[];

  const projectRows =
    (projects ?? []) as ProjectRecord[];

  const projectByClient =
    new Map<string, ProjectRecord>();

  for (const project of projectRows) {
    if (
      !projectByClient.has(
        project.client_id,
      )
    ) {
      projectByClient.set(
        project.client_id,
        project,
      );
    }
  }

  const latestProjects = Array.from(
    projectByClient.values(),
  );

  const submitted =
    latestProjects.filter(
      (project) =>
        project.status === "submitted",
    ).length;

  const inProgress =
    latestProjects.filter((project) =>
      [
        "sent",
        "in_progress",
      ].includes(project.status),
    ).length;

  return (
    <main className="min-h-screen bg-[#11110f] text-[#f5f0e6]">
      <AdminRealtimeRefresh />

      <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <Link
            href="/"
            className="text-xs font-semibold tracking-[0.24em] uppercase"
          >
            Ellipsis
          </Link>

          <div className="flex items-center gap-6">
            <span className="hidden text-xs text-white/30 sm:block">
              {user.email}
            </span>

            <LogoutButton />
          </div>
        </header>

        <section className="py-12 sm:py-16">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="mb-4 text-xs font-semibold tracking-[0.22em] text-[#c5a577] uppercase">
                Brand Discovery
              </p>

              <h1 className="text-4xl font-medium tracking-[-0.04em] sm:text-6xl">
                Client discoveries.
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-7 text-white/45">
                Create private client discoveries,
                track progress, and review strategic
                brand intelligence from one place.
              </p>
            </div>

            <CreateDiscovery
              userId={user.id}
            />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-xs tracking-[0.16em] text-white/35 uppercase">
              Total clients
            </p>

            <p className="mt-6 text-4xl font-medium">
              {clientRows.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-xs tracking-[0.16em] text-white/35 uppercase">
              In progress
            </p>

            <p className="mt-6 text-4xl font-medium">
              {inProgress}
            </p>
          </div>

          <div className="rounded-2xl border border-[#b89361]/20 bg-[#b89361]/[0.06] p-6">
            <p className="text-xs tracking-[0.16em] text-[#c9a777] uppercase">
              Submitted
            </p>

            <p className="mt-6 text-4xl font-medium">
              {submitted}
            </p>
          </div>
        </section>

        {(clientError ||
          projectError) && (
          <div className="mt-8 rounded-2xl border border-red-400/15 bg-red-400/[0.05] p-5 text-sm text-red-200">
            Database request error:{" "}
            {clientError?.message ??
              projectError?.message}
          </div>
        )}

        <section className="mt-12">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">
                Clients
              </h2>

              <p className="mt-1 text-xs text-white/30">
                Select a client to open their
                intelligence workspace.
              </p>
            </div>

            <span className="text-xs text-white/30">
              {clientRows.length} records
            </span>
          </div>

          {clientRows.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 px-6 py-20 text-center">
              <p className="text-lg font-medium">
                Your client database is empty.
              </p>

              <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-white/40">
                Create your first Brand Discovery
                and the client will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-white/10">
              {clientRows.map(
                (client, index) => {
                  const project =
                    projectByClient.get(
                      client.id,
                    );

                  return (
                    <Link
                      key={client.id}
                      href={`/admin/clients/${client.id}`}
                      className={`group grid gap-6 p-6 transition duration-200 hover:bg-white/[0.04] md:grid-cols-[1.35fr_.7fr_.75fr_.65fr_auto] md:items-center ${
                        index !==
                        clientRows.length - 1
                          ? "border-b border-white/10"
                          : ""
                      }`}
                    >
                      <div>
                        <p className="text-base font-medium transition group-hover:text-[#dec59f]">
                          {client.brand_name}
                        </p>

                        <p className="mt-1 text-xs text-white/35">
                          {client.contact_name ||
                            client.email ||
                            "No contact details"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-white/30">
                          Progress
                        </p>

                        <div className="mt-2 flex items-center gap-3">
                          <div className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-[#c5a577]"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(
                                    0,
                                    project?.progress ??
                                      0,
                                  ),
                                )}%`,
                              }}
                            />
                          </div>

                          <p className="text-sm font-medium">
                            {project?.progress ??
                              0}
                            %
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-white/30">
                          Status
                        </p>

                        <p className="mt-1 text-sm font-medium text-[#c9a777]">
                          {statusLabel(
                            project?.status,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-white/30">
                          Created
                        </p>

                        <p className="mt-1 text-sm text-white/65">
                          {new Date(
                            client.created_at,
                          ).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center justify-end">
                        <span className="text-sm text-white/25 transition group-hover:translate-x-1 group-hover:text-[#c9a777]">
                          Open →
                        </span>
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
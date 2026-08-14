import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import StudioNav from "@/components/admin/StudioNav";
import {
  createClient,
} from "@/lib/supabase/server";

export const metadata = {
  title: "Studio Home",
};

async function requireAdmin() {
  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/admin/login",
    );
  }

  const {
    data: profile,
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

export default async function StudioHomePage() {
  const {
    supabase,
  } =
    await requireAdmin();

  const [
    clientsResult,
    projectsResult,
    deliverablesResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "clients",
        )
        .select(
          "id",
          {
            count:
              "exact",
            head:
              true,
          },
        ),

      supabase
        .from(
          "discovery_projects",
        )
        .select(
          "id",
          {
            count:
              "exact",
            head:
              true,
          },
        ),

      supabase
        .from(
          "brand_deliverables",
        )
        .select(
          "id",
          {
            count:
              "exact",
            head:
              true,
          },
        ),
    ]);

  const clientCount =
    clientsResult.count ??
    0;

  const projectCount =
    projectsResult.count ??
    0;

  const deliverableCount =
    deliverablesResult.count ??
    0;

  return (
    <main className="min-h-screen bg-[#11110f] text-[#f4f0e8]">
      <StudioNav active="studio" />

      <div className="mx-auto w-full max-w-7xl px-6 pb-20 pt-12 sm:px-8 lg:px-10 lg:pt-16">
        <section className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c8ad84]/55">
            Your workspace
          </p>

          <h1 className="mt-5 max-w-2xl text-4xl font-medium tracking-[-0.045em] text-[#f4f0e8] sm:text-5xl lg:text-6xl">
            What would you like to work on?
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/35 sm:text-base">
            Keep client work in one calm place. Open a tool, finish the task, and let ELLIPSIS handle the structure around it.
          </p>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-2">
          <Link
            href="/admin/brand-discovery"
            className="group rounded-[28px] border border-white/[0.08] bg-[#161612] p-7 transition hover:-translate-y-0.5 hover:border-[#c8ad84]/25 hover:bg-[#181813] sm:p-8"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8ad84]/55">
                  Tool 01
                </p>

                <h2 className="mt-5 text-2xl font-medium tracking-[-0.035em] text-white/80">
                  Brand Discovery
                </h2>

                <p className="mt-3 max-w-md text-sm leading-7 text-white/30">
                  Strategy, creative direction, visual systems, reports and client delivery in one guided workflow.
                </p>
              </div>

              <span className="rounded-full border border-white/10 px-3 py-1.5 text-[9px] uppercase tracking-[0.12em] text-white/30">
                {projectCount} projects
              </span>
            </div>

            <div className="mt-10 flex items-center justify-between border-t border-white/[0.06] pt-5">
              <span className="text-xs text-white/25">
                Continue your brand work
              </span>

              <span className="text-xs text-[#d8bf99]/55 transition group-hover:translate-x-1">
                Open tool →
              </span>
            </div>
          </Link>

          <Link
            href="/admin/invoices"
            className="group rounded-[28px] border border-[#c8ad84]/15 bg-[#f4f0e8] p-7 text-[#11110f] transition hover:-translate-y-0.5 sm:p-8"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b6f49]">
                  Tool 02
                </p>

                <h2 className="mt-5 text-2xl font-medium tracking-[-0.035em]">
                  Invoice Generator
                </h2>

                <p className="mt-3 max-w-md text-sm leading-7 text-black/45">
                  Choose a client, add the work you completed, review the total, and generate a polished invoice.
                </p>
              </div>

              <span className="rounded-full border border-black/10 px-3 py-1.5 text-[9px] uppercase tracking-[0.12em] text-black/40">
                New
              </span>
            </div>

            <div className="mt-10 flex items-center justify-between border-t border-black/[0.08] pt-5">
              <span className="text-xs text-black/35">
                Simple 3-step flow
              </span>

              <span className="text-xs font-medium transition group-hover:translate-x-1">
                Create invoice →
              </span>
            </div>
          </Link>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
              Clients
            </p>

            <p className="mt-3 text-2xl font-medium tracking-[-0.03em] text-white/65">
              {clientCount}
            </p>

            <p className="mt-2 text-xs leading-5 text-white/25">
              Existing people and brands in your workspace.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
              Brand projects
            </p>

            <p className="mt-3 text-2xl font-medium tracking-[-0.03em] text-white/65">
              {projectCount}
            </p>

            <p className="mt-2 text-xs leading-5 text-white/25">
              Discovery projects currently stored in ELLIPSIS.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
              Issued documents
            </p>

            <p className="mt-3 text-2xl font-medium tracking-[-0.03em] text-white/65">
              {deliverableCount}
            </p>

            <p className="mt-2 text-xs leading-5 text-white/25">
              Studio documents already preserved for delivery.
            </p>
          </div>
        </section>

        <section className="mt-10 rounded-[24px] border border-white/[0.07] bg-white/[0.015] p-6 sm:p-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/22">
            How ELLIPSIS Studio works
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {[
              [
                "01",
                "Choose a tool",
                "Start with the job you need to finish, not a complicated dashboard.",
              ],
              [
                "02",
                "Work with a client",
                "Reuse client information across Brand Discovery, invoices, and future tools.",
              ],
              [
                "03",
                "Create the output",
                "ELLIPSIS keeps the process organized while you focus on the actual client work.",
              ],
            ].map(
              ([
                number,
                title,
                copy,
              ]) => (
                <div
                  key={number}
                  className="border-t border-white/[0.06] pt-4"
                >
                  <p className="text-[9px] font-semibold tracking-[0.12em] text-[#c8ad84]/45">
                    {number}
                  </p>

                  <p className="mt-3 text-sm font-medium text-white/55">
                    {title}
                  </p>

                  <p className="mt-2 text-xs leading-6 text-white/25">
                    {copy}
                  </p>
                </div>
              ),
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

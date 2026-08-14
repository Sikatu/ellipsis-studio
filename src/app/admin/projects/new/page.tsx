import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import ProjectCreateForm from "@/components/admin/ProjectCreateForm";
import StudioNav from "@/components/admin/StudioNav";
import {
  createClient,
} from "@/lib/supabase/server";

export const metadata = {
  title: "New Project",
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

export default async function NewProjectPage() {
  const {
    supabase,
  } =
    await requireAdmin();

  const {
    data:
      clients,
    error,
  } =
    await supabase
      .from(
        "clients",
      )
      .select(
        "id,brand_name,contact_name,status",
      )
      .eq(
        "status",
        "active",
      )
      .order(
        "brand_name",
        {
          ascending:
            true,
        },
      );

  if (error) {
    throw new Error(
      `Unable to load clients: ${error.message}`,
    );
  }

  return (
    <main className="min-h-screen bg-[#11110f] text-[#f4f0e8]">
      <StudioNav active="projects" />

      <div className="mx-auto w-full max-w-7xl px-6 pb-20 pt-12 sm:px-8 lg:px-10 lg:pt-16">
        <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c8ad84]/55">
              Projects / New Project
            </p>

            <h1 className="mt-5 text-4xl font-medium tracking-[-0.055em] sm:text-5xl">
              Turn the engagement into an operating record.
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/38 sm:text-[15px]">
              Connect the project to its canonical client, define scope and schedule, then keep Owner-only financial context isolated from future workspace access.
            </p>
          </div>

          <Link
            href="/admin/projects"
            className="w-fit rounded-xl border border-white/10 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40 transition hover:border-[#c8ad84]/25 hover:text-[#ead6b5]"
          >
            Back to projects
          </Link>
        </section>

        {(clients ??
          []).length ===
        0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
            <p className="text-lg font-medium">
              An active client is required first.
            </p>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/35">
              Projects always belong to the canonical client record, so create or restore a client before opening new work.
            </p>

            <Link
              href="/admin/clients"
              className="mt-7 inline-flex rounded-xl border border-[#c8ad84]/25 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.13em] text-[#ead6b5]"
            >
              Open clients
            </Link>
          </div>
        ) : (
          <ProjectCreateForm
            clients={
              clients ??
              []
            }
          />
        )}
      </div>
    </main>
  );
}
import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import InvoiceAnalyticsDashboard from "@/components/admin/InvoiceAnalyticsDashboard";
import StudioNav from "@/components/admin/StudioNav";
import {
  createClient,
} from "@/lib/supabase/server";

export const metadata = {
  title:
    "Invoice Analytics",
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
}

export default async function InvoiceAnalyticsPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-[#11110f] text-[#f4f0e8]">
      <StudioNav active="invoices" />

      <div className="mx-auto w-full max-w-7xl px-6 pb-20 pt-12 sm:px-8 lg:px-10 lg:pt-16">
        <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c8ad84]/55">
              ELLIPSIS Studio / Finance
            </p>

            <h1 className="mt-5 text-4xl font-medium tracking-[-0.055em] text-[#f4f0e8] sm:text-5xl">
              Revenue without losing the invoice context.
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/38 sm:text-[15px]">
              See paid revenue, open balances, payment speed, client performance, and the invoices that need attention. Every currency stays separate, and overdue remains a derived status.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/invoices"
              className="rounded-xl border border-white/10 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/40 transition hover:border-white/20 hover:text-white/60"
            >
              Invoice Register
            </Link>

            <Link
              href="/admin/invoices/new"
              className="rounded-xl bg-[#f4f0e8] px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#11110f] transition hover:bg-white"
            >
              New Invoice
            </Link>
          </div>
        </section>

        <InvoiceAnalyticsDashboard />
      </div>
    </main>
  );
}

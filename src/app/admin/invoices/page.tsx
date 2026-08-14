import {
  redirect,
} from "next/navigation";

import StudioNav from "@/components/admin/StudioNav";
import InvoiceManagementDashboard from "@/components/admin/InvoiceManagementDashboard";
import {
  createClient,
} from "@/lib/supabase/server";

export const metadata = {
  title: "Invoices",
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

export default async function InvoicesPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-[#11110f] text-[#f4f0e8]">
      <StudioNav active="invoices" />

      <div className="mx-auto w-full max-w-7xl px-6 pb-20 pt-12 sm:px-8 lg:px-10 lg:pt-16">
        <section className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c8ad84]/55">
            ELLIPSIS Studio / Invoices
          </p>

          <h1 className="mt-5 text-4xl font-medium tracking-[-0.055em] text-[#f4f0e8] sm:text-5xl">
            Know what is open, paid, and next.
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/38 sm:text-[15px]">
            Your invoice workspace now separates creation from management. Search every invoice, see outstanding balances by currency, and move issued work through payment without losing the immutable final document.
          </p>
        </section>

        <InvoiceManagementDashboard />
      </div>
    </main>
  );
}

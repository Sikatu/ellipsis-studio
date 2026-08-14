import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import InvoiceBillingSetup from "@/components/admin/InvoiceBillingSetup";
import InvoiceBuilder from "@/components/admin/InvoiceBuilder";
import StudioNav from "@/components/admin/StudioNav";
import {
  createClient,
} from "@/lib/supabase/server";

export const metadata = {
  title: "New Invoice",
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

export default async function NewInvoicePage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-[#11110f] text-[#f4f0e8]">
      <StudioNav active="invoices" />

      <div className="mx-auto w-full max-w-7xl px-6 pb-20 pt-12 sm:px-8 lg:px-10 lg:pt-16">
        <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c8ad84]/55">
              Invoice Generator / New Invoice
            </p>

            <h1 className="mt-5 text-4xl font-medium tracking-[-0.055em] text-[#f4f0e8] sm:text-5xl">
              Choose the client. Add the work. Review.
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/38 sm:text-[15px]">
              Draft first, then issue only when the details are final. Issuing creates the immutable PDF and locks the invoice content.
            </p>
          </div>

          <Link
            href="/admin/invoices"
            className="w-fit rounded-xl border border-white/10 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40 transition hover:border-[#c8ad84]/25 hover:text-[#ead6b5]"
          >
            Back to invoices
          </Link>
        </section>

        <InvoiceBillingSetup />

        <InvoiceBuilder />
      </div>
    </main>
  );
}

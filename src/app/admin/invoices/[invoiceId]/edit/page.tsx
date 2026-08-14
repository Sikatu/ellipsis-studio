import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import InvoiceDraftEditor from "@/components/admin/InvoiceDraftEditor";
import StudioNav from "@/components/admin/StudioNav";
import {
  createClient,
} from "@/lib/supabase/server";

export const metadata = {
  title: "Edit Invoice Draft",
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

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{
    invoiceId: string;
  }>;
}) {
  await requireAdmin();

  const {
    invoiceId,
  } =
    await params;

  return (
    <main className="min-h-screen bg-[#11110f] text-[#f4f0e8]">
      <StudioNav active="invoices" />

      <div className="mx-auto w-full max-w-7xl px-6 pb-20 pt-12 sm:px-8 lg:px-10 lg:pt-16">
        <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c8ad84]/55">
              Invoice Generator / Draft
            </p>

            <h1 className="mt-5 text-4xl font-medium tracking-[-0.055em] text-[#f4f0e8] sm:text-5xl">
              Refine the draft before it becomes final.
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/38 sm:text-[15px]">
              Draft changes stay flexible. Once you issue the invoice, the billing snapshot, work items, totals, and final PDF are locked.
            </p>
          </div>

          <Link
            href={`/admin/invoices/${invoiceId}`}
            className="w-fit rounded-xl border border-white/10 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/42 transition hover:border-[#c8ad84]/25 hover:text-[#ead6b5]"
          >
            Back to invoice
          </Link>
        </section>

        <InvoiceDraftEditor
          invoiceId={
            invoiceId
          }
        />
      </div>
    </main>
  );
}

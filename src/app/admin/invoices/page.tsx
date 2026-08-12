import {
  redirect,
} from "next/navigation";

import StudioNav from "@/components/admin/StudioNav";
import InvoiceBillingSetup from "@/components/admin/InvoiceBillingSetup";
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

  const {
    count:
      clientCount,
  } =
    await supabase
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
      );

  return {
    clientCount:
      clientCount ??
      0,
  };
}

export default async function InvoicesPage() {
  const {
    clientCount,
  } =
    await requireAdmin();

  return (
    <main className="min-h-screen bg-[#11110f] text-[#f4f0e8]">
      <StudioNav active="invoices" />

      <div className="mx-auto w-full max-w-6xl px-6 pb-20 pt-12 sm:px-8 lg:px-10 lg:pt-16">
        <section className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c8ad84]/55">
            Invoice Generator
          </p>

          <h1 className="mt-5 text-4xl font-medium tracking-[-0.045em] sm:text-5xl">
            Invoicing should feel easy.
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/35 sm:text-base">
            We are building this around the way you actually work as a VA: choose who you worked for, add what you did, then review and generate the invoice.
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              step:
                "01",
              title:
                "Choose Client",
              copy:
                `${clientCount} existing client${clientCount === 1 ? "" : "s"} can be reused from your Studio workspace.`,
            },
            {
              step:
                "02",
              title:
                "Add Work",
              copy:
                "Add hours, fixed services, rates, notes, adjustments, and the currency you are billing in.",
            },
            {
              step:
                "03",
              title:
                "Review & Generate",
              copy:
                "Check the total, payment instructions, due date, and create a polished PDF invoice.",
            },
          ].map(
            (item) => (
              <article
                key={item.step}
                className="rounded-[24px] border border-white/[0.08] bg-[#161612] p-6"
              >
                <p className="text-[9px] font-semibold tracking-[0.14em] text-[#c8ad84]/45">
                  {item.step}
                </p>

                <h2 className="mt-5 text-lg font-medium tracking-[-0.025em] text-white/70">
                  {item.title}
                </h2>

                <p className="mt-3 text-xs leading-6 text-white/28">
                  {item.copy}
                </p>
              </article>
            ),
          )}
        </section>

        <InvoiceBillingSetup />
      </div>
    </main>
  );
}

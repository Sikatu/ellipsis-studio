import {
  redirect,
} from "next/navigation";

import InvoiceDetailView from "@/components/admin/InvoiceDetailView";
import StudioNav from "@/components/admin/StudioNav";
import {
  createClient,
} from "@/lib/supabase/server";

export const metadata = {
  title: "Invoice Detail",
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

export default async function InvoiceDetailPage({
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
        <InvoiceDetailView
          invoiceId={invoiceId}
        />
      </div>
    </main>
  );
}

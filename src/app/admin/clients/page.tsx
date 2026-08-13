import {
  redirect,
} from "next/navigation";

import ClientManagementHub, {
  type ClientManagementRecord,
} from "@/components/admin/ClientManagementHub";
import StudioNav from "@/components/admin/StudioNav";
import {
  createClient,
} from "@/lib/supabase/server";

export const metadata = {
  title: "Clients",
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

export default async function ClientsPage() {
  const {
    supabase,
  } =
    await requireAdmin();

  const [
    clientsResult,
    billingResult,
    projectsResult,
    invoicesResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "clients",
        )
        .select(
          "id,brand_name,contact_name,email,website,notes,status,created_at,updated_at",
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          },
        ),

      supabase
        .from(
          "client_billing_profiles",
        )
        .select(
          "client_id,billing_name,company_name,email,phone,address_line_1,address_line_2,city,region,postal_code,country,currency,payment_terms_days,notes",
        ),

      supabase
        .from(
          "discovery_projects",
        )
        .select(
          "id,client_id,status,progress,updated_at",
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
          "invoices",
        )
        .select(
          "id,client_id,invoice_number,status,invoice_date,due_date,currency,total_cents,created_at",
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          },
        ),
    ]);

  const firstError =
    clientsResult.error ||
    billingResult.error ||
    projectsResult.error ||
    invoicesResult.error;

  if (firstError) {
    throw new Error(
      `Unable to load client workspace: ${firstError.message}`,
    );
  }

  const billingByClient =
    new Map(
      (
        billingResult.data ??
        []
      ).map(
        (
          item,
        ) => [
          item.client_id,
          item,
        ],
      ),
    );

  const projectsByClient =
    new Map<
      string,
      Array<{
        id: string;
        status: string;
        progress: number;
        updated_at: string;
      }>
    >();

  for (
    const project of
      projectsResult.data ??
      []
  ) {
    const current =
      projectsByClient.get(
        project.client_id,
      ) ?? [];

    current.push({
      id:
        project.id,
      status:
        project.status,
      progress:
        project.progress,
      updated_at:
        project.updated_at,
    });

    projectsByClient.set(
      project.client_id,
      current,
    );
  }

  const invoicesByClient =
    new Map<
      string,
      ClientManagementRecord["invoices"]
    >();

  for (
    const invoice of
      invoicesResult.data ??
      []
  ) {
    const current =
      invoicesByClient.get(
        invoice.client_id,
      ) ?? [];

    current.push({
      id:
        invoice.id,
      invoice_number:
        invoice.invoice_number,
      status:
        invoice.status,
      invoice_date:
        invoice.invoice_date,
      due_date:
        invoice.due_date,
      currency:
        invoice.currency,
      total_cents:
        invoice.total_cents,
      created_at:
        invoice.created_at,
    });

    invoicesByClient.set(
      invoice.client_id,
      current,
    );
  }

  const records:
    ClientManagementRecord[] =
      (
        clientsResult.data ??
        []
      ).map(
        (
          client,
        ) => {
          const projects =
            projectsByClient.get(
              client.id,
            ) ?? [];

          return {
            ...client,
            billingProfile:
              billingByClient.get(
                client.id,
              ) ??
              null,
            discoveryCount:
              projects.length,
            latestDiscovery:
              projects[0] ??
              null,
            invoices:
              invoicesByClient.get(
                client.id,
              ) ??
              [],
          };
        },
      );

  return (
    <main className="min-h-screen bg-[#11110f] text-[#f4f0e8]">
      <StudioNav active="clients" />

      <div className="mx-auto w-full max-w-7xl px-6 pb-20 pt-12 sm:px-8 lg:px-10 lg:pt-16">
        <section className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c8ad84]/55">
            ELLIPSIS Studio / Clients
          </p>

          <h1 className="mt-5 text-4xl font-medium tracking-[-0.055em] text-[#f4f0e8] sm:text-5xl">
            One client record. Every kind of work.
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/38 sm:text-[15px]">
            Search Brand Discovery and invoice-only clients together, update reusable contact and billing details, review invoice history, or archive records without changing issued invoice snapshots.
          </p>
        </section>

        <ClientManagementHub
          initialRecords={
            records
          }
        />
      </div>
    </main>
  );
}
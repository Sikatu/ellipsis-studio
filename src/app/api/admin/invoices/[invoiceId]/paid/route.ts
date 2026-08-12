import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

export const dynamic =
  "force-dynamic";

async function authenticatedAdmin() {
  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return null;
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

  return profile
    ? user
    : null;
}

function jsonError(
  message: string,
  status: number,
) {
  return Response.json(
    {
      error:
        message,
    },
    {
      status,
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
      },
    },
  );
}

export async function POST(
  _request: Request,
  context: {
    params:
      Promise<{
        invoiceId:
          string;
      }>;
  },
) {
  const user =
    await authenticatedAdmin();

  if (!user) {
    return jsonError(
      "Unauthorized",
      401,
    );
  }

  const {
    invoiceId,
  } =
    await context.params;

  if (
    !/^[0-9a-f-]{36}$/i.test(
      invoiceId,
    )
  ) {
    return jsonError(
      "Invalid invoice.",
      400,
    );
  }

  const admin =
    createAdminClient();

  const {
    data: current,
    error: currentError,
  } =
    await admin
      .from(
        "invoices",
      )
      .select(
        "id,status",
      )
      .eq(
        "id",
        invoiceId,
      )
      .eq(
        "created_by",
        user.id,
      )
      .maybeSingle();

  if (currentError) {
    return jsonError(
      currentError.message,
      500,
    );
  }

  if (!current) {
    return jsonError(
      "Invoice not found.",
      404,
    );
  }

  if (
    current.status ===
      "paid"
  ) {
    const {
      data: paidInvoice,
      error: paidError,
    } =
      await admin
        .from(
          "invoices",
        )
        .select(
          "id,client_id,invoice_number,status,invoice_date,due_date,currency,subtotal_cents,discount_cents,tax_cents,adjustment_cents,total_cents,issued_at,paid_at,voided_at,final_pdf_created_at,created_at",
        )
        .eq(
          "id",
          invoiceId,
        )
        .eq(
          "created_by",
          user.id,
        )
        .single();

    if (
      paidError ||
      !paidInvoice
    ) {
      return jsonError(
        paidError?.message ??
          "Could not reload paid invoice.",
        500,
      );
    }

    return Response.json(
      {
        invoice:
          paidInvoice,
      },
      {
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      },
    );
  }

  if (
    current.status !==
      "issued"
  ) {
    return jsonError(
      "Only issued invoices can be marked as paid.",
      409,
    );
  }

  const {
    data: invoice,
    error,
  } =
    await admin
      .from(
        "invoices",
      )
      .update({
        status:
          "paid",
      })
      .eq(
        "id",
        invoiceId,
      )
      .eq(
        "created_by",
        user.id,
      )
      .eq(
        "status",
        "issued",
      )
      .select(
        "id,client_id,invoice_number,status,invoice_date,due_date,currency,subtotal_cents,discount_cents,tax_cents,adjustment_cents,total_cents,issued_at,paid_at,voided_at,final_pdf_created_at,created_at",
      )
      .maybeSingle();

  if (
    error ||
    !invoice
  ) {
    return jsonError(
      error?.message ??
        "Invoice changed before it could be marked paid.",
      409,
    );
  }

  return Response.json(
    {
      invoice,
    },
    {
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
      },
    },
  );
}

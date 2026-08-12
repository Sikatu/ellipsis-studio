import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

export const dynamic =
  "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

const invoiceSelect =
  "id,client_id,invoice_number,status,invoice_date,due_date,currency,subtotal_cents,discount_cents,tax_cents,adjustment_cents,total_cents,issued_at,paid_at,voided_at,final_pdf_created_at,created_at";

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
    !uuidPattern.test(
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
        "id,status,final_pdf_created_at",
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
      "void"
  ) {
    const {
      data: voidInvoice,
      error: reloadError,
    } =
      await admin
        .from(
          "invoices",
        )
        .select(
          invoiceSelect,
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
      reloadError ||
      !voidInvoice
    ) {
      return jsonError(
        reloadError?.message ??
          "Could not reload void invoice.",
        500,
      );
    }

    return Response.json(
      {
        invoice:
          voidInvoice,
        alreadyVoid:
          true,
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
    current.status ===
      "paid"
  ) {
    return jsonError(
      "Paid invoices cannot be voided.",
      409,
    );
  }

  if (
    current.status !==
      "draft" &&
    current.status !==
      "issued"
  ) {
    return jsonError(
      "Only draft or issued invoices can be voided.",
      409,
    );
  }

  const previousStatus =
    current.status;

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
          "void",
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
        previousStatus,
      )
      .select(
        invoiceSelect,
      )
      .maybeSingle();

  if (
    error ||
    !invoice
  ) {
    return jsonError(
      error?.message ??
        "Invoice changed before it could be voided.",
      409,
    );
  }

  return Response.json(
    {
      invoice,
      preservedFinalPdf:
        previousStatus ===
          "issued" &&
        Boolean(
          current.final_pdf_created_at,
        ),
    },
    {
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
      },
    },
  );
}

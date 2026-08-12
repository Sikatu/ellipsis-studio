import {
  NextResponse,
} from "next/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";
import {
  createClient,
} from "@/lib/supabase/server";

export const runtime =
  "nodejs";

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

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      invoiceId: string;
    }>;
  },
) {
  const user =
    await authenticatedAdmin();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Unauthorized",
      },
      {
        status:
          401,
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      },
    );
  }

  const {
    invoiceId,
  } =
    await params;

  if (
    !uuidPattern.test(
      invoiceId,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid invoice ID",
      },
      {
        status:
          400,
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      },
    );
  }

  const admin =
    createAdminClient();

  const [
    invoiceResult,
    itemResult,
  ] =
    await Promise.all([
      admin
        .from(
          "invoices",
        )
        .select(
          "id,client_id,invoice_number,status,invoice_date,due_date,currency,sender_snapshot,client_snapshot,payment_instructions_snapshot,notes,subtotal_cents,discount_cents,tax_cents,adjustment_cents,total_cents,issued_at,paid_at,voided_at,final_pdf_sha256,final_pdf_bytes,final_pdf_created_at,created_at,updated_at",
        )
        .eq(
          "id",
          invoiceId,
        )
        .eq(
          "created_by",
          user.id,
        )
        .maybeSingle(),

      admin
        .from(
          "invoice_items",
        )
        .select(
          "id,sort_order,description,quantity,unit_label,unit_rate_cents,amount_cents,notes",
        )
        .eq(
          "invoice_id",
          invoiceId,
        )
        .eq(
          "created_by",
          user.id,
        )
        .order(
          "sort_order",
          {
            ascending:
              true,
          },
        ),
    ]);

  if (
    invoiceResult.error ||
    itemResult.error
  ) {
    return NextResponse.json(
      {
        error:
          "Could not load invoice.",
      },
      {
        status:
          500,
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      },
    );
  }

  if (!invoiceResult.data) {
    return NextResponse.json(
      {
        error:
          "Invoice not found",
      },
      {
        status:
          404,
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      },
    );
  }

  return NextResponse.json(
    {
      invoice:
        invoiceResult.data,

      items:
        itemResult.data ??
        [],
    },
    {
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

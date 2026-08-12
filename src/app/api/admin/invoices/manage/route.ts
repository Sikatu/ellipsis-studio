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

export async function GET() {
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

  const admin =
    createAdminClient();

  const {
    data,
    error,
  } =
    await admin
      .from(
        "invoices",
      )
      .select(
        "id,client_id,invoice_number,status,invoice_date,due_date,currency,client_snapshot,subtotal_cents,discount_cents,tax_cents,adjustment_cents,total_cents,issued_at,paid_at,voided_at,final_pdf_created_at,created_at,updated_at",
      )
      .eq(
        "created_by",
        user.id,
      )
      .order(
        "invoice_date",
        {
          ascending:
            false,
        },
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      )
      .limit(
        500,
      );

  if (error) {
    return NextResponse.json(
      {
        error:
          "Could not load invoice management data.",
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

  return NextResponse.json(
    {
      invoices:
        data ?? [],
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

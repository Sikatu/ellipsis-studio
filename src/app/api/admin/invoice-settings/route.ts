import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  INVOICE_CURRENCIES,
  normalizeInvoicePrefix,
  type InvoiceCurrency,
} from "@/lib/invoice";

const currencySet =
  new Set<string>(
    INVOICE_CURRENCIES,
  );

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
    return {
      user:
        null,
    };
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

  return {
    user:
      profile
        ? user
        : null,
  };
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

function text(
  value: unknown,
  maxLength: number,
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value
    .trim()
    .slice(
      0,
      maxLength,
    );
}

export async function GET() {
  const {
    user,
  } =
    await authenticatedAdmin();

  if (!user) {
    return jsonError(
      "Unauthorized",
      401,
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
        "studio_billing_profiles",
      )
      .select(
        "id,created_by,display_name,business_name,email,phone,address_line_1,address_line_2,city,region,postal_code,country,default_currency,default_payment_terms_days,invoice_prefix,payment_instructions,default_notes,created_at,updated_at",
      )
      .eq(
        "created_by",
        user.id,
      )
      .maybeSingle();

  if (error) {
    return jsonError(
      error.message,
      500,
    );
  }

  return Response.json(
    {
      profile:
        data,
    },
    {
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
      },
    },
  );
}

export async function PATCH(
  request: Request,
) {
  const {
    user,
  } =
    await authenticatedAdmin();

  if (!user) {
    return jsonError(
      "Unauthorized",
      401,
    );
  }

  let body:
    Record<
      string,
      unknown
    >;

  try {
    const parsed =
      await request.json();

    if (
      typeof parsed !==
        "object" ||
      parsed ===
        null ||
      Array.isArray(
        parsed,
      )
    ) {
      throw new Error(
        "Invalid body.",
      );
    }

    body =
      parsed as Record<
        string,
        unknown
      >;
  } catch {
    return jsonError(
      "Invalid billing profile.",
      400,
    );
  }

  const displayName =
    text(
      body.displayName,
      240,
    );

  if (!displayName) {
    return jsonError(
      "Add your name so invoices know who they are from.",
      400,
    );
  }

  const currency =
    text(
      body.defaultCurrency,
      3,
    )
      .toUpperCase();

  if (
    !currencySet.has(
      currency,
    )
  ) {
    return jsonError(
      "Choose a supported invoice currency.",
      400,
    );
  }

  const paymentTerms =
    typeof body.defaultPaymentTermsDays ===
      "number"
      ? body.defaultPaymentTermsDays
      : Number(
          body.defaultPaymentTermsDays,
        );

  if (
    !Number.isInteger(
      paymentTerms,
    ) ||
    paymentTerms < 0 ||
    paymentTerms > 365
  ) {
    return jsonError(
      "Payment terms must be between 0 and 365 days.",
      400,
    );
  }

  const invoicePrefix =
    normalizeInvoicePrefix(
      text(
        body.invoicePrefix,
        12,
      ),
    );

  if (
    invoicePrefix.length < 2
  ) {
    return jsonError(
      "Invoice prefix needs at least 2 letters or numbers.",
      400,
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
        "studio_billing_profiles",
      )
      .upsert(
        {
          created_by:
            user.id,
          display_name:
            displayName,
          business_name:
            text(
              body.businessName,
              240,
            ),
          email:
            text(
              body.email,
              320,
            ),
          phone:
            text(
              body.phone,
              80,
            ),
          address_line_1:
            text(
              body.addressLine1,
              500,
            ),
          address_line_2:
            text(
              body.addressLine2,
              500,
            ),
          city:
            text(
              body.city,
              240,
            ),
          region:
            text(
              body.region,
              240,
            ),
          postal_code:
            text(
              body.postalCode,
              80,
            ),
          country:
            text(
              body.country,
              240,
            ),
          default_currency:
            currency as
              InvoiceCurrency,
          default_payment_terms_days:
            paymentTerms,
          invoice_prefix:
            invoicePrefix,
          payment_instructions:
            text(
              body.paymentInstructions,
              10000,
            ),
          default_notes:
            text(
              body.defaultNotes,
              10000,
            ),
        },
        {
          onConflict:
            "created_by",
        },
      )
      .select(
        "id,created_by,display_name,business_name,email,phone,address_line_1,address_line_2,city,region,postal_code,country,default_currency,default_payment_terms_days,invoice_prefix,payment_instructions,default_notes,created_at,updated_at",
      )
      .single();

  if (
    error ||
    !data
  ) {
    return jsonError(
      error?.message ??
        "Could not save billing setup.",
      409,
    );
  }

  return Response.json(
    {
      profile:
        data,
    },
    {
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
      },
    },
  );
}

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  INVOICE_CURRENCIES,
  type InvoiceCurrency,
} from "@/lib/invoice";

const currencySet =
  new Set<string>(
    INVOICE_CURRENCIES,
  );

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonObject =
  Record<
    string,
    unknown
  >;

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

function integer(
  value: unknown,
) {
  if (
    typeof value ===
      "number" &&
    Number.isInteger(
      value,
    )
  ) {
    return value;
  }

  const parsed =
    Number(value);

  return Number.isInteger(
    parsed,
  )
    ? parsed
    : null;
}

function positiveNumber(
  value: unknown,
) {
  const parsed =
    typeof value ===
      "number"
      ? value
      : Number(value);

  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function dateString(
  value: unknown,
) {
  const candidate =
    text(
      value,
      10,
    );

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      candidate,
    )
  ) {
    return "";
  }

  const parsed =
    new Date(
      `${candidate}T00:00:00Z`,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return "";
  }

  return candidate;
}

function senderSnapshot(
  profile:
    Record<
      string,
      unknown
    >,
) {
  return {
    displayName:
      profile.display_name,
    businessName:
      profile.business_name,
    email:
      profile.email,
    phone:
      profile.phone,
    addressLine1:
      profile.address_line_1,
    addressLine2:
      profile.address_line_2,
    city:
      profile.city,
    region:
      profile.region,
    postalCode:
      profile.postal_code,
    country:
      profile.country,
  };
}

function clientSnapshot(
  profile:
    Record<
      string,
      unknown
    >,
) {
  return {
    billingName:
      profile.billing_name,
    companyName:
      profile.company_name,
    email:
      profile.email,
    phone:
      profile.phone,
    addressLine1:
      profile.address_line_1,
    addressLine2:
      profile.address_line_2,
    city:
      profile.city,
    region:
      profile.region,
    postalCode:
      profile.postal_code,
    country:
      profile.country,
  };
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

  const [
    studioResult,
    clientsResult,
    billingResult,
    invoicesResult,
  ] =
    await Promise.all([
      admin
        .from(
          "studio_billing_profiles",
        )
        .select(
          "id,display_name,business_name,email,phone,address_line_1,address_line_2,city,region,postal_code,country,default_currency,default_payment_terms_days,invoice_prefix,payment_instructions,default_notes",
        )
        .eq(
          "created_by",
          user.id,
        )
        .maybeSingle(),

      admin
        .from(
          "clients",
        )
        .select(
          "id,brand_name,contact_name,email,website,notes,status,created_at",
        )
        .eq(
          "created_by",
          user.id,
        )
        .eq(
          "status",
          "active",
        )
        .order(
          "brand_name",
          {
            ascending:
              true,
          },
        ),

      admin
        .from(
          "client_billing_profiles",
        )
        .select(
          "id,client_id,billing_name,company_name,email,phone,address_line_1,address_line_2,city,region,postal_code,country,currency,payment_terms_days,notes",
        )
        .eq(
          "created_by",
          user.id,
        ),

      admin
        .from(
          "invoices",
        )
        .select(
          "id,client_id,invoice_number,status,invoice_date,due_date,currency,subtotal_cents,discount_cents,tax_cents,adjustment_cents,total_cents,issued_at,paid_at,voided_at,final_pdf_created_at,created_at",
        )
        .eq(
          "created_by",
          user.id,
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          },
        )
        .limit(20),
    ]);

  for (
    const result
    of [
      studioResult,
      clientsResult,
      billingResult,
      invoicesResult,
    ]
  ) {
    if (result.error) {
      return jsonError(
        result.error.message,
        500,
      );
    }
  }

  const billingMap =
    new Map(
      (
        billingResult.data ??
        []
      ).map(
        (
          profile,
        ) => [
          profile.client_id,
          profile,
        ],
      ),
    );

  return Response.json(
    {
      studioProfile:
        studioResult.data,
      clients:
        (
          clientsResult.data ??
          []
        ).map(
          (
            client,
          ) => ({
            ...client,
            billingProfile:
              billingMap.get(
                client.id,
              ) ??
              null,
          }),
        ),
      invoices:
        invoicesResult.data ??
        [],
    },
    {
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
      },
    },
  );
}

export async function POST(
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
    JsonObject;

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
      parsed as JsonObject;
  } catch {
    return jsonError(
      "Invalid invoice request.",
      400,
    );
  }

  const clientId =
    text(
      body.clientId,
      36,
    );

  if (
    !uuidPattern.test(
      clientId,
    )
  ) {
    return jsonError(
      "Choose a valid client.",
      400,
    );
  }

  const invoiceDate =
    dateString(
      body.invoiceDate,
    );

  const dueDate =
    dateString(
      body.dueDate,
    );

  if (
    !invoiceDate ||
    !dueDate
  ) {
    return jsonError(
      "Choose valid invoice and due dates.",
      400,
    );
  }

  if (
    dueDate <
    invoiceDate
  ) {
    return jsonError(
      "Due date cannot be before the invoice date.",
      400,
    );
  }

  const currency =
    text(
      body.currency,
      3,
    )
      .toUpperCase();

  if (
    !currencySet.has(
      currency,
    )
  ) {
    return jsonError(
      "Choose a supported currency.",
      400,
    );
  }

  const paymentTerms =
    integer(
      body.paymentTermsDays,
    );

  if (
    paymentTerms ===
      null ||
    paymentTerms < 0 ||
    paymentTerms > 365
  ) {
    return jsonError(
      "Payment terms must be between 0 and 365 days.",
      400,
    );
  }

  const clientBillingRaw =
    body.clientBilling;

  if (
    typeof clientBillingRaw !==
      "object" ||
    clientBillingRaw ===
      null ||
    Array.isArray(
      clientBillingRaw,
    )
  ) {
    return jsonError(
      "Client billing details are missing.",
      400,
    );
  }

  const clientBilling =
    clientBillingRaw as
      JsonObject;

  const lineItemsRaw =
    body.lineItems;

  if (
    !Array.isArray(
      lineItemsRaw,
    ) ||
    lineItemsRaw.length <
      1 ||
    lineItemsRaw.length >
      100
  ) {
    return jsonError(
      "Add at least one work item.",
      400,
    );
  }

  const lineItems:
    Array<{
      description: string;
      quantity: number;
      unit_label: string;
      unit_rate_cents: number;
      notes: string;
      sort_order: number;
    }> =
      [];

  for (
    let index = 0;
    index <
      lineItemsRaw.length;
    index += 1
  ) {
    const raw =
      lineItemsRaw[
        index
      ];

    if (
      typeof raw !==
        "object" ||
      raw ===
        null ||
      Array.isArray(
        raw,
      )
    ) {
      return jsonError(
        `Work item ${index + 1} is invalid.`,
        400,
      );
    }

    const item =
      raw as
        JsonObject;

    const description =
      text(
        item.description,
        1000,
      );

    const quantity =
      positiveNumber(
        item.quantity,
      );

    const unitRateCents =
      integer(
        item.unitRateCents,
      );

    const unitLabel =
      text(
        item.unitLabel,
        80,
      );

    if (!description) {
      return jsonError(
        `Add a description for work item ${index + 1}.`,
        400,
      );
    }

    if (
      quantity ===
        null ||
      quantity >
        1000000
    ) {
      return jsonError(
        `Quantity for work item ${index + 1} is invalid.`,
        400,
      );
    }

    if (
      unitRateCents ===
        null ||
      unitRateCents < 0 ||
      unitRateCents >
        100000000000
    ) {
      return jsonError(
        `Rate for work item ${index + 1} is invalid.`,
        400,
      );
    }

    if (!unitLabel) {
      return jsonError(
        `Choose a unit for work item ${index + 1}.`,
        400,
      );
    }

    lineItems.push({
      description,
      quantity,
      unit_label:
        unitLabel,
      unit_rate_cents:
        unitRateCents,
      notes:
        text(
          item.notes,
          5000,
        ),
      sort_order:
        index,
    });
  }

  const admin =
    createAdminClient();

  const [
    studioResult,
    clientResult,
  ] =
    await Promise.all([
      admin
        .from(
          "studio_billing_profiles",
        )
        .select(
          "id,created_by,display_name,business_name,email,phone,address_line_1,address_line_2,city,region,postal_code,country,default_currency,default_payment_terms_days,invoice_prefix,payment_instructions,default_notes",
        )
        .eq(
          "created_by",
          user.id,
        )
        .maybeSingle(),

      admin
        .from(
          "clients",
        )
        .select(
          "id,created_by,brand_name,contact_name,email,status",
        )
        .eq(
          "id",
          clientId,
        )
        .eq(
          "created_by",
          user.id,
        )
        .eq(
          "status",
          "active",
        )
        .maybeSingle(),
    ]);

  if (
    studioResult.error ||
    !studioResult.data
  ) {
    return jsonError(
      "Complete your invoice setup before creating an invoice.",
      409,
    );
  }

  if (
    clientResult.error ||
    !clientResult.data
  ) {
    return jsonError(
      "Client not found.",
      404,
    );
  }

  const billingName =
    text(
      clientBilling.billingName,
      240,
    ) ||
    text(
      clientResult.data
        .contact_name,
      240,
    ) ||
    text(
      clientResult.data
        .brand_name,
      240,
    );

  const companyName =
    text(
      clientBilling.companyName,
      240,
    ) ||
    text(
      clientResult.data
        .brand_name,
      240,
    );

  const billingRow = {
    client_id:
      clientId,
    created_by:
      user.id,
    billing_name:
      billingName,
    company_name:
      companyName,
    email:
      text(
        clientBilling.email,
        320,
      ) ||
      text(
        clientResult.data
          .email,
        320,
      ),
    phone:
      text(
        clientBilling.phone,
        80,
      ),
    address_line_1:
      text(
        clientBilling.addressLine1,
        500,
      ),
    address_line_2:
      text(
        clientBilling.addressLine2,
        500,
      ),
    city:
      text(
        clientBilling.city,
        240,
      ),
    region:
      text(
        clientBilling.region,
        240,
      ),
    postal_code:
      text(
        clientBilling.postalCode,
        80,
      ),
    country:
      text(
        clientBilling.country,
        240,
      ),
    currency:
      currency as
        InvoiceCurrency,
    payment_terms_days:
      paymentTerms,
    notes:
      text(
        clientBilling.notes,
        10000,
      ),
  };

  const {
    data:
      savedBilling,
    error:
      billingError,
  } =
    await admin
      .from(
        "client_billing_profiles",
      )
      .upsert(
        billingRow,
        {
          onConflict:
            "client_id",
        },
      )
      .select(
        "id,client_id,billing_name,company_name,email,phone,address_line_1,address_line_2,city,region,postal_code,country,currency,payment_terms_days,notes",
      )
      .single();

  if (
    billingError ||
    !savedBilling
  ) {
    return jsonError(
      billingError?.message ??
        "Could not save client billing details.",
      409,
    );
  }

  const {
    data:
      invoice,
    error:
      invoiceError,
  } =
    await admin
      .from(
        "invoices",
      )
      .insert({
        created_by:
          user.id,
        client_id:
          clientId,
        invoice_number:
          "PENDING",
        status:
          "draft",
        invoice_date:
          invoiceDate,
        due_date:
          dueDate,
        currency:
          currency,
        sender_snapshot:
          senderSnapshot(
            studioResult.data,
          ),
        client_snapshot:
          clientSnapshot(
            savedBilling,
          ),
        payment_instructions_snapshot:
          text(
            body.paymentInstructions,
            10000,
          ) ||
          text(
            studioResult.data
              .payment_instructions,
            10000,
          ),
        notes:
          text(
            body.notes,
            10000,
          ) ||
          text(
            studioResult.data
              .default_notes,
            10000,
          ),
        subtotal_cents:
          0,
        discount_cents:
          0,
        tax_cents:
          0,
        adjustment_cents:
          0,
        total_cents:
          0,
      })
      .select(
        "id,client_id,invoice_number,status,invoice_date,due_date,currency,sender_snapshot,client_snapshot,payment_instructions_snapshot,notes,subtotal_cents,discount_cents,tax_cents,adjustment_cents,total_cents,issued_at,paid_at,voided_at,final_pdf_created_at,created_at",
      )
      .single();

  if (
    invoiceError ||
    !invoice
  ) {
    return jsonError(
      invoiceError?.message ??
        "Could not create invoice draft.",
      409,
    );
  }

  const rows =
    lineItems.map(
      (
        item,
      ) => ({
        invoice_id:
          invoice.id,
        created_by:
          user.id,
        ...item,
      }),
    );

  const {
    data:
      savedItems,
    error:
      itemError,
  } =
    await admin
      .from(
        "invoice_items",
      )
      .insert(
        rows,
      )
      .select(
        "id,invoice_id,sort_order,description,quantity,unit_label,unit_rate_cents,amount_cents,notes",
      );

  if (itemError) {
    await admin
      .from(
        "invoices",
      )
      .delete()
      .eq(
        "id",
        invoice.id,
      )
      .eq(
        "created_by",
        user.id,
      );

    return jsonError(
      itemError.message,
      409,
    );
  }

  const {
    data:
      completedInvoice,
    error:
      refreshError,
  } =
    await admin
      .from(
        "invoices",
      )
      .select(
        "id,client_id,invoice_number,status,invoice_date,due_date,currency,sender_snapshot,client_snapshot,payment_instructions_snapshot,notes,subtotal_cents,discount_cents,tax_cents,adjustment_cents,total_cents,issued_at,paid_at,voided_at,final_pdf_created_at,created_at",
      )
      .eq(
        "id",
        invoice.id,
      )
      .eq(
        "created_by",
        user.id,
      )
      .single();

  if (
    refreshError ||
    !completedInvoice
  ) {
    return jsonError(
      refreshError?.message ??
        "Invoice was created but could not be reloaded.",
      500,
    );
  }

  return Response.json(
    {
      invoice:
        completedInvoice,
      items:
        savedItems ??
        [],
      clientBilling:
        savedBilling,
    },
    {
      status:
        201,
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
      },
    },
  );
}

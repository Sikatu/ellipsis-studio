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

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const emailPattern =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const currencySet =
  new Set<string>(
    INVOICE_CURRENCIES,
  );

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
    return null;
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

  return profile
    ? user
    : null;
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
  const parsed =
    Number(
      value,
    );

  return Number.isInteger(
    parsed,
  )
    ? parsed
    : null;
}

function validEmail(
  value: string,
) {
  return (
    !value ||
    (
      value.length <=
        320 &&
      !/[\r\n]/.test(
        value,
      ) &&
      emailPattern.test(
        value,
      )
    )
  );
}

function trustedRequestOrigin(
  request: Request,
) {
  const configured =
    (
      process.env
        .ELLIPSIS_PUBLIC_APP_URL ??
      ""
    ).trim();

  const supplied =
    request.headers
      .get(
        "origin",
      )
      ?.trim() ??
    "";

  if (!supplied) {
    return false;
  }

  try {
    const suppliedOrigin =
      new URL(
        supplied,
      ).origin;

    const requestOrigin =
      new URL(
        request.url,
      ).origin;

    const configuredOrigin =
      configured
        ? new URL(
            configured,
          ).origin
        : "";

    return (
      suppliedOrigin ===
        requestOrigin ||
      (
        Boolean(
          configuredOrigin,
        ) &&
        suppliedOrigin ===
          configuredOrigin
      )
    );
  } catch {
    return false;
  }
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
        "Referrer-Policy":
          "no-referrer",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

async function ownedClient(
  admin:
    ReturnType<
      typeof createAdminClient
    >,
  userId: string,
  clientId: string,
) {
  return admin
    .from(
      "clients",
    )
    .select(
      "id,created_by,brand_name,contact_name,email,website,notes,status,created_at,updated_at",
    )
    .eq(
      "id",
      clientId,
    )
    .eq(
      "created_by",
      userId,
    )
    .maybeSingle();
}

export async function PUT(
  request: Request,
  {
    params,
  }: {
    params:
      Promise<{
        clientId: string;
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

  if (
    !trustedRequestOrigin(
      request,
    )
  ) {
    return jsonError(
      "Client update request origin was rejected.",
      403,
    );
  }

  const {
    clientId,
  } =
    await params;

  if (
    !uuidPattern.test(
      clientId,
    )
  ) {
    return jsonError(
      "Invalid client.",
      400,
    );
  }

  let body:
    JsonObject;

  try {
    const parsed =
      await request.json();

    if (
      !parsed ||
      typeof parsed !==
        "object" ||
      Array.isArray(
        parsed,
      )
    ) {
      throw new Error(
        "Invalid body.",
      );
    }

    body =
      parsed as
        JsonObject;
  } catch {
    return jsonError(
      "Invalid client request.",
      400,
    );
  }

  const brandName =
    text(
      body.brandName,
      240,
    );

  const contactName =
    text(
      body.contactName,
      240,
    );

  const email =
    text(
      body.email,
      320,
    )
      .toLowerCase();

  const billingEmail =
    text(
      body.billingEmail,
      320,
    )
      .toLowerCase();

  const currency =
    text(
      body.currency,
      3,
    )
      .toUpperCase();

  const paymentTerms =
    integer(
      body.paymentTermsDays,
    );

  if (!brandName) {
    return jsonError(
      "Company / brand is required.",
      400,
    );
  }

  if (
    !validEmail(
      email,
    ) ||
    !validEmail(
      billingEmail,
    )
  ) {
    return jsonError(
      "Enter valid client email addresses.",
      400,
    );
  }

  if (
    !currencySet.has(
      currency,
    )
  ) {
    return jsonError(
      "Choose a supported billing currency.",
      400,
    );
  }

  if (
    paymentTerms ===
      null ||
    paymentTerms <
      0 ||
    paymentTerms >
      365
  ) {
    return jsonError(
      "Payment terms must be between 0 and 365 days.",
      400,
    );
  }

  const admin =
    createAdminClient();

  const {
    data:
      currentClient,
    error:
      currentError,
  } =
    await ownedClient(
      admin,
      user.id,
      clientId,
    );

  if (
    currentError ||
    !currentClient
  ) {
    return jsonError(
      "Client not found.",
      404,
    );
  }

  const {
    data:
      updatedClient,
    error:
      clientError,
  } =
    await admin
      .from(
        "clients",
      )
      .update({
        brand_name:
          brandName,
        contact_name:
          contactName ||
          null,
        email:
          email ||
          null,
        website:
          text(
            body.website,
            500,
          ) ||
          null,
        notes:
          text(
            body.notes,
            10000,
          ) ||
          null,
      })
      .eq(
        "id",
        clientId,
      )
      .eq(
        "created_by",
        user.id,
      )
      .select(
        "id,brand_name,contact_name,email,website,notes,status,created_at,updated_at",
      )
      .single();

  if (
    clientError ||
    !updatedClient
  ) {
    return jsonError(
      clientError?.message ||
        "Could not update client.",
      409,
    );
  }

  const billingRow = {
    client_id:
      clientId,
    created_by:
      user.id,
    billing_name:
      text(
        body.billingName,
        240,
      ) ||
      contactName ||
      brandName,
    company_name:
      text(
        body.companyName,
        240,
      ) ||
      brandName,
    email:
      billingEmail ||
      email,
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
    currency:
      currency as
        InvoiceCurrency,
    payment_terms_days:
      paymentTerms,
    notes:
      text(
        body.billingNotes,
        10000,
      ),
  };

  const {
    data:
      billingProfile,
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
        "billing_name,company_name,email,phone,address_line_1,address_line_2,city,region,postal_code,country,currency,payment_terms_days,notes",
      )
      .single();

  if (
    billingError ||
    !billingProfile
  ) {
    return jsonError(
      billingError?.message ||
        "Client updated, but billing profile could not be saved.",
      409,
    );
  }

  return Response.json(
    {
      client:
        updatedClient,
      billingProfile,
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

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params:
      Promise<{
        clientId: string;
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

  if (
    !trustedRequestOrigin(
      request,
    )
  ) {
    return jsonError(
      "Client status request origin was rejected.",
      403,
    );
  }

  const {
    clientId,
  } =
    await params;

  if (
    !uuidPattern.test(
      clientId,
    )
  ) {
    return jsonError(
      "Invalid client.",
      400,
    );
  }

  let body:
    JsonObject;

  try {
    body =
      await request.json() as
        JsonObject;
  } catch {
    return jsonError(
      "Invalid client status request.",
      400,
    );
  }

  const status =
    text(
      body.status,
      20,
    );

  if (
    status !==
      "active" &&
    status !==
      "archived"
  ) {
    return jsonError(
      "Choose active or archived status.",
      400,
    );
  }

  const admin =
    createAdminClient();

  const {
    data:
      currentClient,
    error:
      currentError,
  } =
    await ownedClient(
      admin,
      user.id,
      clientId,
    );

  if (
    currentError ||
    !currentClient
  ) {
    return jsonError(
      "Client not found.",
      404,
    );
  }

  const {
    data:
      updated,
    error:
      updateError,
  } =
    await admin
      .from(
        "clients",
      )
      .update({
        status,
      })
      .eq(
        "id",
        clientId,
      )
      .eq(
        "created_by",
        user.id,
      )
      .select(
        "status",
      )
      .single();

  if (
    updateError ||
    !updated
  ) {
    return jsonError(
      updateError?.message ||
        "Could not change client status.",
      409,
    );
  }

  return Response.json(
    {
      status:
        updated.status,
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
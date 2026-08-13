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

type JsonObject =
  Record<
    string,
    unknown
  >;

const emailPattern =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  if (
    !supplied
  ) {
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

async function clientWithBilling(
  admin:
    ReturnType<
      typeof createAdminClient
    >,
  userId: string,
  client: {
    id: string;
    brand_name: string;
    contact_name:
      string | null;
    email:
      string | null;
    status: string;
  },
) {
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
      .select(
        "billing_name,company_name,email,phone,address_line_1,address_line_2,city,region,postal_code,country,currency,payment_terms_days,notes",
      )
      .eq(
        "client_id",
        client.id,
      )
      .eq(
        "created_by",
        userId,
      )
      .maybeSingle();

  if (billingError) {
    throw billingError;
  }

  return {
    ...client,
    billingProfile:
      billingProfile ??
      null,
  };
}

export async function POST(
  request: Request,
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
      "Client creation request origin was rejected.",
      403,
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

  const contactName =
    text(
      body.contactName,
      240,
    );

  const requestedBrand =
    text(
      body.brandName,
      240,
    );

  const brandName =
    requestedBrand ||
    contactName;

  const email =
    text(
      body.email,
      320,
    )
      .toLowerCase();

  if (!brandName) {
    return jsonError(
      "Add a company / brand or billing contact.",
      400,
    );
  }

  if (
    !validEmail(
      email,
    )
  ) {
    return jsonError(
      "Enter a valid client email address.",
      400,
    );
  }

  const admin =
    createAdminClient();

  if (email) {
    const {
      data:
        existing,
      error:
        existingError,
    } =
      await admin
        .from(
          "clients",
        )
        .select(
          "id,brand_name,contact_name,email,status",
        )
        .eq(
          "created_by",
          user.id,
        )
        .eq(
          "status",
          "active",
        )
        .eq(
          "email",
          email,
        )
        .maybeSingle();

    if (existingError) {
      return jsonError(
        "Could not check existing clients.",
        500,
      );
    }

    if (existing) {
      try {
        return Response.json(
          {
            client:
              await clientWithBilling(
                admin,
                user.id,
                existing,
              ),
            reused:
              true,
          },
          {
            headers: {
              "Cache-Control":
                "private, no-store, max-age=0",
            },
          },
        );
      } catch {
        return jsonError(
          "Existing client was found but billing details could not be loaded.",
          500,
        );
      }
    }
  }

  const {
    data:
      studioProfile,
    error:
      studioError,
  } =
    await admin
      .from(
        "studio_billing_profiles",
      )
      .select(
        "default_currency,default_payment_terms_days",
      )
      .eq(
        "created_by",
        user.id,
      )
      .maybeSingle();

  if (
    studioError ||
    !studioProfile
  ) {
    return jsonError(
      "Complete invoice setup before adding invoice clients.",
      409,
    );
  }

  const {
    data:
      client,
    error:
      clientError,
  } =
    await admin
      .from(
        "clients",
      )
      .insert({
        created_by:
          user.id,
        brand_name:
          brandName,
        contact_name:
          contactName ||
          null,
        email:
          email ||
          null,
        status:
          "active",
      })
      .select(
        "id,brand_name,contact_name,email,status",
      )
      .single();

  if (
    clientError ||
    !client
  ) {
    return jsonError(
      clientError?.message ||
        "Could not create client.",
      409,
    );
  }

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
      .insert({
        client_id:
          client.id,
        created_by:
          user.id,
        billing_name:
          contactName ||
          brandName,
        company_name:
          requestedBrand ||
          brandName,
        email,
        phone:
          "",
        address_line_1:
          "",
        address_line_2:
          "",
        city:
          "",
        region:
          "",
        postal_code:
          "",
        country:
          "",
        currency:
          studioProfile
            .default_currency,
        payment_terms_days:
          studioProfile
            .default_payment_terms_days,
        notes:
          "",
      })
      .select(
        "billing_name,company_name,email,phone,address_line_1,address_line_2,city,region,postal_code,country,currency,payment_terms_days,notes",
      )
      .single();

  if (
    billingError ||
    !billingProfile
  ) {
    await admin
      .from(
        "clients",
      )
      .delete()
      .eq(
        "id",
        client.id,
      )
      .eq(
        "created_by",
        user.id,
      );

    return jsonError(
      billingError?.message ||
        "Could not create client billing profile.",
      409,
    );
  }

  return Response.json(
    {
      client: {
        ...client,
        billingProfile,
      },
      reused:
        false,
    },
    {
      status:
        201,
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
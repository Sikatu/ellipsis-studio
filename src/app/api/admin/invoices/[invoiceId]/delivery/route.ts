import {
  createInvoiceDeliveryToken,
  hashInvoiceDeliveryToken,
  recordInvoiceDeliveryEvent,
} from "@/lib/server/invoice-delivery";
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

type DeliveryAction =
  | "activate"
  | "rotate"
  | "revoke";

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
        "Referrer-Policy":
          "no-referrer",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

function snapshotValue(
  snapshot: unknown,
  key: string,
) {
  if (
    !snapshot ||
    typeof snapshot !==
      "object" ||
    Array.isArray(
      snapshot,
    )
  ) {
    return "";
  }

  const value =
    (
      snapshot as
        Record<
          string,
          unknown
        >
    )[key];

  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function canShareInvoice(
  invoice: {
    status: string;
    final_pdf_bucket:
      string | null;
    final_pdf_path:
      string | null;
    final_pdf_sha256:
      string | null;
    final_pdf_bytes:
      number | null;
    final_pdf_created_at:
      string | null;
  },
) {
  return (
    (
      invoice.status ===
        "issued" ||
      invoice.status ===
        "paid"
    ) &&
    invoice.final_pdf_bucket ===
      "studio-invoices" &&
    Boolean(
      invoice.final_pdf_path &&
      invoice.final_pdf_sha256 &&
      invoice.final_pdf_bytes &&
      invoice.final_pdf_created_at,
    )
  );
}

async function ownedInvoice(
  admin:
    ReturnType<
      typeof createAdminClient
    >,
  userId: string,
  invoiceId: string,
) {
  return admin
    .from(
      "invoices",
    )
    .select(
      "id,created_by,invoice_number,status,client_snapshot,final_pdf_bucket,final_pdf_path,final_pdf_sha256,final_pdf_bytes,final_pdf_created_at",
    )
    .eq(
      "id",
      invoiceId,
    )
    .eq(
      "created_by",
      userId,
    )
    .maybeSingle();
}

async function accessState(
  admin:
    ReturnType<
      typeof createAdminClient
    >,
  userId: string,
  invoiceId: string,
) {
  return admin
    .from(
      "invoice_delivery_access",
    )
    .select(
      "id,invoice_id,status,token_version,expires_at,last_accessed_at,last_downloaded_at,created_at,rotated_at,revoked_at,updated_at",
    )
    .eq(
      "invoice_id",
      invoiceId,
    )
    .eq(
      "created_by",
      userId,
    )
    .maybeSingle();
}

async function responseState(
  admin:
    ReturnType<
      typeof createAdminClient
    >,
  userId: string,
  invoice: {
    id: string;
    invoice_number: string;
    status: string;
    client_snapshot: unknown;
    final_pdf_bucket:
      string | null;
    final_pdf_path:
      string | null;
    final_pdf_sha256:
      string | null;
    final_pdf_bytes:
      number | null;
    final_pdf_created_at:
      string | null;
  },
) {
  const {
    data: access,
    error:
      accessError,
  } =
    await accessState(
      admin,
      userId,
      invoice.id,
    );

  if (accessError) {
    throw new Error(
      accessError.message,
    );
  }

  let events:
    Array<
      Record<
        string,
        unknown
      >
    > =
      [];

  if (access) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "invoice_delivery_events",
        )
        .select(
          "id,event_type,actor_type,token_version,metadata,occurred_at,created_at",
        )
        .eq(
          "invoice_id",
          invoice.id,
        )
        .eq(
          "access_id",
          access.id,
        )
        .order(
          "occurred_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          50,
        );

    if (error) {
      throw new Error(
        error.message,
      );
    }

    events =
      data ?? [];
  }

  return {
    invoice: {
      id:
        invoice.id,
      invoiceNumber:
        invoice.invoice_number,
      status:
        invoice.status,
      shareable:
        canShareInvoice(
          invoice,
        ),
      recipientEmail:
        snapshotValue(
          invoice.client_snapshot,
          "email",
        ),
    },
    access:
      access ?? null,
    events,
  };
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params:
      Promise<{
        invoiceId: string;
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
    await params;

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
    data: invoice,
    error,
  } =
    await ownedInvoice(
      admin,
      user.id,
      invoiceId,
    );

  if (error) {
    return jsonError(
      error.message,
      500,
    );
  }

  if (!invoice) {
    return jsonError(
      "Invoice not found.",
      404,
    );
  }

  try {
    return Response.json(
      await responseState(
        admin,
        user.id,
        invoice,
      ),
      {
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
  } catch (
    stateError
  ) {
    return jsonError(
      stateError instanceof
        Error
        ? stateError.message
        : "Could not load invoice delivery.",
      500,
    );
  }
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params:
      Promise<{
        invoiceId: string;
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
    await params;

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

  let action:
    DeliveryAction;

  try {
    const body =
      await request.json() as {
        action?: unknown;
      };

    if (
      body.action !==
        "activate" &&
      body.action !==
        "rotate" &&
      body.action !==
        "revoke"
    ) {
      throw new Error(
        "Invalid action.",
      );
    }

    action =
      body.action;
  } catch {
    return jsonError(
      "Invalid delivery action.",
      400,
    );
  }

  const admin =
    createAdminClient();

  const [
    invoiceResult,
    accessResult,
  ] =
    await Promise.all([
      ownedInvoice(
        admin,
        user.id,
        invoiceId,
      ),
      accessState(
        admin,
        user.id,
        invoiceId,
      ),
    ]);

  if (
    invoiceResult.error ||
    accessResult.error
  ) {
    return jsonError(
      invoiceResult.error
        ?.message ||
      accessResult.error
        ?.message ||
      "Could not load invoice delivery.",
      500,
    );
  }

  const invoice =
    invoiceResult.data;

  const existing =
    accessResult.data;

  if (!invoice) {
    return jsonError(
      "Invoice not found.",
      404,
    );
  }

  if (
    action ===
      "revoke"
  ) {
    if (
      !existing ||
      existing.status !==
        "active"
    ) {
      return jsonError(
        "Secure invoice access is not active.",
        409,
      );
    }

    const {
      data: access,
      error,
    } =
      await admin
        .from(
          "invoice_delivery_access",
        )
        .update({
          status:
            "revoked",
          revoked_by:
            user.id,
          revoked_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          existing.id,
        )
        .eq(
          "created_by",
          user.id,
        )
        .eq(
          "status",
          "active",
        )
        .select(
          "id,invoice_id,status,token_version,expires_at,last_accessed_at,last_downloaded_at,created_at,rotated_at,revoked_at,updated_at",
        )
        .maybeSingle();

    if (
      error ||
      !access
    ) {
      return jsonError(
        error?.message ||
          "Could not revoke secure invoice access.",
        409,
      );
    }

    await recordInvoiceDeliveryEvent({
      invoiceId:
        invoice.id,
      accessId:
        access.id,
      eventType:
        "access_revoked",
      actorType:
        "admin",
      actorAdminId:
        user.id,
      tokenVersion:
        access.token_version,
      metadata: {
        invoiceNumber:
          invoice.invoice_number,
      },
    });

    return Response.json(
      {
        ...await responseState(
          admin,
          user.id,
          invoice,
        ),
        token:
          null,
        relativeUrl:
          null,
      },
      {
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
          "Referrer-Policy":
            "no-referrer",
        },
      },
    );
  }

  if (
    !canShareInvoice(
      invoice,
    )
  ) {
    return jsonError(
      "Issue the invoice before creating a secure client link.",
      409,
    );
  }

  if (
    action ===
      "activate" &&
    existing
  ) {
    return jsonError(
      existing.status ===
        "active"
        ? "Secure invoice access is already active. Rotate the link to replace it."
        : "Secure invoice access already exists. Create a new link by rotating it.",
      409,
    );
  }

  if (
    action ===
      "rotate" &&
    !existing
  ) {
    return jsonError(
      "Create secure invoice access before rotating its link.",
      409,
    );
  }

  const token =
    createInvoiceDeliveryToken();

  const tokenHash =
    hashInvoiceDeliveryToken(
      token,
    );

  let access;

  if (!existing) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "invoice_delivery_access",
        )
        .insert({
          invoice_id:
            invoice.id,
          token_hash:
            tokenHash,
          status:
            "active",
          created_by:
            user.id,
          rotated_by:
            user.id,
        })
        .select(
          "id,invoice_id,status,token_version,expires_at,last_accessed_at,last_downloaded_at,created_at,rotated_at,revoked_at,updated_at",
        )
        .single();

    if (
      error ||
      !data
    ) {
      return jsonError(
        error?.message ||
          "Could not create secure invoice access.",
        409,
      );
    }

    access =
      data;

    await recordInvoiceDeliveryEvent({
      invoiceId:
        invoice.id,
      accessId:
        access.id,
      eventType:
        "access_activated",
      actorType:
        "admin",
      actorAdminId:
        user.id,
      tokenVersion:
        access.token_version,
      metadata: {
        invoiceNumber:
          invoice.invoice_number,
      },
    });
  } else {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "invoice_delivery_access",
        )
        .update({
          token_hash:
            tokenHash,
          status:
            "active",
          rotated_by:
            user.id,
          revoked_by:
            null,
          revoked_at:
            null,
        })
        .eq(
          "id",
          existing.id,
        )
        .eq(
          "created_by",
          user.id,
        )
        .select(
          "id,invoice_id,status,token_version,expires_at,last_accessed_at,last_downloaded_at,created_at,rotated_at,revoked_at,updated_at",
        )
        .single();

    if (
      error ||
      !data
    ) {
      return jsonError(
        error?.message ||
          "Could not rotate secure invoice access.",
        409,
      );
    }

    access =
      data;

    await recordInvoiceDeliveryEvent({
      invoiceId:
        invoice.id,
      accessId:
        access.id,
      eventType:
        "link_rotated",
      actorType:
        "admin",
      actorAdminId:
        user.id,
      tokenVersion:
        access.token_version,
      metadata: {
        invoiceNumber:
          invoice.invoice_number,
      },
    });
  }

  return Response.json(
    {
      ...await responseState(
        admin,
        user.id,
        invoice,
      ),
      access,
      token,
      relativeUrl:
        `/invoice/${token}`,
    },
    {
      status:
        existing
          ? 200
          : 201,
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

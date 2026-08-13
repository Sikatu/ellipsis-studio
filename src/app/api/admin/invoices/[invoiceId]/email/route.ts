import {
  defaultInvoiceEmailTemplates,
  getInvoiceEmailProviderStatus,
  InvoiceEmailError,
  sendInvoiceEmail,
  validateInvoiceEmailTemplates,
  type InvoiceEmailPurpose,
} from "@/lib/server/invoice-email";
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

const requestIdPattern =
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
  code?:
    string,
) {
  return Response.json(
    {
      error:
        message,
      ...(code
        ? {
            code,
          }
        : {}),
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
    const expectedOrigin =
      configured
        ? new URL(
            configured,
          ).origin
        : new URL(
            request.url,
          ).origin;

    return (
      new URL(
        supplied,
      ).origin ===
      expectedOrigin
    );
  } catch {
    return false;
  }
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

function isoDateTime(
  value: unknown,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
      "string" ||
    value.length >
      80
  ) {
    return undefined;
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return undefined;
  }

  return date
    .toISOString();
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
      "id,created_by,invoice_number,status,invoice_date,due_date,currency,client_snapshot,sender_snapshot,total_cents,final_pdf_created_at",
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

async function workspaceState(
  admin:
    ReturnType<
      typeof createAdminClient
    >,
  userId: string,
  invoice: {
    id: string;
    invoice_number: string;
    status: string;
    invoice_date: string;
    due_date: string;
    currency: string;
    client_snapshot: unknown;
    sender_snapshot: unknown;
    total_cents: number;
    final_pdf_created_at:
      string | null;
  },
) {
  const [
    deliveriesResult,
    providerEventsResult,
    automationResult,
  ] =
    await Promise.all([
      admin
        .from(
          "invoice_email_deliveries",
        )
        .select(
          "id,invoice_id,access_id,purpose,trigger_type,recipient_email,subject,body_template,provider,provider_message_id,status,idempotency_key,token_version,attempted_at,sent_at,error_code,error_message,metadata,created_at,updated_at",
        )
        .eq(
          "invoice_id",
          invoice.id,
        )
        .eq(
          "created_by",
          userId,
        )
        .order(
          "attempted_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          50,
        ),

      admin
        .from(
          "invoice_email_provider_events",
        )
        .select(
          "id,delivery_id,invoice_id,provider,provider_message_id,event_type,event_created_at,detail,received_at",
        )
        .eq(
          "invoice_id",
          invoice.id,
        )
        .order(
          "event_created_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          250,
        ),

      admin
        .from(
          "invoice_email_automations",
        )
        .select(
          "invoice_id,enabled,send_at,subject_template,body_template,created_at,updated_at",
        )
        .eq(
          "invoice_id",
          invoice.id,
        )
        .eq(
          "created_by",
          userId,
        )
        .maybeSingle(),
    ]);

  if (
    deliveriesResult.error ||
    providerEventsResult.error ||
    automationResult.error
  ) {
    throw new Error(
      deliveriesResult.error
        ?.message ||
      providerEventsResult.error
        ?.message ||
      automationResult.error
        ?.message ||
      "Could not load invoice communication.",
    );
  }

  const templates =
    defaultInvoiceEmailTemplates();

  return {
    invoice: {
      id:
        invoice.id,
      invoiceNumber:
        invoice.invoice_number,
      status:
        invoice.status,
      invoiceDate:
        invoice.invoice_date,
      dueDate:
        invoice.due_date,
      currency:
        invoice.currency,
      totalCents:
        invoice.total_cents,
      clientName:
        snapshotValue(
          invoice.client_snapshot,
          "companyName",
        ) ||
        snapshotValue(
          invoice.client_snapshot,
          "billingName",
        ) ||
        "Client",
      recipientEmail:
        snapshotValue(
          invoice.client_snapshot,
          "email",
        ),
      studioName:
        snapshotValue(
          invoice.sender_snapshot,
          "businessName",
        ) ||
        snapshotValue(
          invoice.sender_snapshot,
          "displayName",
        ) ||
        "ELLIPSIS Studio",
      finalPdfReady:
        Boolean(
          invoice.final_pdf_created_at,
        ),
    },
    provider:
      getInvoiceEmailProviderStatus(),
    templates,
    deliveries:
      deliveriesResult.data ??
      [],
    providerEvents:
      providerEventsResult.data ??
      [],
    automation:
      automationResult.data ??
      null,
  };
}

async function loadOwnedWorkspace(
  userId: string,
  invoiceId: string,
) {
  const admin =
    createAdminClient();

  const {
    data: invoice,
    error,
  } =
    await ownedInvoice(
      admin,
      userId,
      invoiceId,
    );

  return {
    admin,
    invoice,
    error,
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

  const {
    admin,
    invoice,
    error,
  } =
    await loadOwnedWorkspace(
      user.id,
      invoiceId,
    );

  if (error) {
    return jsonError(
      "Could not load invoice communication.",
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
      await workspaceState(
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
        : "Could not load invoice communication.",
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

  if (
    !trustedRequestOrigin(
      request,
    )
  ) {
    return jsonError(
      "Invoice email request origin was rejected.",
      403,
      "request_origin_rejected",
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
      "Invalid email request.",
      400,
    );
  }

  const purpose =
    text(
      body.purpose,
      40,
    ) as
      InvoiceEmailPurpose;

  if (
    purpose !==
      "invoice" &&
    purpose !==
      "payment_reminder"
  ) {
    return jsonError(
      "Choose invoice email or payment reminder.",
      400,
    );
  }

  const requestId =
    text(
      body.requestId,
      36,
    );

  if (
    !requestIdPattern.test(
      requestId,
    )
  ) {
    return jsonError(
      "Invalid email request ID.",
      400,
    );
  }

  const subjectTemplate =
    text(
      body.subjectTemplate,
      500,
    );

  const bodyTemplate =
    text(
      body.bodyTemplate,
      10000,
    );

  const idempotencyKey =
    `manual/${invoiceId}/${purpose}/${requestId}`;

  try {
    const result =
      await sendInvoiceEmail({
        invoiceId,
        userId:
          user.id,
        purpose,
        triggerType:
          "manual",
        idempotencyKey,
        subjectTemplate,
        bodyTemplate,
      });

    const {
      admin,
      invoice,
      error,
    } =
      await loadOwnedWorkspace(
        user.id,
        invoiceId,
      );

    if (
      error ||
      !invoice
    ) {
      return jsonError(
        "Email was processed but invoice communication could not be reloaded.",
        500,
      );
    }

    return Response.json(
      {
        ...await workspaceState(
          admin,
          user.id,
          invoice,
        ),
        sendResult: {
          deliveryId:
            result.delivery.id,
          status:
            result.delivery.status,
          deduped:
            result.deduped,
        },
      },
      {
        status:
          result.deduped
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
  } catch (
    sendError
  ) {
    if (
      sendError instanceof
        InvoiceEmailError
    ) {
      return jsonError(
        sendError.message,
        sendError.status,
        sendError.code,
      );
    }

    return jsonError(
      "Invoice email could not be sent.",
      500,
    );
  }
}

export async function PUT(
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

  if (
    !trustedRequestOrigin(
      request,
    )
  ) {
    return jsonError(
      "Invoice automation request origin was rejected.",
      403,
      "request_origin_rejected",
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
      "Invalid automation request.",
      400,
    );
  }

  if (
    typeof body.enabled !==
      "boolean"
  ) {
    return jsonError(
      "Automation enabled state is required.",
      400,
    );
  }

  const enabled =
    body.enabled;

  const sendAt =
    isoDateTime(
      body.sendAt,
    );

  if (
    sendAt ===
      undefined
  ) {
    return jsonError(
      "Choose a valid reminder date and time.",
      400,
    );
  }

  const subjectTemplate =
    text(
      body.subjectTemplate,
      500,
    );

  const bodyTemplate =
    text(
      body.bodyTemplate,
      10000,
    );

  try {
    validateInvoiceEmailTemplates({
      subjectTemplate,
      bodyTemplate,
    });
  } catch (
    templateError
  ) {
    if (
      templateError instanceof
        InvoiceEmailError
    ) {
      return jsonError(
        templateError.message,
        templateError.status,
        templateError.code,
      );
    }

    return jsonError(
      "Invalid automatic reminder template.",
      400,
    );
  }

  const provider =
    getInvoiceEmailProviderStatus();

  if (
    enabled &&
    !provider.automationRunnerReady
  ) {
    return jsonError(
      "Automatic reminders are not ready on this server. Configure the email provider, public app URL, automation enable flag, and automation secret first.",
      503,
      "automation_runner_not_ready",
    );
  }

  const admin =
    createAdminClient();

  const {
    error:
      saveError,
  } =
    await admin.rpc(
      "save_invoice_email_automation",
      {
        p_invoice_id:
          invoiceId,
        p_created_by:
          user.id,
        p_enabled:
          enabled,
        p_send_at:
          sendAt,
        p_subject_template:
          subjectTemplate,
        p_body_template:
          bodyTemplate,
      },
    );

  if (saveError) {
    return jsonError(
      saveError.message ||
        "Could not save automatic reminder.",
      409,
    );
  }

  const {
    invoice,
    error,
  } =
    await loadOwnedWorkspace(
      user.id,
      invoiceId,
    );

  if (
    error ||
    !invoice
  ) {
    return jsonError(
      "Automation was saved but invoice communication could not be reloaded.",
      500,
    );
  }

  return Response.json(
    await workspaceState(
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
}

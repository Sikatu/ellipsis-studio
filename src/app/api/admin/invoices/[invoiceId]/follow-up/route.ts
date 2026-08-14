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

const eventTypes =
  new Set([
    "payment_reminder_sent",
    "client_reply",
    "payment_update",
    "note",
  ]);

const channels =
  new Set([
    "email",
    "message",
    "call",
    "other",
  ]);

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
    value.length > 80
  ) {
    return undefined;
  }

  const parsed =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return undefined;
  }

  return parsed
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
      "id,invoice_number,status,due_date,client_snapshot,paid_at,voided_at",
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
    due_date: string;
    client_snapshot: unknown;
    paid_at: string | null;
    voided_at: string | null;
  },
) {
  const [
    stateResult,
    communicationResult,
    deliveryResult,
  ] =
    await Promise.all([
      admin
        .from(
          "invoice_follow_up_states",
        )
        .select(
          "invoice_id,reminder_state,next_follow_up_at,internal_note,last_reminder_sent_at,created_at,updated_at",
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

      admin
        .from(
          "invoice_communication_events",
        )
        .select(
          "id,event_type,channel,summary,occurred_at,created_at",
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
          "occurred_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          100,
        ),

      admin
        .from(
          "invoice_delivery_access",
        )
        .select(
          "status,token_version,last_accessed_at,last_downloaded_at,created_at,rotated_at,revoked_at",
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
    stateResult.error ||
    communicationResult.error ||
    deliveryResult.error
  ) {
    throw new Error(
      stateResult.error
        ?.message ||
      communicationResult.error
        ?.message ||
      deliveryResult.error
        ?.message ||
      "Could not load follow-up operations.",
    );
  }

  const nextFollowUpAt =
    stateResult.data
      ?.next_follow_up_at ??
    null;

  const followUpDue =
    invoice.status ===
      "issued" &&
    Boolean(
      nextFollowUpAt,
    ) &&
    new Date(
      nextFollowUpAt as string,
    ).getTime() <=
      Date.now();

  return {
    invoice: {
      id:
        invoice.id,
      invoiceNumber:
        invoice.invoice_number,
      status:
        invoice.status,
      dueDate:
        invoice.due_date,
      paidAt:
        invoice.paid_at,
      voidedAt:
        invoice.voided_at,
      recipientEmail:
        snapshotValue(
          invoice.client_snapshot,
          "email",
        ),
    },
    followUp:
      stateResult.data ??
      null,
    followUpDue,
    communications:
      communicationResult.data ??
      [],
    delivery:
      deliveryResult.data ??
      null,
  };
}

async function loadOwnedState(
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

  if (error) {
    return {
      admin,
      invoice:
        null,
      error:
        error.message,
    };
  }

  if (!invoice) {
    return {
      admin,
      invoice:
        null,
      error:
        null,
    };
  }

  return {
    admin,
    invoice,
    error:
      null,
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
    await loadOwnedState(
      user.id,
      invoiceId,
    );

  if (error) {
    return jsonError(
      error,
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
        : "Could not load follow-up operations.",
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
      typeof parsed !==
        "object" ||
      parsed === null ||
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
      "Invalid follow-up request.",
      400,
    );
  }

  const nextFollowUpAt =
    isoDateTime(
      body.nextFollowUpAt,
    );

  if (
    nextFollowUpAt ===
      undefined
  ) {
    return jsonError(
      "Choose a valid follow-up date and time.",
      400,
    );
  }

  const internalNote =
    text(
      body.internalNote,
      10000,
    );

  const {
    admin,
    invoice,
    error,
  } =
    await loadOwnedState(
      user.id,
      invoiceId,
    );

  if (error) {
    return jsonError(
      error,
      500,
    );
  }

  if (!invoice) {
    return jsonError(
      "Invoice not found.",
      404,
    );
  }

  if (
    invoice.status !==
      "issued"
  ) {
    return jsonError(
      "Only issued invoices can schedule payment follow-up.",
      409,
    );
  }

  const {
    error:
      saveError,
  } =
    await admin.rpc(
      "save_invoice_follow_up",
      {
        p_invoice_id:
          invoice.id,
        p_created_by:
          user.id,
        p_next_follow_up_at:
          nextFollowUpAt,
        p_internal_note:
          internalNote,
      },
    );

  if (saveError) {
    return jsonError(
      saveError.message ||
        "Could not save payment follow-up.",
      409,
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
          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch {
    return jsonError(
      "Follow-up was saved but could not be reloaded.",
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

  let body:
    JsonObject;

  try {
    const parsed =
      await request.json();

    if (
      typeof parsed !==
        "object" ||
      parsed === null ||
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
      "Invalid communication request.",
      400,
    );
  }

  const eventType =
    text(
      body.eventType,
      80,
    );

  const channel =
    text(
      body.channel,
      40,
    );

  const summary =
    text(
      body.summary,
      5000,
    );

  if (
    !eventTypes.has(
      eventType,
    )
  ) {
    return jsonError(
      "Choose a valid communication type.",
      400,
    );
  }

  if (
    !channels.has(
      channel,
    )
  ) {
    return jsonError(
      "Choose a valid communication channel.",
      400,
    );
  }

  if (!summary) {
    return jsonError(
      "Add a short communication summary.",
      400,
    );
  }

  const {
    admin,
    invoice,
    error,
  } =
    await loadOwnedState(
      user.id,
      invoiceId,
    );

  if (error) {
    return jsonError(
      error,
      500,
    );
  }

  if (!invoice) {
    return jsonError(
      "Invoice not found.",
      404,
    );
  }

  if (
    invoice.status ===
      "draft"
  ) {
    return jsonError(
      "Issue the invoice before recording payment communication.",
      409,
    );
  }

  if (
    eventType ===
      "payment_reminder_sent" &&
    invoice.status !==
      "issued"
  ) {
    return jsonError(
      "Payment reminders can only be recorded for issued invoices.",
      409,
    );
  }

  const {
    error:
      recordError,
  } =
    await admin.rpc(
      "record_invoice_communication",
      {
        p_invoice_id:
          invoice.id,
        p_created_by:
          user.id,
        p_event_type:
          eventType,
        p_channel:
          channel,
        p_summary:
          summary,
        p_occurred_at:
          new Date()
            .toISOString(),
      },
    );

  if (recordError) {
    return jsonError(
      recordError.message ||
        "Could not record communication.",
      409,
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
        status:
          201,
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch {
    return jsonError(
      "Communication was recorded but could not be reloaded.",
      500,
    );
  }
}

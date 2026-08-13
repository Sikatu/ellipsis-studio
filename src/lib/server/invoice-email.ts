import "server-only";

import {
  createInvoiceDeliveryToken,
  hashInvoiceDeliveryToken,
  recordInvoiceDeliveryEvent,
} from "@/lib/server/invoice-delivery";
import {
  createAdminClient,
} from "@/lib/supabase/admin";

export type InvoiceEmailPurpose =
  | "invoice"
  | "payment_reminder";

export type InvoiceEmailTrigger =
  | "manual"
  | "scheduled";

export type InvoiceEmailMode =
  | "disabled"
  | "sandbox"
  | "live";

type InvoiceEmailRecord = {
  id: string;
  created_by: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date: string;
  currency: string;
  client_snapshot: unknown;
  sender_snapshot: unknown;
  total_cents: number;
  final_pdf_bucket: string | null;
  final_pdf_path: string | null;
  final_pdf_sha256: string | null;
  final_pdf_bytes: number | null;
  final_pdf_created_at: string | null;
};

type TemplateVariables = {
  invoice_number: string;
  client_name: string;
  studio_name: string;
  amount: string;
  invoice_date: string;
  due_date: string;
};

export const INVOICE_EMAIL_TEMPLATE_VARIABLES = [
  "{{invoice_number}}",
  "{{client_name}}",
  "{{studio_name}}",
  "{{amount}}",
  "{{invoice_date}}",
  "{{due_date}}",
  "{{secure_link}}",
] as const;

const emailPattern =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InvoiceEmailError extends Error {
  status: number;
  code: string;

  constructor(
    message: string,
    {
      status =
        409,
      code =
        "invoice_email_error",
    }: {
      status?: number;
      code?: string;
    } = {},
  ) {
    super(
      message,
    );

    this.name =
      "InvoiceEmailError";

    this.status =
      status;

    this.code =
      code;
  }
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

function validEmail(
  value: string,
) {
  return (
    value.length <=
      320 &&
    !/[\r\n]/.test(
      value,
    ) &&
    emailPattern.test(
      value,
    )
  );
}

function validProviderAddress(
  value: string,
) {
  if (
    !value ||
    value.length > 500 ||
    /[\r\n]/.test(
      value,
    )
  ) {
    return false;
  }

  const bracketed =
    value.match(
      /^.*<([^<>]+)>$/,
    );

  return validEmail(
    bracketed?.[1]
      ?.trim() ??
    value.trim(),
  );
}

function invoiceEmailMode(): InvoiceEmailMode {
  const value =
    (
      process.env
        .ELLIPSIS_INVOICE_EMAIL_MODE ??
      "disabled"
    )
      .trim()
      .toLowerCase();

  if (
    value === "sandbox" ||
    value === "live"
  ) {
    return value;
  }

  return "disabled";
}

function allowedSandboxRecipients() {
  return new Set(
    (
      process.env
        .ELLIPSIS_INVOICE_EMAIL_ALLOWED_RECIPIENTS ??
      ""
    )
      .split(",")
      .map(
        (value) =>
          value
            .trim()
            .toLowerCase(),
      )
      .filter(
        (value) =>
          validEmail(
            value,
          ),
      ),
  );
}

function normalizeBaseUrl(
  value: string,
  mode: InvoiceEmailMode,
) {
  const candidate =
    value
      .trim()
      .replace(
        /\/+$/,
        "",
      );

  if (!candidate) {
    return "";
  }

  try {
    const url =
      new URL(
        candidate,
      );

    const localSandbox =
      mode === "sandbox" &&
      url.protocol === "http:" &&
      [
        "localhost",
        "127.0.0.1",
        "::1",
      ].includes(
        url.hostname,
      );

    if (
      url.protocol !==
        "https:" &&
      !localSandbox
    ) {
      return "";
    }

    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (
        url.pathname !== "/" &&
        url.pathname !== ""
      )
    ) {
      return "";
    }

    return url.origin;
  } catch {
    return "";
  }
}

function envFlag(
  value: string | undefined,
) {
  return [
    "1",
    "true",
    "yes",
    "on",
  ].includes(
    (
      value ??
      ""
    )
      .trim()
      .toLowerCase(),
  );
}

export function getInvoiceEmailProviderStatus() {
  const mode =
    invoiceEmailMode();

  const provider =
    (
      process.env
        .ELLIPSIS_INVOICE_EMAIL_PROVIDER ??
      "resend"
    )
      .trim()
      .toLowerCase() ||
    "resend";

  const apiKey =
    (
      process.env
        .RESEND_API_KEY ??
      ""
    ).trim();

  const fromAddress =
    (
      process.env
        .ELLIPSIS_INVOICE_EMAIL_FROM ??
      ""
    ).trim();

  const publicAppUrl =
    normalizeBaseUrl(
      process.env
        .ELLIPSIS_PUBLIC_APP_URL ??
        "",
      mode,
    );

  const sandboxRecipients =
    allowedSandboxRecipients();

  const liveConfirmed =
    (
      process.env
        .ELLIPSIS_INVOICE_EMAIL_LIVE_CONFIRMATION ??
      ""
    ).trim() ===
    "I_UNDERSTAND_EMAILS_WILL_SEND";

  const automationEnabled =
    envFlag(
      process.env
        .ELLIPSIS_INVOICE_AUTOMATION_ENABLED,
    );

  const automationSecret =
    (
      process.env
        .CRON_SECRET ??
      process.env
        .ELLIPSIS_INVOICE_AUTOMATION_SECRET ??
      ""
    ).trim();

  const missingConfiguration:
    string[] =
      [];

  if (
    provider !==
      "resend"
  ) {
    missingConfiguration.push(
      "ELLIPSIS_INVOICE_EMAIL_PROVIDER=resend",
    );
  }

  if (!apiKey) {
    missingConfiguration.push(
      "RESEND_API_KEY",
    );
  }

  if (
    !validProviderAddress(
      fromAddress,
    )
  ) {
    missingConfiguration.push(
      "ELLIPSIS_INVOICE_EMAIL_FROM (valid mailbox)",
    );
  }

  if (!publicAppUrl) {
    missingConfiguration.push(
      mode === "live"
        ? "ELLIPSIS_PUBLIC_APP_URL=https://..."
        : "ELLIPSIS_PUBLIC_APP_URL",
    );
  }

  if (mode === "disabled") {
    missingConfiguration.push(
      "ELLIPSIS_INVOICE_EMAIL_MODE=sandbox|live",
    );
  }

  if (
    mode === "sandbox" &&
    sandboxRecipients.size === 0
  ) {
    missingConfiguration.push(
      "ELLIPSIS_INVOICE_EMAIL_ALLOWED_RECIPIENTS",
    );
  }

  if (
    mode === "live" &&
    !liveConfirmed
  ) {
    missingConfiguration.push(
      "ELLIPSIS_INVOICE_EMAIL_LIVE_CONFIRMATION",
    );
  }

  if (
    automationEnabled &&
    !automationSecret
  ) {
    missingConfiguration.push(
      "CRON_SECRET",
    );
  }

  const providerConfigured =
    provider === "resend" &&
    Boolean(
      apiKey &&
      validProviderAddress(
        fromAddress,
      ),
    );

  const sendingEnabled =
    providerConfigured &&
    Boolean(
      publicAppUrl,
    ) &&
    (
      (
        mode === "sandbox" &&
        sandboxRecipients.size > 0
      ) ||
      (
        mode === "live" &&
        liveConfirmed
      )
    );

  return {
    mode,
    provider,
    configured:
      providerConfigured,
    sendingEnabled,
    missingConfiguration,
    publicAppUrlConfigured:
      Boolean(
        publicAppUrl,
      ),
    automationEnabled,
    automationRunnerReady:
      sendingEnabled &&
      Boolean(
        automationEnabled &&
        automationSecret,
      ),
  };
}

function providerSecrets() {
  const status =
    getInvoiceEmailProviderStatus();

  if (
    !status.sendingEnabled
  ) {
    throw new InvoiceEmailError(
      `Invoice email sending is locked. Missing: ${status.missingConfiguration.join(", ") || "approved email configuration"}.`,
      {
        status:
          503,
        code:
          "provider_not_configured",
      },
    );
  }

  return {
    provider:
      status.provider,
    mode:
      status.mode,
    allowedRecipients:
      allowedSandboxRecipients(),
    apiKey:
      (
        process.env
          .RESEND_API_KEY ??
        ""
      ).trim(),
    fromAddress:
      (
        process.env
          .ELLIPSIS_INVOICE_EMAIL_FROM ??
        ""
      ).trim(),
    replyToOverride:
      (
        process.env
          .ELLIPSIS_INVOICE_REPLY_TO ??
        ""
      ).trim(),
    publicAppUrl:
      normalizeBaseUrl(
        process.env
          .ELLIPSIS_PUBLIC_APP_URL ??
          "",
        status.mode,
      ),
  };
}

function money(
  cents: number,
  currency: string,
) {
  try {
    return new Intl.NumberFormat(
      "en-US",
      {
        style:
          "currency",
        currency,
      },
    ).format(
      cents /
        100,
    );
  } catch {
    return `${currency} ${(
      cents /
      100
    ).toFixed(
      2,
    )}`;
  }
}

function formatDate(
  value: string,
) {
  const date =
    new Date(
      `${value}T00:00:00Z`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      year:
        "numeric",
      month:
        "short",
      day:
        "numeric",
      timeZone:
        "UTC",
    },
  ).format(
    date,
  );
}

function templateVariables(
  invoice:
    InvoiceEmailRecord,
): TemplateVariables {
  return {
    invoice_number:
      invoice.invoice_number,
    client_name:
      snapshotValue(
        invoice.client_snapshot,
        "companyName",
      ) ||
      snapshotValue(
        invoice.client_snapshot,
        "billingName",
      ) ||
      "Client",
    studio_name:
      snapshotValue(
        invoice.sender_snapshot,
        "businessName",
      ) ||
      snapshotValue(
        invoice.sender_snapshot,
        "displayName",
      ) ||
      "ELLIPSIS Studio",
    amount:
      money(
        invoice.total_cents,
        invoice.currency,
      ),
    invoice_date:
      formatDate(
        invoice.invoice_date,
      ),
    due_date:
      formatDate(
        invoice.due_date,
      ),
  };
}

export function defaultInvoiceEmailTemplates() {
  return {
    invoice: {
      subject:
        "Invoice {{invoice_number}} from {{studio_name}}",
      body:
        [
          "Hello {{client_name}},",
          "",
          "Your invoice {{invoice_number}} for {{amount}} is ready.",
          "",
          "Review your invoice securely:",
          "{{secure_link}}",
          "",
          "Due date: {{due_date}}",
          "",
          "Thank you,",
          "{{studio_name}}",
        ].join(
          "\n",
        ),
    },
    paymentReminder: {
      subject:
        "Payment reminder - {{invoice_number}}",
      body:
        [
          "Hello {{client_name}},",
          "",
          "A quick reminder that invoice {{invoice_number}} for {{amount}} is due on {{due_date}}.",
          "",
          "Review your invoice securely:",
          "{{secure_link}}",
          "",
          "Thank you,",
          "{{studio_name}}",
        ].join(
          "\n",
        ),
    },
  };
}

function renderTemplate(
  template: string,
  variables:
    TemplateVariables,
  secureUrl: string,
) {
  let output =
    template;

  const values:
    Record<
      string,
      string
    > = {
      invoice_number:
        variables.invoice_number,
      client_name:
        variables.client_name,
      studio_name:
        variables.studio_name,
      amount:
        variables.amount,
      invoice_date:
        variables.invoice_date,
      due_date:
        variables.due_date,
      secure_link:
        secureUrl,
    };

  for (
    const [
      key,
      value,
    ] of Object.entries(
      values,
    )
  ) {
    output =
      output.replaceAll(
        `{{${key}}}`,
        value,
      );
  }

  return output;
}

export function validateInvoiceEmailTemplates({
  subjectTemplate,
  bodyTemplate,
}: {
  subjectTemplate:
    string;
  bodyTemplate:
    string;
}) {
  const subject =
    text(
      subjectTemplate,
      500,
    );

  const body =
    text(
      bodyTemplate,
      10000,
    );

  if (
    !subject ||
    subject.length >
      500 ||
    /[\r\n]/.test(
      subject,
    )
  ) {
    throw new InvoiceEmailError(
      "Email subject must be a single line between 1 and 500 characters.",
      {
        status:
          400,
        code:
          "invalid_subject",
      },
    );
  }

  if (
    subject.includes(
      "{{secure_link}}",
    )
  ) {
    throw new InvoiceEmailError(
      "The secure invoice link cannot be placed in the email subject.",
      {
        status:
          400,
        code:
          "secure_link_in_subject",
      },
    );
  }

  if (!body) {
    throw new InvoiceEmailError(
      "Add an email message before sending.",
      {
        status:
          400,
        code:
          "invalid_body",
      },
    );
  }

  if (
    !body.includes(
      "{{secure_link}}",
    )
  ) {
    throw new InvoiceEmailError(
      "The email message must include {{secure_link}} so the client can open the invoice.",
      {
        status:
          400,
        code:
          "secure_link_missing",
      },
    );
  }

  return {
    subject,
    body,
  };
}

function escapeHtml(
  value: string,
) {
  return value
    .replaceAll(
      "&",
      "&amp;",
    )
    .replaceAll(
      "<",
      "&lt;",
    )
    .replaceAll(
      ">",
      "&gt;",
    )
    .replaceAll(
      '"',
      "&quot;",
    )
    .replaceAll(
      "'",
      "&#039;",
    );
}

function textEmailHtml(
  renderedText: string,
  secureUrl: string,
) {
  const escapedUrl =
    escapeHtml(
      secureUrl,
    );

  const link =
    `<a href="${escapedUrl}" style="color:#8b6f49;text-decoration:underline;">${escapedUrl}</a>`;

  const content =
    escapeHtml(
      renderedText,
    )
      .replaceAll(
        escapedUrl,
        link,
      )
      .replaceAll(
        "\n",
        "<br />",
      );

  return [
    '<div style="background:#f4f0e8;color:#11110f;font-family:Arial,Helvetica,sans-serif;padding:32px;line-height:1.65;">',
    '<div style="max-width:640px;margin:0 auto;">',
    '<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8b6f49;margin-bottom:24px;">ELLIPSIS Studio</div>',
    `<div style="font-size:15px;">${content}</div>`,
    '<div style="margin-top:32px;border-top:1px solid rgba(17,17,15,0.14);padding-top:16px;font-size:11px;color:rgba(17,17,15,0.55);">This secure invoice link may be replaced when a new invoice email is sent.</div>',
    "</div>",
    "</div>",
  ].join(
    "",
  );
}

async function loadOwnedInvoice(
  invoiceId: string,
  userId: string,
) {
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
        "id,created_by,invoice_number,status,invoice_date,due_date,currency,client_snapshot,sender_snapshot,total_cents,final_pdf_bucket,final_pdf_path,final_pdf_sha256,final_pdf_bytes,final_pdf_created_at",
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

  if (error) {
    throw new InvoiceEmailError(
      "Could not load invoice email context.",
      {
        status:
          500,
        code:
          "invoice_lookup_failed",
      },
    );
  }

  if (!data) {
    throw new InvoiceEmailError(
      "Invoice not found.",
      {
        status:
          404,
        code:
          "invoice_not_found",
      },
    );
  }

  return data as
    InvoiceEmailRecord;
}

async function ensureFreshSecureLink(
  invoice:
    InvoiceEmailRecord,
) {
  const admin =
    createAdminClient();

  const {
    data: existing,
    error:
      accessError,
  } =
    await admin
      .from(
        "invoice_delivery_access",
      )
      .select(
        "id,status,token_version",
      )
      .eq(
        "invoice_id",
        invoice.id,
      )
      .eq(
        "created_by",
        invoice.created_by,
      )
      .maybeSingle();

  if (accessError) {
    throw new InvoiceEmailError(
      "Could not load secure invoice access.",
      {
        status:
          500,
        code:
          "delivery_lookup_failed",
      },
    );
  }

  const token =
    createInvoiceDeliveryToken();

  const tokenHash =
    hashInvoiceDeliveryToken(
      token,
    );

  if (!existing) {
    const {
      data: access,
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
            invoice.created_by,
          rotated_by:
            invoice.created_by,
        })
        .select(
          "id,status,token_version",
        )
        .single();

    if (
      error ||
      !access
    ) {
      throw new InvoiceEmailError(
        error?.message ||
          "Could not create secure invoice access.",
        {
          status:
            409,
          code:
            "delivery_create_failed",
        },
      );
    }

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
        invoice.created_by,
      tokenVersion:
        access.token_version,
      metadata: {
        invoiceNumber:
          invoice.invoice_number,
        reason:
          "invoice_email",
      },
    });

    return {
      access,
      token,
      rotated:
        false,
    };
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
        token_hash:
          tokenHash,
        status:
          "active",
        rotated_by:
          invoice.created_by,
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
        invoice.created_by,
      )
      .select(
        "id,status,token_version",
      )
      .single();

  if (
    error ||
    !access
  ) {
    throw new InvoiceEmailError(
      error?.message ||
        "Could not refresh secure invoice access.",
      {
        status:
          409,
        code:
          "delivery_rotate_failed",
      },
    );
  }

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
      invoice.created_by,
    tokenVersion:
      access.token_version,
    metadata: {
      invoiceNumber:
        invoice.invoice_number,
      reason:
        "invoice_email",
    },
  });

  return {
    access,
    token,
    rotated:
      true,
  };
}

async function sendWithResend({
  apiKey,
  fromAddress,
  replyTo,
  recipient,
  subject,
  textBody,
  htmlBody,
  idempotencyKey,
}: {
  apiKey: string;
  fromAddress: string;
  replyTo:
    string | null;
  recipient: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  idempotencyKey: string;
}) {
  let response:
    Response;

  try {
    response =
      await fetch(
        "https://api.resend.com/emails",
        {
          method:
            "POST",
          headers: {
            Authorization:
              `Bearer ${apiKey}`,
            "Content-Type":
              "application/json",
            "Idempotency-Key":
              idempotencyKey,
          },
          body:
            JSON.stringify({
              from:
                fromAddress,
              to: [
                recipient,
              ],
              subject,
              text:
                textBody,
              html:
                htmlBody,
              ...(replyTo
                ? {
                    reply_to:
                      replyTo,
                  }
                : {}),
            }),
        },
      );
  } catch {
    throw new InvoiceEmailError(
      "Email provider could not be reached.",
      {
        status:
          502,
        code:
          "provider_unreachable",
      },
    );
  }

  const payload =
    await response
      .json()
      .catch(
        () => null,
      ) as
      | {
          id?: unknown;
          name?: unknown;
          message?: unknown;
        }
      | null;

  if (!response.ok) {
    throw new InvoiceEmailError(
      typeof payload?.message ===
        "string"
        ? payload.message
        : "Email provider rejected the send request.",
      {
        status:
          502,
        code:
          typeof payload?.name ===
            "string"
            ? payload.name.slice(
                0,
                160,
              )
            : `provider_http_${response.status}`,
      },
    );
  }

  if (
    typeof payload?.id !==
      "string" ||
    !payload.id.trim()
  ) {
    throw new InvoiceEmailError(
      "Email provider returned an invalid message ID.",
      {
        status:
          502,
        code:
          "provider_invalid_response",
      },
    );
  }

  return payload.id.trim();
}

async function markDeliveryFailed({
  deliveryId,
  code,
  message,
}: {
  deliveryId: string;
  code: string;
  message: string;
}) {
  const admin =
    createAdminClient();

  await admin
    .from(
      "invoice_email_deliveries",
    )
    .update({
      status:
        "failed",
      error_code:
        code.slice(
          0,
          160,
        ),
      error_message:
        message.slice(
          0,
          5000,
        ),
      updated_at:
        new Date()
          .toISOString(),
    })
    .eq(
      "id",
      deliveryId,
    )
    .eq(
      "status",
      "attempting",
    );
}

export async function sendInvoiceEmail({
  invoiceId,
  userId,
  purpose,
  triggerType,
  idempotencyKey,
  subjectTemplate,
  bodyTemplate,
}: {
  invoiceId: string;
  userId: string;
  purpose:
    InvoiceEmailPurpose;
  triggerType:
    InvoiceEmailTrigger;
  idempotencyKey: string;
  subjectTemplate: string;
  bodyTemplate: string;
}) {
  if (
    !uuidPattern.test(
      invoiceId,
    )
  ) {
    throw new InvoiceEmailError(
      "Invalid invoice.",
      {
        status:
          400,
        code:
          "invalid_invoice_id",
      },
    );
  }

  const cleanIdempotencyKey =
    text(
      idempotencyKey,
      256,
    );

  if (
    !cleanIdempotencyKey
  ) {
    throw new InvoiceEmailError(
      "Email request ID is missing.",
      {
        status:
          400,
        code:
          "missing_idempotency_key",
      },
    );
  }

  const templates =
    validateInvoiceEmailTemplates({
      subjectTemplate,
      bodyTemplate,
    });

  const provider =
    providerSecrets();

  const admin =
    createAdminClient();

  const {
    data:
      existingAttempt,
    error:
      existingError,
  } =
    await admin
      .from(
        "invoice_email_deliveries",
      )
      .select(
        "id,status,provider_message_id,error_code,error_message,sent_at",
      )
      .eq(
        "idempotency_key",
        cleanIdempotencyKey,
      )
      .maybeSingle();

  if (existingError) {
    throw new InvoiceEmailError(
      "Could not verify email request idempotency.",
      {
        status:
          500,
        code:
          "idempotency_lookup_failed",
      },
    );
  }

  if (existingAttempt) {
    if (
      existingAttempt.status ===
        "sent"
    ) {
      return {
        delivery:
          existingAttempt,
        deduped:
          true,
      };
    }

    throw new InvoiceEmailError(
      existingAttempt.error_message ||
        "This email request was already attempted.",
      {
        status:
          409,
        code:
          existingAttempt.error_code ||
          "duplicate_email_request",
      },
    );
  }

  const invoice =
    await loadOwnedInvoice(
      invoiceId,
      userId,
    );

  if (
    invoice.status !==
      "issued"
  ) {
    throw new InvoiceEmailError(
      "Invoice emails and payment reminders can be sent only while the invoice is issued and unpaid.",
      {
        status:
          409,
        code:
          "invoice_not_issued",
      },
    );
  }

  if (
    invoice.final_pdf_bucket !==
      "studio-invoices" ||
    !invoice.final_pdf_path ||
    !invoice.final_pdf_sha256 ||
    !invoice.final_pdf_bytes ||
    !invoice.final_pdf_created_at
  ) {
    throw new InvoiceEmailError(
      "The immutable issued PDF is not ready for secure delivery.",
      {
        status:
          409,
        code:
          "final_pdf_missing",
      },
    );
  }

  const recipient =
    snapshotValue(
      invoice.client_snapshot,
      "email",
    );

  if (
    !validEmail(
      recipient,
    )
  ) {
    throw new InvoiceEmailError(
      "Add a valid billing email to the invoice before sending.",
      {
        status:
          409,
        code:
          "recipient_email_invalid",
      },
    );
  }

  if (
    provider.mode ===
      "sandbox" &&
    !provider.allowedRecipients
      .has(
        recipient
          .toLowerCase(),
      )
  ) {
    throw new InvoiceEmailError(
      "Sandbox email is locked to the explicitly allowed test recipients.",
      {
        status:
          403,
        code:
          "sandbox_recipient_blocked",
      },
    );
  }

  const baseUrl =
    provider.publicAppUrl;

  if (!baseUrl) {
    throw new InvoiceEmailError(
      "A valid public application URL is required before sending invoice email.",
      {
        status:
          503,
        code:
          "public_app_url_missing",
      },
    );
  }

  const secure =
    await ensureFreshSecureLink(
      invoice,
    );

  const secureUrl =
    `${baseUrl}/invoice/${secure.token}`;

  const variables =
    templateVariables(
      invoice,
    );

  const subject =
    renderTemplate(
      templates.subject,
      variables,
      "",
    );

  const renderedBody =
    renderTemplate(
      templates.body,
      variables,
      secureUrl,
    );

  const replyToCandidate =
    provider.replyToOverride ||
    snapshotValue(
      invoice.sender_snapshot,
      "email",
    );

  const replyTo =
    validEmail(
      replyToCandidate,
    )
      ? replyToCandidate
      : null;

  const {
    data: attempt,
    error:
      attemptError,
  } =
    await admin
      .from(
        "invoice_email_deliveries",
      )
      .insert({
        invoice_id:
          invoice.id,
        access_id:
          secure.access.id,
        created_by:
          userId,
        purpose,
        trigger_type:
          triggerType,
        recipient_email:
          recipient,
        subject,
        body_template:
          templates.body,
        provider:
          provider.provider,
        status:
          "attempting",
        idempotency_key:
          cleanIdempotencyKey,
        token_version:
          secure.access.token_version,
        metadata: {
          invoiceNumber:
            invoice.invoice_number,
          clientName:
            variables.client_name,
          studioName:
            variables.studio_name,
          amount:
            variables.amount,
          dueDate:
            variables.due_date,
          secureLinkRedacted:
            true,
          linkRotated:
            secure.rotated,
        },
      })
      .select(
        "id,invoice_id,access_id,purpose,trigger_type,recipient_email,subject,body_template,provider,provider_message_id,status,idempotency_key,token_version,attempted_at,sent_at,error_code,error_message,metadata,created_at,updated_at",
      )
      .single();

  if (
    attemptError ||
    !attempt
  ) {
    throw new InvoiceEmailError(
      attemptError?.message ||
        "Could not create the email delivery audit record.",
      {
        status:
          409,
        code:
          "delivery_audit_create_failed",
      },
    );
  }

  const {
    data:
      currentInvoice,
    error:
      currentError,
  } =
    await admin
      .from(
        "invoices",
      )
      .select(
        "status",
      )
      .eq(
        "id",
        invoice.id,
      )
      .eq(
        "created_by",
        userId,
      )
      .maybeSingle();

  if (
    currentError ||
    !currentInvoice ||
    currentInvoice.status !==
      "issued"
  ) {
    await markDeliveryFailed({
      deliveryId:
        attempt.id,
      code:
        "invoice_closed_before_send",
      message:
        "Invoice was no longer issued immediately before the provider request.",
    });

    throw new InvoiceEmailError(
      "Invoice changed status before the email could be sent.",
      {
        status:
          409,
        code:
          "invoice_closed_before_send",
      },
    );
  }

  let providerMessageId:
    string;

  try {
    providerMessageId =
      await sendWithResend({
        apiKey:
          provider.apiKey,
        fromAddress:
          provider.fromAddress,
        replyTo,
        recipient,
        subject,
        textBody:
          renderedBody,
        htmlBody:
          textEmailHtml(
            renderedBody,
            secureUrl,
          ),
        idempotencyKey:
          cleanIdempotencyKey,
      });
  } catch (
    sendError
  ) {
    const normalized =
      sendError instanceof
        InvoiceEmailError
        ? sendError
        : new InvoiceEmailError(
            "Email provider request failed.",
            {
              status:
                502,
              code:
                "provider_request_failed",
            },
          );

    await markDeliveryFailed({
      deliveryId:
        attempt.id,
      code:
        normalized.code,
      message:
        normalized.message,
    });

    throw normalized;
  }

  const sentAt =
    new Date()
      .toISOString();

  const {
    data: delivery,
    error:
      sentError,
  } =
    await admin
      .from(
        "invoice_email_deliveries",
      )
      .update({
        status:
          "sent",
        provider_message_id:
          providerMessageId,
        sent_at:
          sentAt,
        error_code:
          null,
        error_message:
          null,
        updated_at:
          sentAt,
      })
      .eq(
        "id",
        attempt.id,
      )
      .eq(
        "status",
        "attempting",
      )
      .select(
        "id,invoice_id,access_id,purpose,trigger_type,recipient_email,subject,body_template,provider,provider_message_id,status,idempotency_key,token_version,attempted_at,sent_at,error_code,error_message,metadata,created_at,updated_at",
      )
      .maybeSingle();

  if (
    sentError ||
    !delivery
  ) {
    throw new InvoiceEmailError(
      "Email provider accepted the message, but ELLIPSIS could not finalize the delivery audit. Do not resend until the provider log is checked.",
      {
        status:
          503,
        code:
          "delivery_audit_finalize_failed",
      },
    );
  }

  if (
    purpose ===
      "payment_reminder"
  ) {
    const {
      error:
        communicationError,
    } =
      await admin.rpc(
        "record_invoice_communication",
        {
          p_invoice_id:
            invoice.id,
          p_created_by:
            userId,
          p_event_type:
            "payment_reminder_sent",
          p_channel:
            "email",
          p_summary:
            `Payment reminder emailed to ${recipient}.`,
          p_occurred_at:
            sentAt,
        },
      );

    if (communicationError) {
      console.error(
        "Invoice reminder was sent but S9 communication history could not be updated:",
        communicationError,
      );
    }
  }

  return {
    delivery,
    deduped:
      false,
  };
}

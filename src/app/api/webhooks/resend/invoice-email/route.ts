import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const maxBodyBytes =
  256 * 1024;

const timestampToleranceSeconds =
  5 * 60;

const supportedEventTypes =
  new Set([
    "email.sent",
    "email.delivered",
    "email.delivery_delayed",
    "email.bounced",
    "email.failed",
  ]);

type JsonObject =
  Record<
    string,
    unknown
  >;

function asObject(
  value: unknown,
): JsonObject | null {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value,
    )
  ) {
    return null;
  }

  return value as
    JsonObject;
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

function response(
  body:
    JsonObject,
  status = 200,
) {
  return Response.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
        "Referrer-Policy":
          "no-referrer",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

function webhookSecretBytes() {
  const configured =
    (
      process.env
        .RESEND_WEBHOOK_SECRET ??
      ""
    ).trim();

  if (!configured) {
    return null;
  }

  const encoded =
    configured.startsWith(
      "whsec_",
    )
      ? configured.slice(
          "whsec_".length,
        )
      : configured;

  if (!encoded) {
    return null;
  }

  try {
    const normalized =
      encoded
        .replaceAll(
          "-",
          "+",
        )
        .replaceAll(
          "_",
          "/",
        );

    const secret =
      Buffer.from(
        normalized,
        "base64",
      );

    return secret.length >=
      16
      ? secret
      : null;
  } catch {
    return null;
  }
}

function verifyWebhook({
  request,
  rawBody,
}: {
  request: Request;
  rawBody: string;
}) {
  const secret =
    webhookSecretBytes();

  if (!secret) {
    return {
      ok:
        false as const,
      status:
        503,
      reason:
        "RESEND_WEBHOOK_SECRET is not configured.",
    };
  }

  const svixId =
    text(
      request.headers.get(
        "svix-id",
      ),
      256,
    );

  const timestampText =
    text(
      request.headers.get(
        "svix-timestamp",
      ),
      32,
    );

  const signatureHeader =
    text(
      request.headers.get(
        "svix-signature",
      ),
      4096,
    );

  if (
    !svixId ||
    !timestampText ||
    !signatureHeader
  ) {
    return {
      ok:
        false as const,
      status:
        400,
      reason:
        "Missing Resend webhook signature headers.",
    };
  }

  const timestamp =
    Number(
      timestampText,
    );

  if (
    !Number.isInteger(
      timestamp,
    ) ||
    timestamp <=
      0
  ) {
    return {
      ok:
        false as const,
      status:
        400,
      reason:
        "Invalid Resend webhook timestamp.",
    };
  }

  const now =
    Math.floor(
      Date.now() /
        1000,
    );

  if (
    Math.abs(
      now -
        timestamp,
    ) >
    timestampToleranceSeconds
  ) {
    return {
      ok:
        false as const,
      status:
        400,
      reason:
        "Expired Resend webhook timestamp.",
    };
  }

  const signedContent =
    `${svixId}.${timestampText}.${rawBody}`;

  const expected =
    createHmac(
      "sha256",
      secret,
    )
      .update(
        signedContent,
        "utf8",
      )
      .digest();

  const candidates =
    signatureHeader
      .split(
        /\s+/,
      )
      .filter(
        Boolean,
      );

  const valid =
    candidates.some(
      (
        candidate,
      ) => {
        const comma =
          candidate.indexOf(
            ",",
          );

        if (
          comma <=
            0 ||
          candidate.slice(
            0,
            comma,
          ) !==
            "v1"
        ) {
          return false;
        }

        const encoded =
          candidate.slice(
            comma +
              1,
          );

        try {
          const supplied =
            Buffer.from(
              encoded,
              "base64",
            );

          return (
            supplied.length ===
              expected.length &&
            timingSafeEqual(
              supplied,
              expected,
            )
          );
        } catch {
          return false;
        }
      },
    );

  if (!valid) {
    return {
      ok:
        false as const,
      status:
        400,
      reason:
        "Invalid Resend webhook signature.",
    };
  }

  return {
    ok:
      true as const,
    svixId,
  };
}

function eventDate(
  value: unknown,
) {
  const candidate =
    text(
      value,
      80,
    );

  if (!candidate) {
    return null;
  }

  const date =
    new Date(
      candidate,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date
    .toISOString();
}

function eventDetail(
  eventType: string,
  data:
    JsonObject,
) {
  const detail:
    JsonObject = {};

  if (
    eventType ===
      "email.bounced"
  ) {
    const bounce =
      asObject(
        data.bounce,
      );

    if (bounce) {
      const type =
        text(
          bounce.type,
          120,
        );

      const subType =
        text(
          bounce.subType,
          120,
        );

      const message =
        text(
          bounce.message,
          1000,
        );

      if (type) {
        detail.type =
          type;
      }

      if (subType) {
        detail.subType =
          subType;
      }

      if (message) {
        detail.message =
          message;
      }
    }
  }

  if (
    eventType ===
      "email.failed"
  ) {
    const failed =
      asObject(
        data.failed,
      );

    const reason =
      text(
        failed
          ?.reason,
        500,
      );

    if (reason) {
      detail.reason =
        reason;
    }
  }

  return detail;
}

export async function POST(
  request: Request,
) {
  const contentLength =
    Number(
      request.headers.get(
        "content-length",
      ) ??
        "0",
    );

  if (
    Number.isFinite(
      contentLength,
    ) &&
    contentLength >
      maxBodyBytes
  ) {
    return response(
      {
        error:
          "Webhook payload is too large.",
      },
      413,
    );
  }

  const rawBody =
    await request.text();

  if (
    Buffer.byteLength(
      rawBody,
      "utf8",
    ) >
    maxBodyBytes
  ) {
    return response(
      {
        error:
          "Webhook payload is too large.",
      },
      413,
    );
  }

  const verification =
    verifyWebhook({
      request,
      rawBody,
    });

  if (
    !verification.ok
  ) {
    return response(
      {
        error:
          verification.reason,
      },
      verification.status,
    );
  }

  let payload:
    JsonObject;

  try {
    const parsed =
      JSON.parse(
        rawBody,
      );

    const object =
      asObject(
        parsed,
      );

    if (!object) {
      throw new Error(
        "Invalid payload.",
      );
    }

    payload =
      object;
  } catch {
    return response(
      {
        error:
          "Invalid Resend webhook JSON.",
      },
      400,
    );
  }

  const eventType =
    text(
      payload.type,
      80,
    );

  if (
    !supportedEventTypes.has(
      eventType,
    )
  ) {
    return response({
      ok:
        true,
      ignored:
        true,
      reason:
        "event_not_tracked",
    });
  }

  const data =
    asObject(
      payload.data,
    );

  if (!data) {
    return response(
      {
        error:
          "Resend webhook data is missing.",
      },
      400,
    );
  }

  const providerMessageId =
    text(
      data.email_id,
      256,
    );

  if (!providerMessageId) {
    return response(
      {
        error:
          "Resend email ID is missing.",
      },
      400,
    );
  }

  const createdAt =
    eventDate(
      payload.created_at,
    );

  if (!createdAt) {
    return response(
      {
        error:
          "Resend event timestamp is invalid.",
      },
      400,
    );
  }

  const admin =
    createAdminClient();

  const {
    data:
      delivery,
    error:
      deliveryError,
  } =
    await admin
      .from(
        "invoice_email_deliveries",
      )
      .select(
        "id,invoice_id,provider,provider_message_id",
      )
      .eq(
        "provider",
        "resend",
      )
      .eq(
        "provider_message_id",
        providerMessageId,
      )
      .maybeSingle();

  if (deliveryError) {
    console.error(
      "Could not match Resend webhook to invoice delivery:",
      deliveryError,
    );

    return response(
      {
        error:
          "Could not match provider event.",
      },
      500,
    );
  }

  if (!delivery) {
    return response({
      ok:
        true,
      ignored:
        true,
      reason:
        "not_an_invoice_email",
    });
  }

  const {
    error:
      insertError,
  } =
    await admin
      .from(
        "invoice_email_provider_events",
      )
      .insert({
        delivery_id:
          delivery.id,
        invoice_id:
          delivery.invoice_id,
        provider:
          "resend",
        provider_message_id:
          providerMessageId,
        svix_id:
          verification.svixId,
        event_type:
          eventType,
        event_created_at:
          createdAt,
        detail:
          eventDetail(
            eventType,
            data,
          ),
      });

  if (
    insertError?.code ===
      "23505"
  ) {
    return response({
      ok:
        true,
      duplicate:
        true,
    });
  }

  if (insertError) {
    console.error(
      "Could not record invoice email provider event:",
      insertError,
    );

    return response(
      {
        error:
          "Could not record provider event.",
      },
      500,
    );
  }

  return response(
    {
      ok:
        true,
      recorded:
        true,
      eventType,
    },
    201,
  );
}
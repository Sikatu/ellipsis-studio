import {
  timingSafeEqual,
} from "node:crypto";

import {
  getInvoiceEmailProviderStatus,
  InvoiceEmailError,
  sendInvoiceEmail,
} from "@/lib/server/invoice-email";
import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function safeEqual(
  left: string,
  right: string,
) {
  const leftBuffer =
    Buffer.from(
      left,
      "utf8",
    );

  const rightBuffer =
    Buffer.from(
      right,
      "utf8",
    );

  if (
    leftBuffer.length !==
      rightBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    leftBuffer,
    rightBuffer,
  );
}

function authorized(
  request: Request,
) {
  const expected =
    (
      process.env
        .CRON_SECRET ??
      process.env
        .ELLIPSIS_INVOICE_AUTOMATION_SECRET ??
      ""
    ).trim();

  if (!expected) {
    return false;
  }

  const authorization =
    request.headers
      .get(
        "authorization",
      ) ??
    "";

  const prefix =
    "Bearer ";

  if (
    !authorization.startsWith(
      prefix,
    )
  ) {
    return false;
  }

  const supplied =
    authorization
      .slice(
        prefix.length,
      )
      .trim();

  return (
    Boolean(
      supplied,
    ) &&
    safeEqual(
      supplied,
      expected,
    )
  );
}

function json(
  body: unknown,
  status =
    200,
) {
  return Response.json(
    body,
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

async function runReminderAutomation(
  request: Request,
) {
  if (
    !authorized(
      request,
    )
  ) {
    return json(
      {
        error:
          "Unauthorized",
      },
      401,
    );
  }

  const provider =
    getInvoiceEmailProviderStatus();

  if (
    !provider.automationEnabled
  ) {
    return json(
      {
        error:
          "Invoice reminder automation is disabled on this server.",
      },
      503,
    );
  }

  if (
    !provider.automationRunnerReady
  ) {
    return json(
      {
        error:
          "Invoice reminder automation is not fully configured.",
        missingConfiguration:
          provider.missingConfiguration,
        publicAppUrlConfigured:
          provider.publicAppUrlConfigured,
      },
      503,
    );
  }

  const admin =
    createAdminClient();

  const now =
    new Date()
      .toISOString();

  const {
    data: due,
    error:
      dueError,
  } =
    await admin
      .from(
        "invoice_email_automations",
      )
      .select(
        "invoice_id,created_by,send_at,subject_template,body_template",
      )
      .eq(
        "enabled",
        true,
      )
      .lte(
        "send_at",
        now,
      )
      .order(
        "send_at",
        {
          ascending:
            true,
        },
      )
      .limit(
        25,
      );

  if (dueError) {
    return json(
      {
        error:
          "Could not load due invoice reminders.",
      },
      500,
    );
  }

  const results:
    Array<{
      invoiceId: string;
      outcome:
        "sent" |
        "failed" |
        "skipped";
      detail?: string;
    }> =
      [];

  for (
    const item of due ??
    []
  ) {
    if (
      !item.send_at
    ) {
      results.push({
        invoiceId:
          item.invoice_id,
        outcome:
          "skipped",
        detail:
          "Missing scheduled time.",
      });

      continue;
    }

    const {
      data:
        claimed,
      error:
        claimError,
    } =
      await admin.rpc(
        "claim_due_invoice_email_automation",
        {
          p_invoice_id:
            item.invoice_id,
          p_created_by:
            item.created_by,
          p_expected_send_at:
            item.send_at,
        },
      );

    if (
      claimError ||
      claimed !==
        true
    ) {
      results.push({
        invoiceId:
          item.invoice_id,
        outcome:
          "skipped",
        detail:
          claimError
            ?.message ||
          "No longer due.",
      });

      continue;
    }

    const idempotencyKey =
      `scheduled/${item.invoice_id}/${item.send_at}`;

    try {
      const result =
        await sendInvoiceEmail({
          invoiceId:
            item.invoice_id,
          userId:
            item.created_by,
          purpose:
            "payment_reminder",
          triggerType:
            "scheduled",
          idempotencyKey,
          subjectTemplate:
            item.subject_template,
          bodyTemplate:
            item.body_template,
        });

      results.push({
        invoiceId:
          item.invoice_id,
        outcome:
          "sent",
        detail:
          result.deduped
            ? "Already processed."
            : "Payment reminder sent.",
      });
    } catch (
      sendError
    ) {
      results.push({
        invoiceId:
          item.invoice_id,
        outcome:
          "failed",
        detail:
          sendError instanceof
            InvoiceEmailError
            ? `${sendError.code}: ${sendError.message}`
            : "Unexpected send failure.",
      });
    }
  }

  const sent =
    results.filter(
      (
        item,
      ) =>
        item.outcome ===
          "sent",
    ).length;

  const failed =
    results.filter(
      (
        item,
      ) =>
        item.outcome ===
          "failed",
    ).length;

  const skipped =
    results.filter(
      (
        item,
      ) =>
        item.outcome ===
          "skipped",
    ).length;

  return json({
    checked:
      due?.length ??
      0,
    sent,
    failed,
    skipped,
    results,
  });
}
export async function GET(
  request: Request,
) {
  return runReminderAutomation(
    request,
  );
}
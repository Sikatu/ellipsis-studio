import {
  timingSafeEqual,
} from "node:crypto";

import {
  getInvoiceEmailProviderStatus,
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
  status = 200,
) {
  return Response.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
        "Referrer-Policy":
          "no-referrer",
        "X-Content-Type-Options":
          "nosniff",
        "X-Robots-Tag":
          "noindex",
      },
    },
  );
}

export async function GET(
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

  const admin =
    createAdminClient();

  const {
    error:
      databaseError,
  } =
    await admin
      .from(
        "invoices",
      )
      .select(
        "id",
        {
          count:
            "exact",
          head:
            true,
        },
      );

  const {
    data:
      invoiceBucket,
    error:
      bucketError,
  } =
    await admin.storage
      .getBucket(
        "studio-invoices",
      );

  const databaseReady =
    !databaseError;

  const invoiceStorageReady =
    !bucketError &&
    invoiceBucket
      ?.name ===
      "studio-invoices";

  const runtimeReady =
    provider.sendingEnabled &&
    provider.webhookConfigured &&
    provider.automationRunnerReady &&
    databaseReady &&
    invoiceStorageReady;

  return json(
    {
      ok:
        runtimeReady,
      environment:
        provider.deploymentEnvironment,
      email: {
        mode:
          provider.mode,
        provider:
          provider.provider,
        configured:
          provider.configured,
        sendingEnabled:
          provider.sendingEnabled,
        publicAppUrlConfigured:
          provider.publicAppUrlConfigured,
        liveDeploymentAllowed:
          provider.liveDeploymentAllowed,
        webhookConfigured:
          provider.webhookConfigured,
      },
      automation: {
        enabled:
          provider.automationEnabled,
        secretConfigured:
          provider.automationSecretConfigured,
        runnerReady:
          provider.automationRunnerReady,
        schedule:
          "0 0 * * *",
        automaticOnThisDeployment:
          provider.deploymentEnvironment ===
            "production",
      },
      storage: {
        databaseReady,
        invoiceBucketReady:
          invoiceStorageReady,
      },
      productionLaunchReady:
        provider.productionLaunchReady &&
        databaseReady &&
        invoiceStorageReady,
      missingConfiguration:
        provider.missingConfiguration,
    },
    runtimeReady
      ? 200
      : 503,
  );
}
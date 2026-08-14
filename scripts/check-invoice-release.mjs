import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const checks = [];

function read(relativePath) {
  return fs.readFileSync(
    path.join(
      root,
      relativePath,
    ),
    "utf8",
  ).replace(
    /\r\n/g,
    "\n",
  );
}

function exists(relativePath) {
  return fs.existsSync(
    path.join(
      root,
      relativePath,
    ),
  );
}

function check(label, condition) {
  if (!condition) {
    throw new Error(
      `Invoice release audit failed: ${label}`,
    );
  }

  checks.push(
    label,
  );
}

const packageJson =
  JSON.parse(
    read(
      "package.json",
    ),
  );

const vercel =
  JSON.parse(
    read(
      "vercel.json",
    ),
  );

const runner =
  read(
    "src/app/api/internal/invoice-reminders/run/route.ts",
  );

const email =
  read(
    "src/lib/server/invoice-email.ts",
  );

const webhook =
  read(
    "src/app/api/webhooks/resend/invoice-email/route.ts",
  );

const readiness =
  read(
    "src/app/api/internal/invoice-readiness/route.ts",
  );

const nextConfig =
  read(
    "next.config.ts",
  );

check(
  "audit command is registered",
  packageJson.scripts
    ?.["audit:invoice-release"] ===
    "node scripts/check-invoice-release.mjs",
);

check(
  "daily invoice Cron is registered",
  Array.isArray(
    vercel.crons,
  ) &&
  vercel.crons.some(
    (item) =>
      item.path ===
        "/api/internal/invoice-reminders/run" &&
      item.schedule ===
        "0 0 * * *",
  ),
);

check(
  "Cron uses timing-safe authentication",
  runner.includes(
    "timingSafeEqual",
  ),
);

check(
  "Cron authorizes before provider state",
  runner.indexOf(
    "!authorized(",
  ) <
  runner.indexOf(
    "getInvoiceEmailProviderStatus",
    runner.indexOf(
      "async function runReminderAutomation",
    ),
  ),
);

check(
  "Cron exposes GET",
  runner.includes(
    "export async function GET(",
  ),
);

check(
  "Cron does not expose POST",
  !runner.includes(
    "export async function POST(",
  ),
);

check(
  "Resend API uses provider idempotency",
  email.includes(
    '"Idempotency-Key"',
  ),
);

check(
  "Resend API has a bounded timeout",
  email.includes(
    "AbortSignal.timeout(",
  ) &&
  email.includes(
    "15_000",
  ),
);

check(
  "live email is gated to production",
  email.includes(
    "liveDeploymentAllowed",
  ) &&
  /environment\s*===\s*"production"/.test(
    email,
  ),
);

check(
  "live production email requires canonical public origin",
  email.includes(
    "canonicalProductionAppUrl",
  ) &&
  email.includes(
    "https://ellipsissmp.com",
  ) &&
  email.includes(
    "livePublicAppUrlAllowed",
  ),
);

check(
  "webhook readiness validates signing secret",
  email.includes(
    "function webhookSecretConfigured()",
  ) &&
  email.includes(
    ".RESEND_WEBHOOK_SECRET",
  ) &&
  email.includes(
    '"base64"',
  ) &&
  email.includes(
    "secret.length >=",
  ),
);

check(
  "readiness exposes canonical public origin status",
  readiness.includes(
    "livePublicAppUrlAllowed",
  ),
);

check(
  "readiness endpoint is authenticated",
  readiness.includes(
    "timingSafeEqual",
  ) &&
  readiness.includes(
    "CRON_SECRET",
  ),
);

check(
  "readiness endpoint checks database and invoice storage",
  readiness.includes(
    "databaseReady",
  ) &&
  readiness.includes(
    "invoiceBucketReady",
  ),
);

check(
  "Resend webhook verifies Svix signatures",
  webhook.includes(
    '"svix-id"',
  ) &&
  webhook.includes(
    '"svix-signature"',
  ) &&
  webhook.includes(
    "timingSafeEqual",
  ),
);

check(
  "Resend webhook deduplicates retries",
  webhook.includes(
    'insertError?.code ===\n      "23505"',
  ),
);

check(
  "global clickjacking protection is configured",
  nextConfig.includes(
    '"X-Frame-Options"',
  ) &&
  nextConfig.includes(
    '"DENY"',
  ),
);

check(
  "global MIME sniffing protection is configured",
  nextConfig.includes(
    '"X-Content-Type-Options"',
  ) &&
  nextConfig.includes(
    '"nosniff"',
  ),
);

check(
  "historical realtime migration is present",
  exists(
    "supabase/migrations/20260810135800_enable_realtime_discovery_projects.sql",
  ),
);

check(
  "provider event migration matches applied Supabase version",
  exists(
    "supabase/migrations/20260813151242_add_invoice_email_provider_events.sql",
  ),
);

check(
  "stale provider event migration version is absent",
  !exists(
    "supabase/migrations/20260813144500_add_invoice_email_provider_events.sql",
  ),
);

check(
  "release index migration matches applied Supabase version",
  exists(
    "supabase/migrations/20260813194046_harden_invoice_release_indexes.sql",
  ),
);

console.log(
  `Invoice release audit passed (${checks.length} checks).`,
);
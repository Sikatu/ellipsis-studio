# ELLIPSIS Invoice Production Readiness

This document is the release checklist for the invoice subsystem.

## Deployment model

- Preview deployments use `ELLIPSIS_INVOICE_EMAIL_MODE=sandbox`.
- Live invoice email is intentionally blocked unless the runtime deployment environment is `production`.
- Vercel Cron invokes only Production deployments.
- The configured invoice Cron is `0 0 * * *` and calls `/api/internal/invoice-reminders/run`.
- `CRON_SECRET` authenticates both the Cron runner and the internal readiness endpoint.
- Preview Cron behavior is tested manually. Automatic scheduling begins only after a Production deployment.

## Required Production environment variables

Set these in Vercel Production. Do not commit real secret values.

- `ELLIPSIS_INVOICE_EMAIL_MODE=live`
- `ELLIPSIS_INVOICE_EMAIL_PROVIDER=resend`
- `ELLIPSIS_INVOICE_EMAIL_FROM=ELLIPSIS Studio <billing@invoices.ellipsissmp.com>`
- `ELLIPSIS_PUBLIC_APP_URL=https://<production-host>`
- `ELLIPSIS_INVOICE_EMAIL_LIVE_CONFIRMATION=I_UNDERSTAND_EMAILS_WILL_SEND`
- `ELLIPSIS_INVOICE_AUTOMATION_ENABLED=true`
- `CRON_SECRET=<random secret, at least 16 characters>`
- `RESEND_API_KEY=<secret>`
- `RESEND_WEBHOOK_SECRET=<secret>`
- `ELLIPSIS_INVOICE_REPLY_TO=<optional valid reply mailbox>`

`ELLIPSIS_INVOICE_EMAIL_ALLOWED_RECIPIENTS` is a Sandbox control and is not required in live mode.

## Runtime readiness probe

Authenticated route:

`GET /api/internal/invoice-readiness`

Header:

`Authorization: Bearer <CRON_SECRET>`

The response does not expose secret values. It checks:

- invoice email provider configuration
- live-deployment safety gate
- Resend webhook-secret presence
- automatic reminder configuration
- database connectivity
- `studio-invoices` storage bucket
- whether the current deployment is Production-ready

## Release audit

Run:

`npm run audit:invoice-release`

Then run:

`npm run lint`

`npm run build`

The static audit verifies the security-critical source invariants and migration filenames.

## Database migration history

The repository intentionally contains these applied Supabase versions:

- `20260810135800_enable_realtime_discovery_projects.sql`
- `20260813151242_add_invoice_email_provider_events.sql`
- `20260813194046_harden_invoice_release_indexes.sql`

Do not rename these timestamps without repairing Supabase migration history.

## Webhook requirements

The Resend webhook must remain configured for:

- `email.sent`
- `email.delivered`
- `email.delivery_delayed`
- `email.bounced`
- `email.failed`

The handler verifies the raw-body Svix signature and deduplicates on `svix-id`.

## Before Production launch

1. Enable Supabase Auth leaked-password protection.
2. Add/verify all Production environment variables.
3. Create a Production Resend webhook pointing at the Production invoice webhook route.
4. Deploy the merged branch to Vercel Production.
5. Call `/api/internal/invoice-readiness` with `CRON_SECRET`.
6. Require `productionLaunchReady: true`.
7. Send one controlled real invoice and verify `email.sent` and `email.delivered`.
8. Schedule one controlled automatic reminder and verify the Production Cron path.
9. Confirm no secrets are present in logs, Git history, screenshots, or invoice audit metadata.

## Current Vercel behavior reference

Vercel Cron documentation states that Cron Jobs run on Production deployments, use HTTP GET, and send `CRON_SECRET` as a Bearer Authorization header. Hobby scheduling is limited to once per day with hourly-level execution precision.

References:
- https://vercel.com/docs/cron-jobs
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
- https://vercel.com/docs/cron-jobs/usage-and-pricing
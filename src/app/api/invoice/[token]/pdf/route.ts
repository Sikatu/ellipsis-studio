import {
  createHash,
} from "node:crypto";

import {
  invoicePdfFilename,
  type InvoicePdfRow,
} from "@/lib/server/invoice-pdf";
import {
  loadInvoiceDeliveryPortal,
  recordInvoiceDeliveryEvent,
} from "@/lib/server/invoice-delivery";
import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function errorResponse(
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

function pdfResponse(
  bytes: Uint8Array,
  filename: string,
) {
  const body =
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset +
        bytes.byteLength,
    ) as ArrayBuffer;

  return new Response(
    body,
    {
      status:
        200,
      headers: {
        "Content-Type":
          "application/pdf",
        "Content-Disposition":
          `attachment; filename="${filename}"`,
        "Content-Length":
          String(
            bytes.byteLength,
          ),
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

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params:
      Promise<{
        token: string;
      }>;
  },
) {
  const {
    token,
  } =
    await params;

  const portal =
    await loadInvoiceDeliveryPortal(
      token,
      {
        touchAccess:
          false,
      },
    );

  if (!portal) {
    return errorResponse(
      "Invoice link is unavailable.",
      404,
    );
  }

  const {
    invoice,
  } =
    portal;

  const admin =
    createAdminClient();

  const {
    data: storedPdf,
    error:
      downloadError,
  } =
    await admin.storage
      .from(
        invoice.final_pdf_bucket,
      )
      .download(
        invoice.final_pdf_path,
      );

  if (
    downloadError ||
    !storedPdf
  ) {
    return errorResponse(
      "Invoice PDF could not be loaded.",
      500,
    );
  }

  const bytes =
    new Uint8Array(
      await storedPdf.arrayBuffer(),
    );

  if (
    bytes.byteLength !==
      Number(
        invoice.final_pdf_bytes,
      )
  ) {
    return errorResponse(
      "Invoice PDF size verification failed.",
      409,
    );
  }

  const sha256 =
    createHash(
      "sha256",
    )
      .update(
        bytes,
      )
      .digest(
        "hex",
      );

  if (
    sha256 !==
      invoice.final_pdf_sha256
  ) {
    return errorResponse(
      "Invoice PDF integrity verification failed.",
      409,
    );
  }

  const downloadedAt =
    new Date()
      .toISOString();

  const {
    error:
      touchError,
  } =
    await admin
      .from(
        "invoice_delivery_access",
      )
      .update({
        last_downloaded_at:
          downloadedAt,
      })
      .eq(
        "id",
        portal.accessId,
      )
      .eq(
        "status",
        "active",
      );

  if (touchError) {
    console.error(
      "Invoice delivery download touch failed:",
      touchError,
    );
  }

  await recordInvoiceDeliveryEvent({
    invoiceId:
      invoice.id,
    accessId:
      portal.accessId,
    eventType:
      "pdf_downloaded",
    actorType:
      "client",
    tokenVersion:
      portal.tokenVersion,
    metadata: {
      invoiceNumber:
        invoice.invoice_number,
      bytes:
        bytes.byteLength,
    },
  });

  return pdfResponse(
    bytes,
    invoicePdfFilename(
      invoice as
        InvoicePdfRow,
    ),
  );
}

import {
  createHash,
} from "node:crypto";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  invoicePdfFilename,
  renderInvoicePdf,
  type InvoicePdfItem,
  type InvoicePdfRow,
} from "@/lib/server/invoice-pdf";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

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
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

export async function GET(
  _request:
    Request,
  context: {
    params:
      Promise<{
        invoiceId:
          string;
      }>;
  },
) {
  const user =
    await authenticatedAdmin();

  if (!user) {
    return errorResponse(
      "Unauthorized",
      401,
    );
  }

  const {
    invoiceId,
  } =
    await context.params;

  if (
    !/^[0-9a-f-]{36}$/i.test(
      invoiceId,
    )
  ) {
    return errorResponse(
      "Invalid invoice.",
      400,
    );
  }

  const admin =
    createAdminClient();

  const {
    data: invoice,
    error: invoiceError,
  } =
    await admin
      .from(
        "invoices",
      )
      .select(
        "id,invoice_number,status,invoice_date,due_date,currency,sender_snapshot,client_snapshot,payment_instructions_snapshot,notes,subtotal_cents,discount_cents,tax_cents,adjustment_cents,total_cents,final_pdf_bucket,final_pdf_path,final_pdf_sha256,final_pdf_bytes,final_pdf_created_at",
      )
      .eq(
        "id",
        invoiceId,
      )
      .eq(
        "created_by",
        user.id,
      )
      .maybeSingle();

  if (invoiceError) {
    return errorResponse(
      invoiceError.message,
      500,
    );
  }

  if (!invoice) {
    return errorResponse(
      "Invoice not found.",
      404,
    );
  }

  if (
    invoice.status !==
      "draft"
  ) {
    if (
      !invoice.final_pdf_bucket ||
      !invoice.final_pdf_path ||
      !invoice.final_pdf_sha256 ||
      !invoice.final_pdf_bytes ||
      !invoice.final_pdf_created_at
    ) {
      return errorResponse(
        "Final invoice PDF metadata is incomplete.",
        409,
      );
    }

    const {
      data: storedPdf,
      error: downloadError,
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
        downloadError?.message ??
          "Final invoice PDF could not be loaded.",
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
        "Final invoice PDF size verification failed.",
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
        "Final invoice PDF integrity verification failed.",
        409,
      );
    }

    return pdfResponse(
      bytes,
      invoicePdfFilename(
        invoice as
          InvoicePdfRow,
      ),
    );
  }

  const {
    data: items,
    error: itemError,
  } =
    await admin
      .from(
        "invoice_items",
      )
      .select(
        "id,sort_order,description,quantity,unit_label,unit_rate_cents,amount_cents,notes,created_at",
      )
      .eq(
        "invoice_id",
        invoice.id,
      )
      .eq(
        "created_by",
        user.id,
      )
      .order(
        "sort_order",
        {
          ascending:
            true,
        },
      )
      .order(
        "created_at",
        {
          ascending:
            true,
        },
      );

  if (itemError) {
    return errorResponse(
      itemError.message,
      500,
    );
  }

  if (
    !items ||
    items.length === 0
  ) {
    return errorResponse(
      "This invoice has no work items.",
      409,
    );
  }

  try {
    const {
      buffer,
      filename,
    } =
      await renderInvoicePdf(
        invoice as
          InvoicePdfRow,
        items as
          InvoicePdfItem[],
      );

    return pdfResponse(
      new Uint8Array(
        buffer,
      ),
      filename,
    );
  } catch (error) {
    console.error(
      "Invoice PDF generation failed",
      {
        invoiceId,
        error:
          error instanceof Error
            ? error.message
            : "Unknown PDF error",
      },
    );

    return errorResponse(
      "Could not generate the invoice PDF.",
      500,
    );
  }
}

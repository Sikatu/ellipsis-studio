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
  renderInvoicePdf,
  type InvoicePdfItem,
  type InvoicePdfRow,
} from "@/lib/server/invoice-pdf";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const invoiceBucket =
  "studio-invoices";

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
      },
    },
  );
}

function objectValue(
  value: unknown,
) {
  if (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(
      value,
    )
  ) {
    return value as
      Record<
        string,
        unknown
      >;
  }

  return {};
}

function textValue(
  value: unknown,
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

export async function POST(
  _request: Request,
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
    return jsonError(
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
    return jsonError(
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
        "id,created_by,client_id,invoice_number,status,invoice_date,due_date,currency,sender_snapshot,client_snapshot,payment_instructions_snapshot,notes,subtotal_cents,discount_cents,tax_cents,adjustment_cents,total_cents,issued_at,paid_at,voided_at,final_pdf_bucket,final_pdf_path,final_pdf_sha256,final_pdf_bytes,final_pdf_created_at,created_at,updated_at",
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
    return jsonError(
      invoiceError.message,
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
      "issued" ||
    invoice.status ===
      "paid"
  ) {
    return Response.json(
      {
        invoice,
        alreadyIssued:
          true,
      },
      {
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      },
    );
  }

  if (
    invoice.status !==
      "draft"
  ) {
    return jsonError(
      "Only draft invoices can be issued.",
      409,
    );
  }

  const sender =
    objectValue(
      invoice.sender_snapshot,
    );

  const client =
    objectValue(
      invoice.client_snapshot,
    );

  const senderName =
    textValue(
      sender.businessName,
    ) ||
    textValue(
      sender.displayName,
    );

  const clientName =
    textValue(
      client.billingName,
    ) ||
    textValue(
      client.companyName,
    );

  if (!senderName) {
    return jsonError(
      "Your sender details are incomplete.",
      409,
    );
  }

  if (!clientName) {
    return jsonError(
      "Client billing details are incomplete.",
      409,
    );
  }

  if (
    Number(
      invoice.total_cents,
    ) <= 0
  ) {
    return jsonError(
      "Invoice total must be greater than zero before issuing.",
      409,
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
    return jsonError(
      itemError.message,
      500,
    );
  }

  if (
    !items ||
    items.length === 0
  ) {
    return jsonError(
      "Add at least one work item before issuing.",
      409,
    );
  }

  try {
    const issuedPdfInvoice = {
      ...invoice,
      status:
        "issued",
    } as InvoicePdfRow;

    const {
      buffer,
      filename,
    } =
      await renderInvoicePdf(
        issuedPdfInvoice,
        items as
          InvoicePdfItem[],
      );

    const bytes =
      new Uint8Array(
        buffer,
      );

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

    const path =
      `${user.id}/${invoice.id}/${filename}`;

    const {
      error: uploadError,
    } =
      await admin.storage
        .from(
          invoiceBucket,
        )
        .upload(
          path,
          bytes,
          {
            contentType:
              "application/pdf",
            cacheControl:
              "0",
            upsert:
              false,
          },
        );

    if (uploadError) {
      return jsonError(
        `Could not store the final invoice PDF: ${uploadError.message}`,
        409,
      );
    }

    const createdAt =
      new Date()
        .toISOString();

    const {
      data: issuedInvoice,
      error: updateError,
    } =
      await admin
        .from(
          "invoices",
        )
        .update({
          status:
            "issued",
          final_pdf_bucket:
            invoiceBucket,
          final_pdf_path:
            path,
          final_pdf_sha256:
            sha256,
          final_pdf_bytes:
            bytes.byteLength,
          final_pdf_created_at:
            createdAt,
        })
        .eq(
          "id",
          invoice.id,
        )
        .eq(
          "created_by",
          user.id,
        )
        .eq(
          "status",
          "draft",
        )
        .select(
          "id,client_id,invoice_number,status,invoice_date,due_date,currency,subtotal_cents,discount_cents,tax_cents,adjustment_cents,total_cents,issued_at,paid_at,voided_at,final_pdf_created_at,created_at",
        )
        .maybeSingle();

    if (
      updateError ||
      !issuedInvoice
    ) {
      await admin.storage
        .from(
          invoiceBucket,
        )
        .remove([
          path,
        ]);

      return jsonError(
        updateError?.message ??
          "Invoice changed before it could be issued. Please refresh and try again.",
        409,
      );
    }

    return Response.json(
      {
        invoice:
          issuedInvoice,
      },
      {
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error(
      "Invoice issue failed",
      {
        invoiceId,
        error:
          error instanceof Error
            ? error.message
            : "Unknown issue error",
      },
    );

    return jsonError(
      "Could not issue the invoice.",
      500,
    );
  }
}

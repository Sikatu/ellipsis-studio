import {
  createHash,
} from "node:crypto";

import type {
  NextRequest,
} from "next/server";

import {
  loadDeliveryPortal,
} from "@/lib/delivery-portal";

import {
  recordDeliveryEvent,
} from "@/lib/delivery-audit";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

        "Referrer-Policy":
          "no-referrer",
      },
    },
  );
}

function sha256Hex(
  bytes: Uint8Array,
) {
  return createHash(
    "sha256",
  )
    .update(
      bytes,
    )
    .digest(
      "hex",
    );
}

export async function GET(
  request: NextRequest,
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

  const fileId =
    request.nextUrl
      .searchParams
      .get(
        "fileId",
      ) ?? "";

  if (
    !uuidPattern.test(
      fileId,
    )
  ) {
    return jsonError(
      "Deliverable not found.",
      404,
    );
  }

  let portal;

  try {
    portal =
      await loadDeliveryPortal(
        token,
      );
  }
  catch {
    return jsonError(
      "Deliverable not found.",
      404,
    );
  }

  if (!portal) {
    return jsonError(
      "Deliverable not found.",
      404,
    );
  }

  const deliverable =
    portal.deliverables
      .find(
        (item) =>
          item.fileId ===
          fileId,
      );

  if (!deliverable) {
    return jsonError(
      "Deliverable not found.",
      404,
    );
  }

  const admin =
    createAdminClient();

  const {
    data: storedFile,
    error:
      downloadError,
  } =
    await admin.storage
      .from(
        deliverable
          .storageBucket,
      )
      .download(
        deliverable
          .storagePath,
      );

  if (
    downloadError ||
    !storedFile
  ) {
    return jsonError(
      "Deliverable is temporarily unavailable.",
      409,
    );
  }

  const bytes =
    new Uint8Array(
      await storedFile
        .arrayBuffer(),
    );

  const actualSha256 =
    sha256Hex(
      bytes,
    );

  if (
    actualSha256 !==
    deliverable.sha256
  ) {
    return jsonError(
      "Deliverable integrity verification failed.",
      409,
    );
  }

  const timestamp =
    new Date()
      .toISOString();

  await admin
    .from(
      "client_delivery_access",
    )
    .update({
      last_accessed_at:
        timestamp,

      last_downloaded_at:
        timestamp,
    })
    .eq(
      "id",
      portal.accessId,
    );

  await recordDeliveryEvent({
    projectId:
      portal.projectId,

    accessId:
      portal.accessId,

    eventType:
      "file_downloaded",

    actorType:
      "client",

    fileId:
      deliverable.fileId,

    reportId:
      deliverable.reportId,

    tokenVersion:
      portal.tokenVersion,

    metadata: {
      filename:
        deliverable.filename,

      reportNumber:
        deliverable.reportNumber,
    },
  });

  return new Response(
    bytes,
    {
      status:
        200,

      headers: {
        "Content-Type":
          "application/pdf",

        "Content-Disposition":
          `attachment; filename="${deliverable.filename}"`,

        "Content-Length":
          String(
            bytes.byteLength,
          ),

        "Cache-Control":
          "private, no-store, max-age=0",

        "Pragma":
          "no-cache",

        "Referrer-Policy":
          "no-referrer",

        "X-Content-Type-Options":
          "nosniff",

        "X-Robots-Tag":
          "noindex, nofollow, noarchive",

        "X-ELLIPSIS-SHA256":
          deliverable.sha256,
      },
    },
  );
}
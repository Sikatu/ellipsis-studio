import "server-only";

import {
  randomUUID,
} from "node:crypto";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  uuidPattern,
} from "@/lib/server/project-work";


export const PROJECT_DELIVERABLE_BUCKET =
  "studio-project-deliverables";

export const MAX_PROJECT_DELIVERABLE_BYTES =
  50 * 1024 * 1024;


export const deliverableSourceKinds =
  new Set([
    "file",
    "external_url",
  ]);


export const deliverableReviewStatuses =
  new Set([
    "not_started",
    "in_review",
    "changes_requested",
    "reviewed",
  ]);


export const deliverableApprovalStatuses =
  new Set([
    "not_requested",
    "pending",
    "approved",
    "rejected",
  ]);


export const projectDeliverableSelect =
  "id,project_id,created_by,title,description,deliverable_type,source_kind,version_number,review_status,approval_status,external_url,storage_bucket,storage_path,filename,mime_type,byte_size,sha256,approved_at,delivered_at,sort_order,created_at,updated_at";


type AdminClient =
  ReturnType<
    typeof createAdminClient
  >;


export function strictText(
  value: unknown,
  maxLength: number,
) {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  const result =
    value.trim();

  if (
    !result ||
    result.length >
      maxLength
  ) {
    return null;
  }

  return result;
}


export function boundedText(
  value: unknown,
  maxLength: number,
) {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return "";
  }

  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  if (
    value.length >
      maxLength
  ) {
    return null;
  }

  return value.trim();
}


export function httpUrlValue(
  value: unknown,
) {
  const raw =
    strictText(
      value,
      2048,
    );

  if (!raw) {
    return null;
  }

  try {
    const parsed =
      new URL(
        raw,
      );

    if (
      parsed.protocol !==
        "http:" &&
      parsed.protocol !==
        "https:"
    ) {
      return null;
    }

    return parsed
      .toString();
  }
  catch {
    return null;
  }
}


export function safeStorageFilename(
  filename: string,
) {
  const normalized =
    filename
      .normalize(
        "NFKC",
      )
      .replace(
        /[^A-Za-z0-9._-]+/g,
        "-",
      )
      .replace(
        /-+/g,
        "-",
      )
      .replace(
        /^[.-]+|[.-]+$/g,
        "",
      )
      .slice(
        0,
        180,
      );

  if (normalized) {
    return normalized;
  }

  return `file-${randomUUID()}`;
}


export function buildProjectStoragePath(
  projectId: string,
  filename: string,
) {
  return [
    projectId,
    randomUUID(),
    safeStorageFilename(
      filename,
    ),
  ].join("/");
}


export function isProjectStoragePath(
  projectId: string,
  storagePath: string,
) {
  const parts =
    storagePath
      .split("/");

  if (
    parts.length !==
      3
  ) {
    return false;
  }

  if (
    parts[0] !==
      projectId
  ) {
    return false;
  }

  if (
    !uuidPattern.test(
      parts[1],
    )
  ) {
    return false;
  }

  if (
    !parts[2] ||
    parts[2].includes(
      "..",
    )
  ) {
    return false;
  }

  return true;
}


export async function ownedDeliverable(
  admin: AdminClient,
  userId: string,
  projectId: string,
  deliverableId: string,
) {
  return admin
    .from(
      "studio_project_deliverables",
    )
    .select(
      projectDeliverableSelect,
    )
    .eq(
      "id",
      deliverableId,
    )
    .eq(
      "project_id",
      projectId,
    )
    .eq(
      "created_by",
      userId,
    )
    .maybeSingle();
}
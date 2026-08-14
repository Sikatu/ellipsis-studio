import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  authenticatedOwner,
  integerValue,
  jsonError,
  jsonSuccess,
  ownedProject,
  readJsonObject,
  trustedRequestOrigin,
  uuidPattern,
} from "@/lib/server/project-work";

import {
  buildProjectStoragePath,
  MAX_PROJECT_DELIVERABLE_BYTES,
  PROJECT_DELIVERABLE_BUCKET,
  strictText,
} from "@/lib/server/project-deliverables";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


export async function POST(
  request: Request,
  {
    params,
  }: {
    params:
      Promise<{
        projectId: string;
      }>;
  },
) {
  const user =
    await authenticatedOwner();

  if (!user) {
    return jsonError(
      "Unauthorized",
      401,
    );
  }

  if (
    !trustedRequestOrigin(
      request,
    )
  ) {
    return jsonError(
      "Deliverable upload request origin was rejected.",
      403,
    );
  }

  const {
    projectId,
  } =
    await params;

  if (
    !uuidPattern.test(
      projectId,
    )
  ) {
    return jsonError(
      "Invalid project.",
      400,
    );
  }

  const body =
    await readJsonObject(
      request,
    );

  if (!body) {
    return jsonError(
      "Invalid upload request.",
      400,
    );
  }

  const filename =
    strictText(
      body.filename,
      255,
    );

  const mimeType =
    strictText(
      body.mimeType ??
        "application/octet-stream",
      255,
    );

  const byteSize =
    integerValue(
      body.byteSize,
    );

  if (!filename) {
    return jsonError(
      "A valid file name is required.",
      400,
    );
  }

  if (!mimeType) {
    return jsonError(
      "A valid MIME type is required.",
      400,
    );
  }

  if (
    byteSize ===
      null ||
    byteSize <=
      0 ||
    byteSize >
      MAX_PROJECT_DELIVERABLE_BYTES
  ) {
    return jsonError(
      "File size must be between 1 byte and 50 MB.",
      400,
    );
  }

  const admin =
    createAdminClient();

  const {
    data:
      project,
    error:
      projectError,
  } =
    await ownedProject(
      admin,
      user.id,
      projectId,
    );

  if (
    projectError ||
    !project
  ) {
    return jsonError(
      "Project not found.",
      404,
    );
  }

  if (
    project.archived_at
  ) {
    return jsonError(
      "Restore the project before uploading deliverables.",
      409,
    );
  }

  const storagePath =
    buildProjectStoragePath(
      projectId,
      filename,
    );

  const {
    data,
    error,
  } =
    await admin.storage
      .from(
        PROJECT_DELIVERABLE_BUCKET,
      )
      .createSignedUploadUrl(
        storagePath,
        {
          upsert:
            false,
        },
      );

  if (
    error ||
    !data
  ) {
    return jsonError(
      error?.message ??
        "Could not issue the private upload.",
      409,
    );
  }

  return jsonSuccess(
    {
      upload: {
        bucket:
          PROJECT_DELIVERABLE_BUCKET,

        path:
          storagePath,

        token:
          data.token,

        signedUrl:
          data.signedUrl,

        filename,

        mimeType,

        byteSize,

        expiresInSeconds:
          7200,
      },
    },
    201,
  );
}
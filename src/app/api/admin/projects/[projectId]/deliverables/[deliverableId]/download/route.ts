import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  authenticatedOwner,
  jsonError,
  jsonSuccess,
  ownedProject,
  uuidPattern,
} from "@/lib/server/project-work";

import {
  isProjectStoragePath,
  ownedDeliverable,
  PROJECT_DELIVERABLE_BUCKET,
} from "@/lib/server/project-deliverables";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


export async function GET(
  _request: Request,
  {
    params,
  }: {
    params:
      Promise<{
        projectId: string;
        deliverableId: string;
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

  const {
    projectId,
    deliverableId,
  } =
    await params;

  if (
    !uuidPattern.test(
      projectId,
    ) ||
    !uuidPattern.test(
      deliverableId,
    )
  ) {
    return jsonError(
      "Invalid deliverable.",
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

  const {
    data:
      deliverable,
    error:
      deliverableError,
  } =
    await ownedDeliverable(
      admin,
      user.id,
      projectId,
      deliverableId,
    );

  if (
    deliverableError ||
    !deliverable
  ) {
    return jsonError(
      "Deliverable not found.",
      404,
    );
  }

  if (
    deliverable.source_kind !==
      "file" ||
    deliverable.storage_bucket !==
      PROJECT_DELIVERABLE_BUCKET ||
    !deliverable.storage_path ||
    !isProjectStoragePath(
      projectId,
      deliverable.storage_path,
    )
  ) {
    return jsonError(
      "This deliverable does not contain a private project file.",
      409,
    );
  }

  const {
    data,
    error,
  } =
    await admin.storage
      .from(
        PROJECT_DELIVERABLE_BUCKET,
      )
      .createSignedUrl(
        deliverable.storage_path,
        60,
        {
          download:
            true,
        },
      );

  if (
    error ||
    !data?.signedUrl
  ) {
    return jsonError(
      error?.message ??
        "Could not create the private download.",
      409,
    );
  }

  return jsonSuccess({
    download: {
      url:
        data.signedUrl,

      expiresInSeconds:
        60,

      filename:
        deliverable.filename,
    },
  });
}
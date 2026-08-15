import {
  createAdminClient,
} from "@/lib/supabase/admin";


type AdminClient =
  ReturnType<
    typeof createAdminClient
  >;


export type ProjectActivityActorRole =
  | "owner"
  | "va"
  | "system";


export type ProjectActivityMetadata =
  Record<
    string,
    unknown
  >;


export type ProjectActivityInput = {
  projectId: string;
  actorUserId:
    | string
    | null;
  actorRole?:
    ProjectActivityActorRole;
  eventType: string;
  entityType?:
    | string
    | null;
  entityId?:
    | string
    | null;
  summary: string;
  metadata?:
    ProjectActivityMetadata;
};


export const projectActivitySelect =
  "id,project_id,actor_user_id,actor_role,event_type,entity_type,entity_id,summary,metadata,occurred_at,created_at";


function boundedText(
  value: string,
  maxLength: number,
) {
  return value
    .trim()
    .slice(
      0,
      maxLength,
    );
}


export async function appendProjectActivity(
  admin: AdminClient,
  input: ProjectActivityInput,
) {
  const eventType =
    boundedText(
      input.eventType,
      120,
    );

  const summary =
    boundedText(
      input.summary,
      4000,
    );

  const entityType =
    input.entityType
      ? boundedText(
          input.entityType,
          80,
        )
      : null;

  const entityId =
    input.entityId ??
    null;

  if (!eventType) {
    return {
      data:
        null,
      error:
        new Error(
          "Project activity event type is required.",
        ),
    };
  }

  if (!summary) {
    return {
      data:
        null,
      error:
        new Error(
          "Project activity summary is required.",
        ),
    };
  }

  if (
    Boolean(
      entityType,
    ) !==
    Boolean(
      entityId,
    )
  ) {
    return {
      data:
        null,
      error:
        new Error(
          "Project activity entity type and entity id must be supplied together.",
        ),
    };
  }

  const {
    data,
    error,
  } =
    await admin
      .from(
        "studio_project_activity_events",
      )
      .insert({
        project_id:
          input.projectId,

        actor_user_id:
          input.actorUserId,

        actor_role:
          input.actorRole ??
          "owner",

        event_type:
          eventType,

        entity_type:
          entityType,

        entity_id:
          entityId,

        summary,

        metadata:
          input.metadata ??
          {},
      })
      .select(
        projectActivitySelect,
      )
      .single();

  return {
    data,
    error,
  };
}


export async function appendProjectActivityBestEffort(
  admin: AdminClient,
  input: ProjectActivityInput,
) {
  const {
    error,
  } =
    await appendProjectActivity(
      admin,
      input,
    );

  if (error) {
    console.error(
      "Project activity append failed.",
      {
        projectId:
          input.projectId,
        eventType:
          input.eventType,
        message:
          error.message,
      },
    );

    return false;
  }

  return true;
}

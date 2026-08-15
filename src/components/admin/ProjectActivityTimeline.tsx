"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


type ProjectActivityEvent = {
  id: string;
  project_id: string;
  actor_user_id:
    | string
    | null;
  actor_role: string;
  event_type: string;
  entity_type:
    | string
    | null;
  entity_id:
    | string
    | null;
  summary: string;
  metadata:
    Record<
      string,
      unknown
    >;
  occurred_at: string;
  created_at: string;
};


type WorkspaceMember = {
  user_id: string;
  display_name: string;
  role: string;
  status: string;
};


type Props = {
  projectId: string;
  archived: boolean;
  initialEvents:
    ProjectActivityEvent[];
  members:
    WorkspaceMember[];
};


const eventLabels:
  Record<
    string,
    string
  > = {
    project_created:
      "Project created",

    project_note_added:
      "Note added",

    project_status_changed:
      "Project status changed",

    project_archived:
      "Project archived",

    project_restored:
      "Project restored",

    task_completed:
      "Task completed",

    task_reopened:
      "Task reopened",

    milestone_completed:
      "Milestone completed",

    milestone_reopened:
      "Milestone reopened",

    deliverable_created:
      "Deliverable created",

    deliverable_updated:
      "Deliverable updated",

    deliverable_approval_changed:
      "Approval changed",

    deliverable_delivered:
      "Deliverable delivered",

    deliverable_delivery_reopened:
      "Delivery reopened",
  };


function labelValue(
  value: string,
) {
  return value
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character
          .toUpperCase(),
    );
}


function eventLabel(
  eventType: string,
) {
  return (
    eventLabels[
      eventType
    ] ??
    labelValue(
      eventType,
    )
  );
}


function formatDateTime(
  value: string,
) {
  const parsed =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return new Intl
    .DateTimeFormat(
      "en-US",
      {
        dateStyle:
          "medium",

        timeStyle:
          "short",
      },
    )
    .format(
      parsed,
    );
}


function errorMessage(
  payload: unknown,
  fallback: string,
) {
  if (
    payload &&
    typeof payload ===
      "object" &&
    "error" in payload &&
    typeof (
      payload as {
        error?: unknown;
      }
    ).error ===
      "string"
  ) {
    return (
      payload as {
        error: string;
      }
    ).error;
  }

  return fallback;
}


async function requestJson(
  url: string,
  options:
    RequestInit,
) {
  const response =
    await fetch(
      url,
      {
        ...options,

        headers: {
          "Content-Type":
            "application/json",

          ...options.headers,
        },
      },
    );

  let payload:
    unknown = null;

  try {
    payload =
      await response
        .json();
  }
  catch {
    payload =
      null;
  }

  if (!response.ok) {
    throw new Error(
      errorMessage(
        payload,
        "The activity request failed.",
      ),
    );
  }

  return payload;
}


function changedFieldsLabel(
  metadata:
    Record<
      string,
      unknown
    >,
) {
  const changedFields =
    metadata
      .changedFields;

  if (
    !Array.isArray(
      changedFields,
    )
  ) {
    return "";
  }

  const labels =
    changedFields
      .filter(
        (
          value,
        ): value is string =>
          typeof value ===
            "string",
      )
      .map(
        labelValue,
      );

  if (
    labels.length ===
      0
  ) {
    return "";
  }

  return `Changed: ${labels.join(", ")}`;
}


export default function ProjectActivityTimeline({
  projectId,
  archived,
  initialEvents,
  members,
}: Props) {
  const router =
    useRouter();

  const [
    events,
    setEvents,
  ] =
    useState(
      initialEvents,
    );

  const [
    note,
    setNote,
  ] =
    useState(
      "",
    );

  const [
    busy,
    setBusy,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState(
      "",
    );


  const memberNames =
    useMemo(
      () =>
        new Map(
          members.map(
            (
              member,
            ) => [
              member.user_id,
              member.display_name,
            ],
          ),
        ),
      [
        members,
      ],
    );


  function actorName(
    event:
      ProjectActivityEvent,
  ) {
    if (
      event.actor_user_id
    ) {
      const name =
        memberNames.get(
          event.actor_user_id,
        );

      if (name) {
        return name;
      }
    }

    if (
      event.actor_role ===
        "system"
    ) {
      return "System";
    }

    if (
      event.actor_role ===
        "va"
    ) {
      return "VA";
    }

    return "Owner";
  }


  async function addNote() {
    const trimmed =
      note.trim();

    if (
      archived ||
      busy ||
      !trimmed
    ) {
      return;
    }

    setBusy(
      true,
    );

    setError(
      "",
    );

    try {
      const payload =
        await requestJson(
          `/api/admin/projects/${projectId}/activity/notes`,
          {
            method:
              "POST",

            body:
              JSON.stringify({
                note:
                  trimmed,
              }),
          },
        );

      const activity =
        (
          payload as {
            activity?:
              ProjectActivityEvent;
          }
        ).activity;

      if (!activity) {
        throw new Error(
          "The activity note was saved without an activity record.",
        );
      }

      setEvents(
        (
          current,
        ) => [
          activity,

          ...current.filter(
            (
              existing,
            ) =>
              existing.id !==
              activity.id,
          ),
        ],
      );

      setNote(
        "",
      );

      router.refresh();
    }
    catch (
      requestError
    ) {
      setError(
        requestError instanceof
          Error
          ? requestError.message
          : "Could not add the project note.",
      );
    }
    finally {
      setBusy(
        false,
      );
    }
  }


  return (
    <section className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c8ad84]/55">
            Project activity
          </p>

          <h2 className="mt-3 text-xl font-medium tracking-[-0.035em]">
            Operational timeline
          </h2>

          <p className="mt-3 max-w-2xl text-xs leading-6 text-white/30">
            Significant project, task, milestone, deliverable, approval, delivery, and note activity in one append-oriented history.
          </p>
        </div>

        <span className="w-fit rounded-full border border-white/[0.08] px-3 py-1.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/30">
          {events.length}{" "}
          {events.length ===
          1
            ? "event"
            : "events"}
        </span>
      </div>


      <div className="mt-8 rounded-2xl border border-white/[0.07] bg-black/[0.08] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#c8ad84]/50">
              Owner note
            </p>

            <p className="mt-1 text-xs text-white/28">
              Add operational context without changing project status or work records.
            </p>
          </div>

          <span className="text-[9px] text-white/20">
            {note.length}/4000
          </span>
        </div>

        <textarea
          value={
            note
          }
          onChange={
            (
              event,
            ) =>
              setNote(
                event.target
                  .value,
              )
          }
          maxLength={
            4000
          }
          disabled={
            archived ||
            busy
          }
          rows={
            4
          }
          placeholder={
            archived
              ? "Restore this project before adding notes."
              : "Add a project note..."
          }
          className="mt-4 w-full resize-y rounded-xl border border-white/[0.08] bg-black/10 px-4 py-3 text-sm leading-6 text-white/75 outline-none transition placeholder:text-white/20 focus:border-[#c8ad84]/35 disabled:cursor-not-allowed disabled:opacity-45"
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {archived && (
              <p className="text-xs text-white/28">
                Existing activity remains readable while the project is archived.
              </p>
            )}

            {error && (
              <p
                className="text-xs text-red-300/75"
                aria-live="polite"
              >
                {error}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={
              addNote
            }
            disabled={
              archived ||
              busy ||
              !note.trim()
            }
            className="rounded-full border border-[#c8ad84]/25 bg-[#c8ad84]/[0.07] px-5 py-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#ead6b5]/75 transition hover:border-[#c8ad84]/45 hover:bg-[#c8ad84]/[0.1] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {busy
              ? "Adding..."
              : "Add note"}
          </button>
        </div>
      </div>


      {events.length ===
      0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/[0.08] px-5 py-10 text-center">
          <p className="text-sm text-white/32">
            No project activity has been recorded yet.
          </p>

          <p className="mt-2 text-xs text-white/20">
            New significant project operations will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="mt-8 border-y border-white/[0.06]">
          {events.map(
            (
              event,
              index,
            ) => {
              const detail =
                changedFieldsLabel(
                  event.metadata,
                );

              return (
                <article
                  key={
                    event.id
                  }
                  className={`relative flex gap-4 py-5 ${
                    index > 0
                      ? "border-t border-white/[0.06]"
                      : ""
                  }`}
                >
                  <div className="flex w-5 shrink-0 justify-center pt-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#c8ad84]/70 shadow-[0_0_0_4px_rgba(200,173,132,0.05)]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#c8ad84]/50">
                          {eventLabel(
                            event.event_type,
                          )}
                        </p>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/65">
                          {event.summary}
                        </p>
                      </div>

                      <time
                        dateTime={
                          event.occurred_at
                        }
                        className="shrink-0 text-[10px] text-white/24"
                      >
                        {formatDateTime(
                          event.occurred_at,
                        )}
                      </time>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/25">
                      <span>
                        {actorName(
                          event,
                        )}
                      </span>

                      {event.entity_type && (
                        <>
                          <span className="text-white/10">
                            /
                          </span>

                          <span>
                            {labelValue(
                              event.entity_type,
                            )}
                          </span>
                        </>
                      )}

                      {detail && (
                        <>
                          <span className="text-white/10">
                            /
                          </span>

                          <span>
                            {detail}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}

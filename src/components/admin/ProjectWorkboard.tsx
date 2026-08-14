"use client";

import {
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

type TaskStatus =
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

type TaskPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

type ProjectTask = {
  id: string;
  project_id: string;
  milestone_id: string | null;
  assignee_member_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProjectMilestone = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type WorkspaceMember = {
  id: string;
  display_name: string;
  role: string;
  status: string;
};

type Props = {
  projectId: string;
  archived: boolean;
  initialTasks: ProjectTask[];
  initialMilestones: ProjectMilestone[];
  members: WorkspaceMember[];
};

const statusLabels:
  Record<
    TaskStatus,
    string
  > = {
    assigned:
      "Assigned",
    in_progress:
      "In progress",
    completed:
      "Completed",
    cancelled:
      "Cancelled",
  };

const priorityLabels:
  Record<
    TaskPriority,
    string
  > = {
    low:
      "Low",
    normal:
      "Normal",
    high:
      "High",
    urgent:
      "Urgent",
  };

function todayValue() {
  const now =
    new Date();

  const local =
    new Date(
      now.getTime() -
      now.getTimezoneOffset() *
        60000,
    );

  return local
    .toISOString()
    .slice(
      0,
      10,
    );
}

function formatDate(
  value:
    string |
    null,
) {
  if (!value) {
    return "No due date";
  }

  const parsed =
    new Date(
      `${value}T00:00:00`,
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

async function request(
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
      await response.json();
  }
  catch {
    payload =
      null;
  }

  if (!response.ok) {
    throw new Error(
      errorMessage(
        payload,
        "The project work request failed.",
      ),
    );
  }

  return payload;
}

function TaskEditor({
  task,
  projectId,
  archived,
  milestones,
  members,
  busy,
  onBusy,
  onSaved,
}: {
  task: ProjectTask;
  projectId: string;
  archived: boolean;
  milestones: ProjectMilestone[];
  members: WorkspaceMember[];
  busy: boolean;
  onBusy:
    (
      value: boolean,
    ) => void;
  onSaved:
    (
      message: string,
    ) => void;
}) {
  const router =
    useRouter();

  const [
    title,
    setTitle,
  ] =
    useState(
      task.title,
    );

  const [
    description,
    setDescription,
  ] =
    useState(
      task.description,
    );

  const [
    status,
    setStatus,
  ] =
    useState<TaskStatus>(
      task.status,
    );

  const [
    priority,
    setPriority,
  ] =
    useState<TaskPriority>(
      task.priority,
    );

  const [
    dueDate,
    setDueDate,
  ] =
    useState(
      task.due_date ??
      "",
    );

  const [
    milestoneId,
    setMilestoneId,
  ] =
    useState(
      task.milestone_id ??
      "",
    );

  const [
    assigneeMemberId,
    setAssigneeMemberId,
  ] =
    useState(
      task.assignee_member_id ??
      "",
    );

  const [
    sortOrder,
    setSortOrder,
  ] =
    useState(
      String(
        task.sort_order,
      ),
    );

  const [
    error,
    setError,
  ] =
    useState("");


  async function save(
    nextStatus:
      TaskStatus =
      status,
  ) {
    setError("");

    onBusy(
      true,
    );

    try {
      await request(
        `/api/admin/projects/${projectId}/tasks/${task.id}`,
        {
          method:
            "PUT",
          body:
            JSON.stringify({
              title,
              description,
              status:
                nextStatus,
              priority,
              dueDate,
              milestoneId:
                milestoneId ||
                null,
              assigneeMemberId:
                assigneeMemberId ||
                null,
              sortOrder:
                Number(
                  sortOrder,
                ),
            }),
        },
      );

      setStatus(
        nextStatus,
      );

      onSaved(
        nextStatus ===
          "completed"
          ? "Task completed."
          : nextStatus ===
              "cancelled"
            ? "Task cancelled."
            : "Task updated.",
      );

      router.refresh();
    }
    catch (
      caught
    ) {
      setError(
        caught instanceof
          Error
          ? caught.message
          : "Could not update task.",
      );
    }
    finally {
      onBusy(
        false,
      );
    }
  }

  const selectedMember =
    members.find(
      (
        member,
      ) =>
        member.id ===
        assigneeMemberId,
    );

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-black/10 p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <input
            value={title}
            onChange={(
              event,
            ) =>
              setTitle(
                event.target
                  .value,
              )
            }
            disabled={
              archived ||
              busy
            }
            maxLength={240}
            className="w-full border-0 bg-transparent p-0 text-base font-medium text-white outline-none placeholder:text-white/20 disabled:opacity-50"
          />

          <textarea
            value={
              description
            }
            onChange={(
              event,
            ) =>
              setDescription(
                event.target
                  .value,
              )
            }
            disabled={
              archived ||
              busy
            }
            rows={2}
            maxLength={20000}
            placeholder="Task notes"
            className="mt-3 w-full resize-y rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-xs leading-5 text-white/50 outline-none transition focus:border-[#c8ad84]/25 disabled:opacity-50"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
              Status
            </span>

            <select
              value={status}
              onChange={(
                event,
              ) =>
                setStatus(
                  event.target
                    .value as
                    TaskStatus,
                )
              }
              disabled={
                archived ||
                busy
              }
              className="w-full rounded-lg border border-white/[0.08] bg-[#171714] px-3 py-2 text-xs text-white/60 outline-none"
            >
              {Object.entries(
                statusLabels,
              ).map(
                ([
                  value,
                  display,
                ]) => (
                  <option
                    key={
                      value
                    }
                    value={
                      value
                    }
                  >
                    {
                      display
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
              Priority
            </span>

            <select
              value={
                priority
              }
              onChange={(
                event,
              ) =>
                setPriority(
                  event.target
                    .value as
                    TaskPriority,
                )
              }
              disabled={
                archived ||
                busy
              }
              className="w-full rounded-lg border border-white/[0.08] bg-[#171714] px-3 py-2 text-xs text-white/60 outline-none"
            >
              {Object.entries(
                priorityLabels,
              ).map(
                ([
                  value,
                  display,
                ]) => (
                  <option
                    key={
                      value
                    }
                    value={
                      value
                    }
                  >
                    {
                      display
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
              Due date
            </span>

            <input
              type="date"
              value={
                dueDate
              }
              onChange={(
                event,
              ) =>
                setDueDate(
                  event.target
                    .value,
                )
              }
              disabled={
                archived ||
                busy
              }
              className="w-full rounded-lg border border-white/[0.08] bg-[#171714] px-3 py-2 text-xs text-white/60 outline-none"
            />
          </label>

          <label className="space-y-1">
            <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
              Order
            </span>

            <input
              type="number"
              min={0}
              step={1}
              value={
                sortOrder
              }
              onChange={(
                event,
              ) =>
                setSortOrder(
                  event.target
                    .value,
                )
              }
              disabled={
                archived ||
                busy
              }
              className="w-full rounded-lg border border-white/[0.08] bg-[#171714] px-3 py-2 text-xs text-white/60 outline-none"
            />
          </label>

          <label className="space-y-1 sm:col-span-2">
            <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
              Milestone
            </span>

            <select
              value={
                milestoneId
              }
              onChange={(
                event,
              ) =>
                setMilestoneId(
                  event.target
                    .value,
                )
              }
              disabled={
                archived ||
                busy
              }
              className="w-full rounded-lg border border-white/[0.08] bg-[#171714] px-3 py-2 text-xs text-white/60 outline-none"
            >
              <option value="">
                No milestone
              </option>

              {milestones.map(
                (
                  milestone,
                ) => (
                  <option
                    key={
                      milestone.id
                    }
                    value={
                      milestone.id
                    }
                  >
                    {
                      milestone.title
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="space-y-1 sm:col-span-2">
            <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
              Assignee
            </span>

            <select
              value={
                assigneeMemberId
              }
              onChange={(
                event,
              ) =>
                setAssigneeMemberId(
                  event.target
                    .value,
                )
              }
              disabled={
                archived ||
                busy
              }
              className="w-full rounded-lg border border-white/[0.08] bg-[#171714] px-3 py-2 text-xs text-white/60 outline-none"
            >
              <option value="">
                Unassigned
              </option>

              {members.map(
                (
                  member,
                ) => {
                  const disabledMember =
                    member.status !==
                      "active" &&
                    member.id !==
                      assigneeMemberId;

                  return (
                    <option
                      key={
                        member.id
                      }
                      value={
                        member.id
                      }
                      disabled={
                        disabledMember
                      }
                    >
                      {
                        member.display_name
                      }
                      {" · "}
                      {
                        member.role
                      }
                      {
                        member.status !==
                          "active"
                          ? " · disabled"
                          : ""
                      }
                    </option>
                  );
                },
              )}
            </select>

            {selectedMember?.status !==
              undefined &&
              selectedMember.status !==
                "active" && (
                <p className="text-[9px] leading-4 text-amber-200/45">
                  This existing assignee is disabled. You may keep or replace the assignment.
                </p>
              )}
          </label>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
        <div className="flex flex-wrap gap-2 text-[9px] uppercase tracking-[0.11em] text-white/25">
          <span>
            {
              statusLabels[
                task.status
              ]
            }
          </span>

          <span>
            ·
          </span>

          <span>
            {
              priorityLabels[
                task.priority
              ]
            }
          </span>

          <span>
            ·
          </span>

          <span>
            {formatDate(
              task.due_date,
            )}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {status !==
            "completed" &&
            status !==
              "cancelled" && (
              <button
                type="button"
                onClick={() =>
                  save(
                    "completed",
                  )
                }
                disabled={
                  archived ||
                  busy
                }
                className="rounded-full border border-emerald-300/15 px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.11em] text-emerald-200/55 transition hover:border-emerald-300/30 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Complete
              </button>
            )}

          {status !==
            "cancelled" &&
            status !==
              "completed" && (
              <button
                type="button"
                onClick={() =>
                  save(
                    "cancelled",
                  )
                }
                disabled={
                  archived ||
                  busy
                }
                className="rounded-full border border-red-300/10 px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.11em] text-red-200/40 transition hover:border-red-300/25 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Cancel
              </button>
            )}

          <button
            type="button"
            onClick={() =>
              save()
            }
            disabled={
              archived ||
              busy
            }
            className="rounded-full border border-[#c8ad84]/20 bg-[#c8ad84]/[0.07] px-4 py-2 text-[8px] font-semibold uppercase tracking-[0.11em] text-[#ead6b5]/70 transition hover:bg-[#c8ad84]/[0.12] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {busy
              ? "Saving..."
              : "Save task"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs leading-5 text-red-200/60">
          {error}
        </p>
      )}
    </article>
  );
}

function MilestoneEditor({
  milestone,
  projectId,
  archived,
  busy,
  onBusy,
  onSaved,
}: {
  milestone:
    ProjectMilestone;
  projectId: string;
  archived: boolean;
  busy: boolean;
  onBusy:
    (
      value: boolean,
    ) => void;
  onSaved:
    (
      message: string,
    ) => void;
}) {
  const router =
    useRouter();

  const [
    title,
    setTitle,
  ] =
    useState(
      milestone.title,
    );

  const [
    description,
    setDescription,
  ] =
    useState(
      milestone.description,
    );

  const [
    dueDate,
    setDueDate,
  ] =
    useState(
      milestone.due_date ??
      "",
    );

  const [
    sortOrder,
    setSortOrder,
  ] =
    useState(
      String(
        milestone.sort_order,
      ),
    );

  const [
    completed,
    setCompleted,
  ] =
    useState(
      Boolean(
        milestone.completed_at,
      ),
    );

  const [
    error,
    setError,
  ] =
    useState("");


  async function save(
    nextCompleted =
      completed,
  ) {
    setError("");

    onBusy(
      true,
    );

    try {
      await request(
        `/api/admin/projects/${projectId}/milestones/${milestone.id}`,
        {
          method:
            "PUT",
          body:
            JSON.stringify({
              title,
              description,
              dueDate,
              sortOrder:
                Number(
                  sortOrder,
                ),
              completed:
                nextCompleted,
            }),
        },
      );

      setCompleted(
        nextCompleted,
      );

      onSaved(
        nextCompleted
          ? "Milestone completed."
          : "Milestone updated.",
      );

      router.refresh();
    }
    catch (
      caught
    ) {
      setError(
        caught instanceof
          Error
          ? caught.message
          : "Could not update milestone.",
      );
    }
    finally {
      onBusy(
        false,
      );
    }
  }

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-black/10 p-5">
      <div className="flex flex-col gap-4">
        <input
          value={title}
          onChange={(
            event,
          ) =>
            setTitle(
              event.target
                .value,
            )
          }
          disabled={
            archived ||
            busy
          }
          maxLength={240}
          className="w-full border-0 bg-transparent p-0 text-base font-medium text-white outline-none disabled:opacity-50"
        />

        <textarea
          value={
            description
          }
          onChange={(
            event,
          ) =>
            setDescription(
              event.target
                .value,
            )
          }
          disabled={
            archived ||
            busy
          }
          rows={2}
          maxLength={10000}
          placeholder="Milestone notes"
          className="w-full resize-y rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-xs leading-5 text-white/50 outline-none transition focus:border-[#c8ad84]/25 disabled:opacity-50"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
              Due date
            </span>

            <input
              type="date"
              value={
                dueDate
              }
              onChange={(
                event,
              ) =>
                setDueDate(
                  event.target
                    .value,
                )
              }
              disabled={
                archived ||
                busy
              }
              className="w-full rounded-lg border border-white/[0.08] bg-[#171714] px-3 py-2 text-xs text-white/60 outline-none"
            />
          </label>

          <label className="space-y-1">
            <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
              Order
            </span>

            <input
              type="number"
              min={0}
              step={1}
              value={
                sortOrder
              }
              onChange={(
                event,
              ) =>
                setSortOrder(
                  event.target
                    .value,
                )
              }
              disabled={
                archived ||
                busy
              }
              className="w-full rounded-lg border border-white/[0.08] bg-[#171714] px-3 py-2 text-xs text-white/60 outline-none"
            />
          </label>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
        <span className="text-[9px] uppercase tracking-[0.11em] text-white/25">
          {completed
            ? "Completed"
            : formatDate(
                milestone.due_date,
              )}
        </span>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              save(
                !completed,
              )
            }
            disabled={
              archived ||
              busy
            }
            className="rounded-full border border-white/[0.08] px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.11em] text-white/40 transition hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {completed
              ? "Reopen"
              : "Complete"}
          </button>

          <button
            type="button"
            onClick={() =>
              save()
            }
            disabled={
              archived ||
              busy
            }
            className="rounded-full border border-[#c8ad84]/20 bg-[#c8ad84]/[0.07] px-4 py-2 text-[8px] font-semibold uppercase tracking-[0.11em] text-[#ead6b5]/70 transition hover:bg-[#c8ad84]/[0.12] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {busy
              ? "Saving..."
              : "Save milestone"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs leading-5 text-red-200/60">
          {error}
        </p>
      )}
    </article>
  );
}

export default function ProjectWorkboard({
  projectId,
  archived,
  initialTasks,
  initialMilestones,
  members,
}: Props) {
  const router =
    useRouter();

  const [
    taskTitle,
    setTaskTitle,
  ] =
    useState("");

  const [
    taskDescription,
    setTaskDescription,
  ] =
    useState("");

  const [
    taskPriority,
    setTaskPriority,
  ] =
    useState<TaskPriority>(
      "normal",
    );

  const [
    taskDueDate,
    setTaskDueDate,
  ] =
    useState("");

  const [
    taskMilestoneId,
    setTaskMilestoneId,
  ] =
    useState("");

  const [
    taskAssigneeId,
    setTaskAssigneeId,
  ] =
    useState("");

  const [
    taskSortOrder,
    setTaskSortOrder,
  ] =
    useState("0");

  const [
    milestoneTitle,
    setMilestoneTitle,
  ] =
    useState("");

  const [
    milestoneDescription,
    setMilestoneDescription,
  ] =
    useState("");

  const [
    milestoneDueDate,
    setMilestoneDueDate,
  ] =
    useState("");

  const [
    milestoneSortOrder,
    setMilestoneSortOrder,
  ] =
    useState("0");

  const [
    busyKey,
    setBusyKey,
  ] =
    useState<
      string |
      null
    >(null);

  const [
    notice,
    setNotice,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const tasks =
    useMemo(
      () =>
        [...initialTasks]
          .sort(
            (
              left,
              right,
            ) =>
              left.sort_order -
                right.sort_order ||
              left.created_at
                .localeCompare(
                  right.created_at,
                ),
          ),
      [
        initialTasks,
      ],
    );

  const milestones =
    useMemo(
      () =>
        [...initialMilestones]
          .sort(
            (
              left,
              right,
            ) =>
              left.sort_order -
                right.sort_order ||
              left.created_at
                .localeCompare(
                  right.created_at,
                ),
          ),
      [
        initialMilestones,
      ],
    );

  const activeMembers =
    members.filter(
      (
        member,
      ) =>
        member.status ===
        "active",
    );

  const today =
    todayValue();

  const openTasks =
    tasks.filter(
      (
        task,
      ) =>
        task.status !==
          "completed" &&
        task.status !==
          "cancelled",
    );

  const completedTasks =
    tasks.filter(
      (
        task,
      ) =>
        task.status ===
        "completed",
    );

  const inProgressTasks =
    tasks.filter(
      (
        task,
      ) =>
        task.status ===
        "in_progress",
    );

  const overdueTasks =
    openTasks.filter(
      (
        task,
      ) =>
        Boolean(
          task.due_date &&
          task.due_date <
            today,
        ),
    );

  const completedMilestones =
    milestones.filter(
      (
        milestone,
      ) =>
        Boolean(
          milestone.completed_at,
        ),
    );

  async function createTask() {
    setError("");
    setNotice("");

    if (
      !taskTitle
        .trim()
    ) {
      setError(
        "Task title is required.",
      );

      return;
    }

    setBusyKey(
      "new-task",
    );

    try {
      await request(
        `/api/admin/projects/${projectId}/tasks`,
        {
          method:
            "POST",
          body:
            JSON.stringify({
              title:
                taskTitle,
              description:
                taskDescription,
              status:
                "assigned",
              priority:
                taskPriority,
              dueDate:
                taskDueDate,
              milestoneId:
                taskMilestoneId ||
                null,
              assigneeMemberId:
                taskAssigneeId ||
                null,
              sortOrder:
                Number(
                  taskSortOrder,
                ),
            }),
        },
      );

      setTaskTitle(
        "",
      );
      setTaskDescription(
        "",
      );
      setTaskPriority(
        "normal",
      );
      setTaskDueDate(
        "",
      );
      setTaskMilestoneId(
        "",
      );
      setTaskAssigneeId(
        "",
      );
      setTaskSortOrder(
        String(
          tasks.length,
        ),
      );

      setNotice(
        "Task created.",
      );

      router.refresh();
    }
    catch (
      caught
    ) {
      setError(
        caught instanceof
          Error
          ? caught.message
          : "Could not create task.",
      );
    }
    finally {
      setBusyKey(
        null,
      );
    }
  }

  async function createMilestone() {
    setError("");
    setNotice("");

    if (
      !milestoneTitle
        .trim()
    ) {
      setError(
        "Milestone title is required.",
      );

      return;
    }

    setBusyKey(
      "new-milestone",
    );

    try {
      await request(
        `/api/admin/projects/${projectId}/milestones`,
        {
          method:
            "POST",
          body:
            JSON.stringify({
              title:
                milestoneTitle,
              description:
                milestoneDescription,
              dueDate:
                milestoneDueDate,
              sortOrder:
                Number(
                  milestoneSortOrder,
                ),
              completed:
                false,
            }),
        },
      );

      setMilestoneTitle(
        "",
      );
      setMilestoneDescription(
        "",
      );
      setMilestoneDueDate(
        "",
      );
      setMilestoneSortOrder(
        String(
          milestones.length,
        ),
      );

      setNotice(
        "Milestone created.",
      );

      router.refresh();
    }
    catch (
      caught
    ) {
      setError(
        caught instanceof
          Error
          ? caught.message
          : "Could not create milestone.",
      );
    }
    finally {
      setBusyKey(
        null,
      );
    }
  }

  return (
    <section className="mt-10 space-y-6">
      <div className="flex flex-col gap-5 rounded-2xl border border-[#c8ad84]/15 bg-[#c8ad84]/[0.025] p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c8ad84]/55">
            Project work
          </p>

          <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em]">
            Tasks & milestones
          </h2>

          <p className="mt-3 max-w-2xl text-xs leading-6 text-white/30">
            Plan the work, assign ownership, track deadlines, and close project checkpoints without mixing task state with time tracking.
          </p>
        </div>

        {archived && (
          <span className="rounded-full border border-amber-200/15 bg-amber-200/[0.04] px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-100/50">
            Read only while archived
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label:
              "Total tasks",
            value:
              tasks.length,
          },
          {
            label:
              "Open",
            value:
              openTasks.length,
          },
          {
            label:
              "In progress",
            value:
              inProgressTasks.length,
          },
          {
            label:
              "Completed",
            value:
              completedTasks.length,
          },
          {
            label:
              "Overdue",
            value:
              overdueTasks.length,
          },
        ].map(
          (
            metric,
          ) => (
            <article
              key={
                metric.label
              }
              className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-5"
            >
              <p className="text-[8px] font-semibold uppercase tracking-[0.13em] text-white/25">
                {
                  metric.label
                }
              </p>

              <p className="mt-3 text-2xl font-medium">
                {
                  metric.value
                }
              </p>
            </article>
          ),
        )}
      </div>

      {(notice ||
        error) && (
          <div
            className={
              error
                ? "rounded-xl border border-red-300/10 bg-red-300/[0.03] px-4 py-3 text-xs text-red-100/60"
                : "rounded-xl border border-emerald-300/10 bg-emerald-300/[0.03] px-4 py-3 text-xs text-emerald-100/60"
            }
          >
            {error ||
              notice}
          </div>
        )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c8ad84]/55">
                Tasks
              </p>

              <h3 className="mt-3 text-xl font-medium tracking-[-0.035em]">
                Operational work queue
              </h3>

              <p className="mt-3 text-xs leading-6 text-white/30">
                One task can belong to a milestone and optionally be assigned to an active workspace member.
              </p>
            </div>

            {!archived && (
              <div className="mt-7 rounded-2xl border border-white/[0.07] bg-black/10 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
                      New task
                    </span>

                    <input
                      value={
                        taskTitle
                      }
                      onChange={(
                        event,
                      ) =>
                        setTaskTitle(
                          event.target
                            .value,
                        )
                      }
                      maxLength={240}
                      placeholder="What needs to be done?"
                      className="w-full rounded-xl border border-white/[0.08] bg-[#171714] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#c8ad84]/30"
                    />
                  </label>

                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
                      Notes
                    </span>

                    <textarea
                      value={
                        taskDescription
                      }
                      onChange={(
                        event,
                      ) =>
                        setTaskDescription(
                          event.target
                            .value,
                        )
                      }
                      rows={2}
                      maxLength={20000}
                      placeholder="Optional task context"
                      className="w-full resize-y rounded-xl border border-white/[0.08] bg-[#171714] px-4 py-3 text-xs leading-5 text-white/55 outline-none placeholder:text-white/20 focus:border-[#c8ad84]/30"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
                      Priority
                    </span>

                    <select
                      value={
                        taskPriority
                      }
                      onChange={(
                        event,
                      ) =>
                        setTaskPriority(
                          event.target
                            .value as
                            TaskPriority,
                        )
                      }
                      className="w-full rounded-lg border border-white/[0.08] bg-[#171714] px-3 py-2 text-xs text-white/60 outline-none"
                    >
                      {Object.entries(
                        priorityLabels,
                      ).map(
                        ([
                          value,
                          display,
                        ]) => (
                          <option
                            key={
                              value
                            }
                            value={
                              value
                            }
                          >
                            {
                              display
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
                      Due date
                    </span>

                    <input
                      type="date"
                      value={
                        taskDueDate
                      }
                      onChange={(
                        event,
                      ) =>
                        setTaskDueDate(
                          event.target
                            .value,
                        )
                      }
                      className="w-full rounded-lg border border-white/[0.08] bg-[#171714] px-3 py-2 text-xs text-white/60 outline-none"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
                      Milestone
                    </span>

                    <select
                      value={
                        taskMilestoneId
                      }
                      onChange={(
                        event,
                      ) =>
                        setTaskMilestoneId(
                          event.target
                            .value,
                        )
                      }
                      className="w-full rounded-lg border border-white/[0.08] bg-[#171714] px-3 py-2 text-xs text-white/60 outline-none"
                    >
                      <option value="">
                        No milestone
                      </option>

                      {milestones.map(
                        (
                          milestone,
                        ) => (
                          <option
                            key={
                              milestone.id
                            }
                            value={
                              milestone.id
                            }
                          >
                            {
                              milestone.title
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
                      Assignee
                    </span>

                    <select
                      value={
                        taskAssigneeId
                      }
                      onChange={(
                        event,
                      ) =>
                        setTaskAssigneeId(
                          event.target
                            .value,
                        )
                      }
                      className="w-full rounded-lg border border-white/[0.08] bg-[#171714] px-3 py-2 text-xs text-white/60 outline-none"
                    >
                      <option value="">
                        Unassigned
                      </option>

                      {activeMembers.map(
                        (
                          member,
                        ) => (
                          <option
                            key={
                              member.id
                            }
                            value={
                              member.id
                            }
                          >
                            {
                              member.display_name
                            }
                            {" · "}
                            {
                              member.role
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">
                      Order
                    </span>

                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={
                        taskSortOrder
                      }
                      onChange={(
                        event,
                      ) =>
                        setTaskSortOrder(
                          event.target
                            .value,
                        )
                      }
                      className="w-full rounded-lg border border-white/[0.08] bg-[#171714] px-3 py-2 text-xs text-white/60 outline-none"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={
                    createTask
                  }
                  disabled={
                    busyKey !==
                    null
                  }
                  className="mt-4 rounded-full border border-[#c8ad84]/20 bg-[#c8ad84]/[0.07] px-5 py-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#ead6b5]/75 transition hover:bg-[#c8ad84]/[0.12] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {busyKey ===
                  "new-task"
                    ? "Creating..."
                    : "Create task"}
                </button>
              </div>
            )}

            {tasks.length ===
            0 ? (
              <div className="mt-7 rounded-2xl border border-dashed border-white/[0.08] px-5 py-10 text-center">
                <p className="text-sm text-white/30">
                  No tasks yet.
                </p>

                <p className="mt-2 text-xs text-white/20">
                  Add the first operational task for this project.
                </p>
              </div>
            ) : (
              <div className="mt-7 space-y-3">
                {tasks.map(
                  (
                    task,
                  ) => (
                    <TaskEditor
                      key={
                        `${task.id}:${task.updated_at}`
                      }
                      task={
                        task
                      }
                      projectId={
                        projectId
                      }
                      archived={
                        archived
                      }
                      milestones={
                        milestones
                      }
                      members={
                        members
                      }
                      busy={
                        busyKey ===
                        `task:${task.id}`
                      }
                      onBusy={(
                        value,
                      ) =>
                        setBusyKey(
                          value
                            ? `task:${task.id}`
                            : null,
                        )
                      }
                      onSaved={(
                        message,
                      ) => {
                        setError(
                          "",
                        );
                        setNotice(
                          message,
                        );
                      }}
                    />
                  ),
                )}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c8ad84]/55">
              Milestones
            </p>

            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <h3 className="text-xl font-medium tracking-[-0.035em]">
                  Project checkpoints
                </h3>

                <p className="mt-2 text-xs text-white/28">
                  {
                    completedMilestones.length
                  }
                  {" / "}
                  {
                    milestones.length
                  }
                  {" completed"}
                </p>
              </div>
            </div>

            {!archived && (
              <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/10 p-4">
                <div className="space-y-3">
                  <input
                    value={
                      milestoneTitle
                    }
                    onChange={(
                      event,
                    ) =>
                      setMilestoneTitle(
                        event.target
                          .value,
                      )
                    }
                    maxLength={240}
                    placeholder="New milestone"
                    className="w-full rounded-xl border border-white/[0.08] bg-[#171714] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
                  />

                  <textarea
                    value={
                      milestoneDescription
                    }
                    onChange={(
                      event,
                    ) =>
                      setMilestoneDescription(
                        event.target
                          .value,
                      )
                    }
                    rows={2}
                    maxLength={10000}
                    placeholder="Optional checkpoint context"
                    className="w-full resize-y rounded-xl border border-white/[0.08] bg-[#171714] px-3 py-2 text-xs leading-5 text-white/50 outline-none placeholder:text-white/20"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={
                        milestoneDueDate
                      }
                      onChange={(
                        event,
                      ) =>
                        setMilestoneDueDate(
                          event.target
                            .value,
                        )
                      }
                      className="w-full rounded-lg border border-white/[0.08] bg-[#171714] px-3 py-2 text-xs text-white/60 outline-none"
                    />

                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={
                        milestoneSortOrder
                      }
                      onChange={(
                        event,
                      ) =>
                        setMilestoneSortOrder(
                          event.target
                            .value,
                        )
                      }
                      className="w-full rounded-lg border border-white/[0.08] bg-[#171714] px-3 py-2 text-xs text-white/60 outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={
                      createMilestone
                    }
                    disabled={
                      busyKey !==
                      null
                    }
                    className="rounded-full border border-[#c8ad84]/20 bg-[#c8ad84]/[0.07] px-4 py-2 text-[8px] font-semibold uppercase tracking-[0.11em] text-[#ead6b5]/70 transition hover:bg-[#c8ad84]/[0.12] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {busyKey ===
                    "new-milestone"
                      ? "Creating..."
                      : "Create milestone"}
                  </button>
                </div>
              </div>
            )}

            {milestones.length ===
            0 ? (
              <p className="mt-6 text-sm text-white/28">
                No milestones yet.
              </p>
            ) : (
              <div className="mt-6 space-y-3">
                {milestones.map(
                  (
                    milestone,
                  ) => (
                    <MilestoneEditor
                      key={
                        `${milestone.id}:${milestone.updated_at}`
                      }
                      milestone={
                        milestone
                      }
                      projectId={
                        projectId
                      }
                      archived={
                        archived
                      }
                      busy={
                        busyKey ===
                        `milestone:${milestone.id}`
                      }
                      onBusy={(
                        value,
                      ) =>
                        setBusyKey(
                          value
                            ? `milestone:${milestone.id}`
                            : null,
                        )
                      }
                      onSaved={(
                        message,
                      ) => {
                        setError(
                          "",
                        );
                        setNotice(
                          message,
                        );
                      }}
                    />
                  ),
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
"use client";

import {
  type FormEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

export type ProjectEditorRecord = {
  id: string;
  title: string;
  project_type: string;
  description: string;
  status: string;
  priority: string;
  start_date: string | null;
  target_date: string | null;
  progress: number;
  archived_at: string | null;
};

export type ProjectOwnerDetailsRecord = {
  budget_cents: number | null;
  currency: string;
  internal_notes: string;
} | null;

type ProjectWorkspaceEditorProps = {
  project:
    ProjectEditorRecord;
  ownerDetails:
    ProjectOwnerDetailsRecord;
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-[#f4f0e8] outline-none transition placeholder:text-white/20 focus:border-[#c8ad84]/35";

const labelClass =
  "mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/32";

function centsFromMoney(
  value: string,
) {
  if (!value.trim()) {
    return null;
  }

  const parsed =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed < 0
  ) {
    return undefined;
  }

  const cents =
    Math.round(
      parsed * 100,
    );

  return Number.isSafeInteger(
    cents,
  )
    ? cents
    : undefined;
}

export default function ProjectWorkspaceEditor({
  project,
  ownerDetails,
}: ProjectWorkspaceEditorProps) {
  const router =
    useRouter();

  const [
    title,
    setTitle,
  ] =
    useState(
      project.title,
    );

  const [
    projectType,
    setProjectType,
  ] =
    useState(
      project.project_type,
    );

  const [
    description,
    setDescription,
  ] =
    useState(
      project.description,
    );

  const [
    status,
    setStatus,
  ] =
    useState(
      project.status,
    );

  const [
    priority,
    setPriority,
  ] =
    useState(
      project.priority,
    );

  const [
    startDate,
    setStartDate,
  ] =
    useState(
      project.start_date ??
        "",
    );

  const [
    targetDate,
    setTargetDate,
  ] =
    useState(
      project.target_date ??
        "",
    );

  const [
    progress,
    setProgress,
  ] =
    useState(
      String(
        project.progress,
      ),
    );

  const [
    archived,
    setArchived,
  ] =
    useState(
      Boolean(
        project.archived_at,
      ),
    );

  const [
    budget,
    setBudget,
  ] =
    useState(
      ownerDetails
        ?.budget_cents ===
          null ||
      ownerDetails
        ?.budget_cents ===
          undefined
        ? ""
        : (
            ownerDetails
              .budget_cents /
            100
          ).toFixed(
            2,
          ),
    );

  const [
    currency,
    setCurrency,
  ] =
    useState(
      ownerDetails
        ?.currency ??
        "USD",
    );

  const [
    internalNotes,
    setInternalNotes,
  ] =
    useState(
      ownerDetails
        ?.internal_notes ??
        "",
    );

  const [
    operationalSaving,
    setOperationalSaving,
  ] =
    useState(false);

  const [
    privateSaving,
    setPrivateSaving,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  async function persistOperational(
    nextArchived:
      boolean,
  ) {
    if (
      operationalSaving
    ) {
      return;
    }

    setOperationalSaving(
      true,
    );

    setMessage("");
    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/projects/${project.id}`,
          {
            method:
              "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                title,
                projectType,
                description,
                status,
                priority,
                startDate,
                targetDate,
                progress:
                  Number(
                    progress,
                  ),
                archived:
                  nextArchived,
              }),
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () =>
              null,
          ) as
          | {
              error?:
                string;
            }
          | null;

      if (!response.ok) {
        setError(
          payload
            ?.error ??
            "Could not update project.",
        );

        return;
      }

      setArchived(
        nextArchived,
      );

      setMessage(
        nextArchived
          ? "Project archived."
          : archived
            ? "Project restored."
            : "Project updated.",
      );

      router.refresh();
    }
    catch {
      setError(
        "Could not update project.",
      );
    }
    finally {
      setOperationalSaving(
        false,
      );
    }
  }

  async function submitOperational(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    await persistOperational(
      archived,
    );
  }

  async function submitPrivate(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (privateSaving) {
      return;
    }

    const budgetCents =
      centsFromMoney(
        budget,
      );

    if (
      budgetCents ===
        undefined
    ) {
      setError(
        "Enter a valid project budget.",
      );

      return;
    }

    setPrivateSaving(
      true,
    );

    setMessage("");
    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/projects/${project.id}`,
          {
            method:
              "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                budgetCents,
                currency,
                internalNotes,
              }),
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () =>
              null,
          ) as
          | {
              error?:
                string;
            }
          | null;

      if (!response.ok) {
        setError(
          payload
            ?.error ??
            "Could not update private project details.",
        );

        return;
      }

      setMessage(
        "Private project details updated.",
      );

      router.refresh();
    }
    catch {
      setError(
        "Could not update private project details.",
      );
    }
    finally {
      setPrivateSaving(
        false,
      );
    }
  }

  return (
    <div className="mt-10 space-y-6">
      {(message ||
        error) && (
        <div
          role={
            error
              ? "alert"
              : "status"
          }
          className={[
            "rounded-xl border px-4 py-3 text-sm",
            error
              ? "border-red-400/20 bg-red-400/[0.06] text-red-200/80"
              : "border-[#c8ad84]/20 bg-[#c8ad84]/[0.05] text-[#ead6b5]/75",
          ].join(" ")}
        >
          {error ||
            message}
        </div>
      )}

      <form
        onSubmit={
          submitOperational
        }
        className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c8ad84]/60">
              Project operations
            </p>

            <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em]">
              Scope and schedule
            </h2>
          </div>

          <span className="w-fit rounded-full border border-white/10 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/35">
            {archived
              ? "Archived"
              : "Live record"}
          </span>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <label
              htmlFor="edit-project-title"
              className={labelClass}
            >
              Project title
            </label>

            <input
              id="edit-project-title"
              value={title}
              onChange={(
                event,
              ) =>
                setTitle(
                  event
                    .target
                    .value,
                )
              }
              className={inputClass}
              maxLength={240}
              required
            />
          </div>

          <div>
            <label
              htmlFor="edit-project-type"
              className={labelClass}
            >
              Project type
            </label>

            <input
              id="edit-project-type"
              value={projectType}
              onChange={(
                event,
              ) =>
                setProjectType(
                  event
                    .target
                    .value,
                )
              }
              className={inputClass}
              maxLength={80}
              required
            />
          </div>

          <div>
            <label
              htmlFor="edit-project-status"
              className={labelClass}
            >
              Status
            </label>

            <select
              id="edit-project-status"
              value={status}
              onChange={(
                event,
              ) =>
                setStatus(
                  event
                    .target
                    .value,
                )
              }
              className={inputClass}
            >
              <option value="planned" className="bg-[#171714]">
                Planned
              </option>
              <option value="active" className="bg-[#171714]">
                Active
              </option>
              <option value="on_hold" className="bg-[#171714]">
                On hold
              </option>
              <option value="completed" className="bg-[#171714]">
                Completed
              </option>
              <option value="cancelled" className="bg-[#171714]">
                Cancelled
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="edit-project-priority"
              className={labelClass}
            >
              Priority
            </label>

            <select
              id="edit-project-priority"
              value={priority}
              onChange={(
                event,
              ) =>
                setPriority(
                  event
                    .target
                    .value,
                )
              }
              className={inputClass}
            >
              <option value="low" className="bg-[#171714]">
                Low
              </option>
              <option value="normal" className="bg-[#171714]">
                Normal
              </option>
              <option value="high" className="bg-[#171714]">
                High
              </option>
              <option value="urgent" className="bg-[#171714]">
                Urgent
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="edit-project-start"
              className={labelClass}
            >
              Start date
            </label>

            <input
              id="edit-project-start"
              type="date"
              value={startDate}
              onChange={(
                event,
              ) =>
                setStartDate(
                  event
                    .target
                    .value,
                )
              }
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="edit-project-target"
              className={labelClass}
            >
              Target date
            </label>

            <input
              id="edit-project-target"
              type="date"
              value={targetDate}
              onChange={(
                event,
              ) =>
                setTargetDate(
                  event
                    .target
                    .value,
                )
              }
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="edit-project-progress"
              className={labelClass}
            >
              Progress %
            </label>

            <input
              id="edit-project-progress"
              type="number"
              min="0"
              max="100"
              step="1"
              value={progress}
              onChange={(
                event,
              ) =>
                setProgress(
                  event
                    .target
                    .value,
                )
              }
              className={inputClass}
            />
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="edit-project-description"
              className={labelClass}
            >
              Description
            </label>

            <textarea
              id="edit-project-description"
              value={
                description
              }
              onChange={(
                event,
              ) =>
                setDescription(
                  event
                    .target
                    .value,
                )
              }
              className={`${inputClass} min-h-32 resize-y`}
              maxLength={20000}
            />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-white/[0.06] pt-6">
          <button
            type="button"
            disabled={
              operationalSaving
            }
            onClick={() =>
              persistOperational(
                !archived,
              )
            }
            className="rounded-xl border border-white/10 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/35 transition hover:border-white/20 hover:text-white/65 disabled:opacity-40"
          >
            {archived
              ? "Restore project"
              : "Archive project"}
          </button>

          <button
            type="submit"
            disabled={
              operationalSaving
            }
            className="rounded-xl bg-[#f4f0e8] px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#11110f] transition hover:bg-white disabled:opacity-40"
          >
            {operationalSaving
              ? "Saving..."
              : "Save project"}
          </button>
        </div>
      </form>

      <form
        onSubmit={
          submitPrivate
        }
        className="rounded-2xl border border-[#c8ad84]/15 bg-[#c8ad84]/[0.035] p-6 sm:p-8"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c8ad84]/70">
          Owner only
        </p>

        <h2 className="mt-3 text-xl font-medium tracking-[-0.035em]">
          Financial and private context
        </h2>

        <div className="mt-7 grid gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="edit-project-budget"
              className={labelClass}
            >
              Budget
            </label>

            <input
              id="edit-project-budget"
              type="number"
              min="0"
              step="0.01"
              value={budget}
              onChange={(
                event,
              ) =>
                setBudget(
                  event
                    .target
                    .value,
                )
              }
              className={inputClass}
              placeholder="0.00"
            />
          </div>

          <div>
            <label
              htmlFor="edit-project-currency"
              className={labelClass}
            >
              Currency
            </label>

            <select
              id="edit-project-currency"
              value={currency}
              onChange={(
                event,
              ) =>
                setCurrency(
                  event
                    .target
                    .value,
                )
              }
              className={inputClass}
            >
              {[
                "USD",
                "PHP",
                "AUD",
                "CAD",
                "GBP",
                "EUR",
              ].map(
                (
                  item,
                ) => (
                  <option
                    key={item}
                    value={item}
                    className="bg-[#171714]"
                  >
                    {item}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="edit-project-notes"
              className={labelClass}
            >
              Internal notes
            </label>

            <textarea
              id="edit-project-notes"
              value={
                internalNotes
              }
              onChange={(
                event,
              ) =>
                setInternalNotes(
                  event
                    .target
                    .value,
                )
              }
              className={`${inputClass} min-h-32 resize-y`}
              maxLength={20000}
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end border-t border-[#c8ad84]/10 pt-6">
          <button
            type="submit"
            disabled={
              privateSaving
            }
            className="rounded-xl border border-[#c8ad84]/30 bg-[#c8ad84]/10 px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#ead6b5] transition hover:bg-[#c8ad84]/15 disabled:opacity-40"
          >
            {privateSaving
              ? "Saving..."
              : "Save owner details"}
          </button>
        </div>
      </form>
    </div>
  );
}
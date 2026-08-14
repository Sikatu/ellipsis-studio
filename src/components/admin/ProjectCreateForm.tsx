"use client";

import {
  type FormEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

type ClientOption = {
  id: string;
  brand_name: string;
  contact_name: string | null;
};

type ProjectCreateFormProps = {
  clients:
    ClientOption[];
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

export default function ProjectCreateForm({
  clients,
}: ProjectCreateFormProps) {
  const router =
    useRouter();

  const [
    clientId,
    setClientId,
  ] =
    useState(
      clients[0]
        ?.id ??
        "",
    );

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    projectType,
    setProjectType,
  ] =
    useState(
      "general",
    );

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [
    status,
    setStatus,
  ] =
    useState(
      "planned",
    );

  const [
    priority,
    setPriority,
  ] =
    useState(
      "normal",
    );

  const [
    startDate,
    setStartDate,
  ] =
    useState("");

  const [
    targetDate,
    setTargetDate,
  ] =
    useState("");

  const [
    progress,
    setProgress,
  ] =
    useState(
      "0",
    );

  const [
    budget,
    setBudget,
  ] =
    useState("");

  const [
    currency,
    setCurrency,
  ] =
    useState(
      "USD",
    );

  const [
    internalNotes,
    setInternalNotes,
  ] =
    useState("");

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (saving) {
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

    setSaving(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/admin/projects",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                clientId,
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
              project?: {
                id:
                  string;
              };
            }
          | null;

      if (
        !response.ok ||
        !payload
          ?.project
          ?.id
      ) {
        setError(
          payload
            ?.error ??
            "Could not create project.",
        );

        return;
      }

      router.push(
        `/admin/projects/${payload.project.id}`,
      );

      router.refresh();
    }
    catch {
      setError(
        "Could not create project.",
      );
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-12 space-y-8"
    >
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c8ad84]/60">
            Project identity
          </p>

          <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em]">
            Define the work.
          </h2>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <label
              htmlFor="project-client"
              className={labelClass}
            >
              Client
            </label>

            <select
              id="project-client"
              value={clientId}
              onChange={(
                event,
              ) =>
                setClientId(
                  event
                    .target
                    .value,
                )
              }
              className={inputClass}
              required
            >
              {clients.map(
                (
                  client,
                ) => (
                  <option
                    key={
                      client.id
                    }
                    value={
                      client.id
                    }
                    className="bg-[#171714]"
                  >
                    {
                      client.brand_name
                    }
                    {client.contact_name
                      ? ` — ${client.contact_name}`
                      : ""}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="project-title"
              className={labelClass}
            >
              Project title
            </label>

            <input
              id="project-title"
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
              placeholder="Website redesign"
              maxLength={240}
              required
            />
          </div>

          <div>
            <label
              htmlFor="project-type"
              className={labelClass}
            >
              Project type
            </label>

            <input
              id="project-type"
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
              placeholder="website"
              maxLength={80}
              required
            />
          </div>

          <div>
            <label
              htmlFor="project-priority"
              className={labelClass}
            >
              Priority
            </label>

            <select
              id="project-priority"
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
              <option
                value="low"
                className="bg-[#171714]"
              >
                Low
              </option>

              <option
                value="normal"
                className="bg-[#171714]"
              >
                Normal
              </option>

              <option
                value="high"
                className="bg-[#171714]"
              >
                High
              </option>

              <option
                value="urgent"
                className="bg-[#171714]"
              >
                Urgent
              </option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="project-description"
              className={labelClass}
            >
              Description
            </label>

            <textarea
              id="project-description"
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
              placeholder="Scope, intended outcome, and important context."
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c8ad84]/60">
          Schedule
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label
              htmlFor="project-status"
              className={labelClass}
            >
              Status
            </label>

            <select
              id="project-status"
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
              <option
                value="planned"
                className="bg-[#171714]"
              >
                Planned
              </option>

              <option
                value="active"
                className="bg-[#171714]"
              >
                Active
              </option>

              <option
                value="on_hold"
                className="bg-[#171714]"
              >
                On hold
              </option>

              <option
                value="completed"
                className="bg-[#171714]"
              >
                Completed
              </option>

              <option
                value="cancelled"
                className="bg-[#171714]"
              >
                Cancelled
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="project-progress"
              className={labelClass}
            >
              Progress %
            </label>

            <input
              id="project-progress"
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

          <div>
            <label
              htmlFor="project-start"
              className={labelClass}
            >
              Start date
            </label>

            <input
              id="project-start"
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
              htmlFor="project-target"
              className={labelClass}
            >
              Target date
            </label>

            <input
              id="project-target"
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
        </div>
      </section>

      <section className="rounded-2xl border border-[#c8ad84]/15 bg-[#c8ad84]/[0.035] p-6 sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c8ad84]/70">
          Owner only
        </p>

        <h2 className="mt-3 text-xl font-medium tracking-[-0.035em]">
          Financial and private context.
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/35">
          These fields are stored separately from the operational project record so future VA access does not expose private financial information.
        </p>

        <div className="mt-7 grid gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="project-budget"
              className={labelClass}
            >
              Budget
            </label>

            <input
              id="project-budget"
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
              htmlFor="project-currency"
              className={labelClass}
            >
              Currency
            </label>

            <select
              id="project-currency"
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
              htmlFor="project-internal-notes"
              className={labelClass}
            >
              Internal notes
            </label>

            <textarea
              id="project-internal-notes"
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
              placeholder="Private commercial notes, sensitivities, or context."
            />
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200/80"
        >
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            saving ||
            !clientId
          }
          className="rounded-xl bg-[#f4f0e8] px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#11110f] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving
            ? "Creating..."
            : "Create project"}
        </button>
      </div>
    </form>
  );
}
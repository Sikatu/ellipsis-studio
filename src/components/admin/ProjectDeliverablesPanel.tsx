"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";


type SourceKind =
  | "file"
  | "external_url";


type ReviewStatus =
  | "not_started"
  | "in_review"
  | "changes_requested"
  | "reviewed";


type ApprovalStatus =
  | "not_requested"
  | "pending"
  | "approved"
  | "rejected";


type ProjectDeliverable = {
  id: string;
  project_id: string;
  created_by: string;
  title: string;
  description: string;
  deliverable_type: string;
  source_kind: SourceKind;
  version_number: number;
  review_status: ReviewStatus;
  approval_status: ApprovalStatus;
  external_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  filename: string | null;
  mime_type: string | null;
  byte_size: number | null;
  sha256: string | null;
  approved_at: string | null;
  delivered_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};


type Props = {
  projectId: string;
  archived: boolean;
  initialDeliverables:
    ProjectDeliverable[];
};


type UploadTicket = {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  expiresInSeconds: number;
};


const reviewLabels:
  Record<
    ReviewStatus,
    string
  > = {
    not_started:
      "Not started",

    in_review:
      "In review",

    changes_requested:
      "Changes requested",

    reviewed:
      "Reviewed",
  };


const approvalLabels:
  Record<
    ApprovalStatus,
    string
  > = {
    not_requested:
      "Not requested",

    pending:
      "Pending",

    approved:
      "Approved",

    rejected:
      "Rejected",
  };


function formatDateTime(
  value:
    string |
    null,
) {
  if (!value) {
    return "Not yet";
  }

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


function formatBytes(
  value:
    number |
    null,
) {
  if (
    value ===
      null ||
    value < 0
  ) {
    return "Unknown size";
  }

  if (
    value <
      1024
  ) {
    return `${value} B`;
  }

  if (
    value <
      1024 * 1024
  ) {
    return `${(
      value /
      1024
    ).toFixed(1)} KB`;
  }

  return `${(
    value /
    (
      1024 *
      1024
    )
  ).toFixed(1)} MB`;
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
        "The deliverable request failed.",
      ),
    );
  }

  return payload;
}


function DeliverableEditor({
  projectId,
  archived,
  deliverable,
}: {
  projectId: string;
  archived: boolean;
  deliverable:
    ProjectDeliverable;
}) {
  const router =
    useRouter();

  const [
    title,
    setTitle,
  ] =
    useState(
      deliverable.title,
    );

  const [
    description,
    setDescription,
  ] =
    useState(
      deliverable.description,
    );

  const [
    deliverableType,
    setDeliverableType,
  ] =
    useState(
      deliverable
        .deliverable_type,
    );

  const [
    versionNumber,
    setVersionNumber,
  ] =
    useState(
      deliverable
        .version_number,
    );

  const [
    reviewStatus,
    setReviewStatus,
  ] =
    useState<
      ReviewStatus
    >(
      deliverable
        .review_status,
    );

  const [
    approvalStatus,
    setApprovalStatus,
  ] =
    useState<
      ApprovalStatus
    >(
      deliverable
        .approval_status,
    );

  const [
    externalUrl,
    setExternalUrl,
  ] =
    useState(
      deliverable
        .external_url ??
      "",
    );

  const [
    delivered,
    setDelivered,
  ] =
    useState(
      Boolean(
        deliverable
          .delivered_at,
      ),
    );

  const [
    sortOrder,
    setSortOrder,
  ] =
    useState(
      deliverable
        .sort_order,
    );

  const [
    busy,
    setBusy,
  ] =
    useState(
      false,
    );

  const [
    downloading,
    setDownloading,
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


  async function save() {
    if (
      archived ||
      busy
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
      await requestJson(
        `/api/admin/projects/${projectId}/deliverables/${deliverable.id}`,
        {
          method:
            "PUT",

          body:
            JSON.stringify({
              title,

              description,

              deliverableType,

              versionNumber,

              reviewStatus,

              approvalStatus,

              externalUrl:
                deliverable
                  .source_kind ===
                    "external_url"
                  ? externalUrl
                  : undefined,

              sourceKind:
                deliverable
                  .source_kind,

              delivered,

              sortOrder,
            }),
        },
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
          : "Could not save the deliverable.",
      );
    }
    finally {
      setBusy(
        false,
      );
    }
  }


  async function download() {
    if (
      deliverable
        .source_kind !==
          "file" ||
      downloading
    ) {
      return;
    }

    setDownloading(
      true,
    );

    setError(
      "",
    );

    try {
      const payload =
        await requestJson(
          `/api/admin/projects/${projectId}/deliverables/${deliverable.id}/download`,
          {
            method:
              "GET",
          },
        ) as {
          download?: {
            url?: string;
          };
        };

      const url =
        payload
          .download
          ?.url;

      if (!url) {
        throw new Error(
          "The private download URL was not returned.",
        );
      }

      window.location.assign(
        url,
      );
    }
    catch (
      requestError
    ) {
      setError(
        requestError instanceof
          Error
          ? requestError.message
          : "Could not create the private download.",
      );
    }
    finally {
      setDownloading(
        false,
      );
    }
  }


  function openExternal() {
    if (
      deliverable
        .source_kind !==
          "external_url" ||
      !deliverable
        .external_url
    ) {
      return;
    }

    window.open(
      deliverable.external_url,
      "_blank",
      "noopener,noreferrer",
    );
  }


  return (
    <article className="rounded-2xl border border-white/[0.07] bg-black/[0.08] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#c8ad84]/15 bg-[#c8ad84]/[0.04] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-[#ead6b5]/55">
              {
                deliverable
                  .source_kind ===
                    "file"
                  ? "Private file"
                  : "External URL"
              }
            </span>

            <span className="rounded-full border border-white/[0.07] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/28">
              v{
                deliverable
                  .version_number
              }
            </span>

            <span className="rounded-full border border-white/[0.07] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/28">
              {
                reviewLabels[
                  deliverable
                    .review_status
                ]
              }
            </span>

            <span className="rounded-full border border-white/[0.07] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/28">
              {
                approvalLabels[
                  deliverable
                    .approval_status
                ]
              }
            </span>
          </div>

          <h3 className="mt-4 text-lg font-medium tracking-[-0.025em]">
            {
              deliverable.title
            }
          </h3>

          <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/22">
            {
              deliverable
                .deliverable_type
            }
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {
            deliverable
              .source_kind ===
                "file" && (
              <button
                type="button"
                onClick={
                  download
                }
                disabled={
                  downloading
                }
                className="rounded-full border border-white/[0.09] px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.11em] text-white/45 transition hover:border-white/20 hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {
                  downloading
                    ? "Preparing..."
                    : "Download"
                }
              </button>
            )
          }

          {
            deliverable
              .source_kind ===
                "external_url" && (
              <button
                type="button"
                onClick={
                  openExternal
                }
                className="rounded-full border border-white/[0.09] px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.11em] text-white/45 transition hover:border-white/20 hover:text-white/75"
              >
                Open link
              </button>
            )
          }
        </div>
      </div>

      {
        deliverable
          .source_kind ===
            "file" && (
          <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
            <p className="truncate text-xs text-white/48">
              {
                deliverable
                  .filename ??
                "Stored file"
              }
            </p>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-white/24">
              <span>
                {
                  formatBytes(
                    deliverable
                      .byte_size,
                  )
                }
              </span>

              <span>
                {
                  deliverable
                    .mime_type ??
                  "Unknown MIME type"
                }
              </span>
            </div>
          </div>
        )
      }

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/28">
            Title
          </span>

          <input
            value={
              title
            }
            onChange={
              (
                event,
              ) =>
                setTitle(
                  event
                    .target
                    .value,
                )
            }
            disabled={
              archived
            }
            className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white/75 outline-none transition focus:border-[#c8ad84]/35 disabled:cursor-not-allowed disabled:opacity-40"
          />
        </label>

        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/28">
            Type
          </span>

          <input
            value={
              deliverableType
            }
            onChange={
              (
                event,
              ) =>
                setDeliverableType(
                  event
                    .target
                    .value,
                )
            }
            disabled={
              archived
            }
            placeholder="general"
            className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white/75 outline-none transition focus:border-[#c8ad84]/35 disabled:cursor-not-allowed disabled:opacity-40"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/28">
          Description
        </span>

        <textarea
          value={
            description
          }
          onChange={
            (
              event,
            ) =>
              setDescription(
                event
                  .target
                  .value,
              )
          }
          disabled={
            archived
          }
          rows={
            3
          }
          className="mt-2 w-full resize-y rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm leading-6 text-white/65 outline-none transition focus:border-[#c8ad84]/35 disabled:cursor-not-allowed disabled:opacity-40"
        />
      </label>

      {
        deliverable
          .source_kind ===
            "external_url" && (
          <label className="mt-4 block">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/28">
              External URL
            </span>

            <input
              type="url"
              value={
                externalUrl
              }
              onChange={
                (
                  event,
                ) =>
                  setExternalUrl(
                    event
                      .target
                      .value,
                  )
              }
              disabled={
                archived
              }
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white/65 outline-none transition focus:border-[#c8ad84]/35 disabled:cursor-not-allowed disabled:opacity-40"
            />
          </label>
        )
      }

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/28">
            Version
          </span>

          <input
            type="number"
            min={
              1
            }
            value={
              versionNumber
            }
            onChange={
              (
                event,
              ) =>
                setVersionNumber(
                  Number(
                    event
                      .target
                      .value,
                  ),
                )
            }
            disabled={
              archived
            }
            className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white/65 outline-none transition focus:border-[#c8ad84]/35 disabled:cursor-not-allowed disabled:opacity-40"
          />
        </label>

        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/28">
            Review
          </span>

          <select
            value={
              reviewStatus
            }
            onChange={
              (
                event,
              ) =>
                setReviewStatus(
                  event
                    .target
                    .value as
                    ReviewStatus,
                )
            }
            disabled={
              archived
            }
            className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#11110f] px-4 py-3 text-sm text-white/65 outline-none transition focus:border-[#c8ad84]/35 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {
              (
                Object.keys(
                  reviewLabels,
                ) as
                  ReviewStatus[]
              ).map(
                (
                  status,
                ) => (
                  <option
                    key={
                      status
                    }
                    value={
                      status
                    }
                  >
                    {
                      reviewLabels[
                        status
                      ]
                    }
                  </option>
                ),
              )
            }
          </select>
        </label>

        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/28">
            Approval
          </span>

          <select
            value={
              approvalStatus
            }
            onChange={
              (
                event,
              ) =>
                setApprovalStatus(
                  event
                    .target
                    .value as
                    ApprovalStatus,
                )
            }
            disabled={
              archived
            }
            className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#11110f] px-4 py-3 text-sm text-white/65 outline-none transition focus:border-[#c8ad84]/35 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {
              (
                Object.keys(
                  approvalLabels,
                ) as
                  ApprovalStatus[]
              ).map(
                (
                  status,
                ) => (
                  <option
                    key={
                      status
                    }
                    value={
                      status
                    }
                  >
                    {
                      approvalLabels[
                        status
                      ]
                    }
                  </option>
                ),
              )
            }
          </select>
        </label>

        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/28">
            Order
          </span>

          <input
            type="number"
            min={
              0
            }
            value={
              sortOrder
            }
            onChange={
              (
                event,
              ) =>
                setSortOrder(
                  Number(
                    event
                      .target
                      .value,
                  ),
                )
            }
            disabled={
              archived
            }
            className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white/65 outline-none transition focus:border-[#c8ad84]/35 disabled:cursor-not-allowed disabled:opacity-40"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-col gap-4 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-[10px] text-white/25">
          <p>
            Approved:{" "}
            {
              formatDateTime(
                deliverable
                  .approved_at,
              )
            }
          </p>

          <p>
            Delivered:{" "}
            {
              formatDateTime(
                deliverable
                  .delivered_at,
              )
            }
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/38">
            <input
              type="checkbox"
              checked={
                delivered
              }
              onChange={
                (
                  event,
                ) =>
                  setDelivered(
                    event
                      .target
                      .checked,
                  )
              }
              disabled={
                archived
              }
            />

            Delivered
          </label>

          <button
            type="button"
            onClick={
              save
            }
            disabled={
              archived ||
              busy
            }
            className="rounded-full border border-[#c8ad84]/25 bg-[#c8ad84]/[0.06] px-5 py-2.5 text-[9px] font-semibold uppercase tracking-[0.11em] text-[#ead6b5]/75 transition hover:border-[#c8ad84]/40 hover:bg-[#c8ad84]/[0.1] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {
              busy
                ? "Saving..."
                : "Save"
            }
          </button>
        </div>
      </div>

      {
        error && (
          <p className="mt-4 text-xs leading-5 text-red-300/75">
            {
              error
            }
          </p>
        )
      }
    </article>
  );
}


export default function ProjectDeliverablesPanel({
  projectId,
  archived,
  initialDeliverables,
}: Props) {
  const router =
    useRouter();

  const [
    sourceKind,
    setSourceKind,
  ] =
    useState<
      SourceKind
    >(
      "external_url",
    );

  const [
    title,
    setTitle,
  ] =
    useState(
      "",
    );

  const [
    description,
    setDescription,
  ] =
    useState(
      "",
    );

  const [
    deliverableType,
    setDeliverableType,
  ] =
    useState(
      "general",
    );

  const [
    externalUrl,
    setExternalUrl,
  ] =
    useState(
      "",
    );

  const [
    file,
    setFile,
  ] =
    useState<
      File |
      null
    >(
      null,
    );

  const [
    versionNumber,
    setVersionNumber,
  ] =
    useState(
      1,
    );

  const [
    sortOrder,
    setSortOrder,
  ] =
    useState(
      0,
    );

  const [
    creating,
    setCreating,
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

  const [
    notice,
    setNotice,
  ] =
    useState(
      "",
    );


  const metrics =
    useMemo(
      () => {
        const pending =
          initialDeliverables
            .filter(
              (
                deliverable,
              ) =>
                deliverable
                  .approval_status ===
                  "pending",
            )
            .length;

        const approved =
          initialDeliverables
            .filter(
              (
                deliverable,
              ) =>
                deliverable
                  .approval_status ===
                  "approved",
            )
            .length;

        const delivered =
          initialDeliverables
            .filter(
              (
                deliverable,
              ) =>
                Boolean(
                  deliverable
                    .delivered_at,
                ),
            )
            .length;

        return {
          total:
            initialDeliverables
              .length,

          pending,

          approved,

          delivered,
        };
      },
      [
        initialDeliverables,
      ],
    );


  function resetCreateForm() {
    setTitle(
      "",
    );

    setDescription(
      "",
    );

    setDeliverableType(
      "general",
    );

    setExternalUrl(
      "",
    );

    setFile(
      null,
    );

    setVersionNumber(
      1,
    );

    setSortOrder(
      0,
    );
  }


  async function createDeliverable() {
    if (
      archived ||
      creating
    ) {
      return;
    }

    setError(
      "",
    );

    setNotice(
      "",
    );

    if (!title.trim()) {
      setError(
        "Enter a deliverable title.",
      );

      return;
    }

    setCreating(
      true,
    );

    try {
      if (
        sourceKind ===
          "external_url"
      ) {
        await requestJson(
          `/api/admin/projects/${projectId}/deliverables`,
          {
            method:
              "POST",

            body:
              JSON.stringify({
                title,

                description,

                deliverableType,

                sourceKind:
                  "external_url",

                versionNumber,

                reviewStatus:
                  "not_started",

                approvalStatus:
                  "not_requested",

                externalUrl,

                delivered:
                  false,

                sortOrder,
              }),
          },
        );
      }
      else {
        if (!file) {
          throw new Error(
            "Choose a file to upload.",
          );
        }

        const mimeType =
          file.type ||
          "application/octet-stream";

        const ticketPayload =
          await requestJson(
            `/api/admin/projects/${projectId}/deliverables/upload`,
            {
              method:
                "POST",

              body:
                JSON.stringify({
                  filename:
                    file.name,

                  mimeType,

                  byteSize:
                    file.size,
                }),
            },
          ) as {
            upload?:
              UploadTicket;
          };

        const ticket =
          ticketPayload
            .upload;

        if (
          !ticket ||
          !ticket.bucket ||
          !ticket.path ||
          !ticket.token
        ) {
          throw new Error(
            "The private upload ticket was incomplete.",
          );
        }

        const supabase =
          createClient();

        const {
          error:
            uploadError,
        } =
          await supabase
            .storage
            .from(
              ticket.bucket,
            )
            .uploadToSignedUrl(
              ticket.path,
              ticket.token,
              file,
              {
                contentType:
                  mimeType,
              },
            );

        if (uploadError) {
          throw new Error(
            uploadError.message,
          );
        }

        await requestJson(
          `/api/admin/projects/${projectId}/deliverables`,
          {
            method:
              "POST",

            body:
              JSON.stringify({
                title,

                description,

                deliverableType,

                sourceKind:
                  "file",

                versionNumber,

                reviewStatus:
                  "not_started",

                approvalStatus:
                  "not_requested",

                delivered:
                  false,

                sortOrder,

                storagePath:
                  ticket.path,

                filename:
                  file.name,

                mimeType,

                byteSize:
                  file.size,
              }),
          },
        );
      }

      resetCreateForm();

      setNotice(
        sourceKind ===
          "file"
          ? "Private file deliverable created."
          : "External deliverable created.",
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
          : "Could not create the deliverable.",
      );
    }
    finally {
      setCreating(
        false,
      );
    }
  }


  return (
    <section className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c8ad84]/55">
            S12.4 / Deliverables & approvals
          </p>

          <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em]">
            Project delivery control
          </h2>

          <p className="mt-3 text-xs leading-6 text-white/30">
            Track private files and external handoff links, versions,
            review state, approval state, and final delivery from one
            project workspace.
          </p>
        </div>

        {
          archived && (
            <div className="rounded-xl border border-white/[0.08] bg-black/15 px-4 py-3 text-xs leading-5 text-white/35">
              Restore this project before creating or changing
              deliverables. Existing files can still be downloaded.
            </div>
          )
        }
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {
          [
            {
              label:
                "Total",
              value:
                metrics.total,
            },
            {
              label:
                "Pending approval",
              value:
                metrics.pending,
            },
            {
              label:
                "Approved",
              value:
                metrics.approved,
            },
            {
              label:
                "Delivered",
              value:
                metrics.delivered,
            },
          ].map(
            (
              metric,
            ) => (
              <article
                key={
                  metric.label
                }
                className="rounded-xl border border-white/[0.06] bg-black/[0.08] p-4"
              >
                <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/22">
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
          )
        }
      </div>

      {
        !archived && (
          <div className="mt-8 rounded-2xl border border-[#c8ad84]/10 bg-[#c8ad84]/[0.025] p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#c8ad84]/50">
                  Add deliverable
                </p>

                <p className="mt-2 text-xs leading-5 text-white/28">
                  Register an external handoff link or upload a private
                  project file up to 50 MB.
                </p>
              </div>

              <div className="inline-flex rounded-full border border-white/[0.08] bg-black/15 p-1">
                <button
                  type="button"
                  onClick={
                    () =>
                      setSourceKind(
                        "external_url",
                      )
                  }
                  className={
                    sourceKind ===
                      "external_url"
                      ? "rounded-full bg-white/[0.08] px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/70"
                      : "rounded-full px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/28"
                  }
                >
                  External URL
                </button>

                <button
                  type="button"
                  onClick={
                    () =>
                      setSourceKind(
                        "file",
                      )
                  }
                  className={
                    sourceKind ===
                      "file"
                      ? "rounded-full bg-white/[0.08] px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/70"
                      : "rounded-full px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/28"
                  }
                >
                  Private file
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/28">
                  Title
                </span>

                <input
                  value={
                    title
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setTitle(
                        event
                          .target
                          .value,
                      )
                  }
                  placeholder="Final brand presentation"
                  className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white/75 outline-none transition focus:border-[#c8ad84]/35"
                />
              </label>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/28">
                  Type
                </span>

                <input
                  value={
                    deliverableType
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setDeliverableType(
                        event
                          .target
                          .value,
                      )
                  }
                  placeholder="presentation"
                  className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white/75 outline-none transition focus:border-[#c8ad84]/35"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/28">
                Description
              </span>

              <textarea
                value={
                  description
                }
                onChange={
                  (
                    event,
                  ) =>
                    setDescription(
                      event
                        .target
                        .value,
                    )
                }
                rows={
                  3
                }
                placeholder="What this deliverable contains and what the client should review."
                className="mt-2 w-full resize-y rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm leading-6 text-white/65 outline-none transition focus:border-[#c8ad84]/35"
              />
            </label>

            {
              sourceKind ===
                "external_url"
                ? (
                  <label
                    key="external-url-source"
                    className="mt-4 block"
                  >
                    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/28">
                      External URL
                    </span>

                    <input
                      type="url"
                      value={
                        externalUrl
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          setExternalUrl(
                            event
                              .target
                              .value,
                          )
                      }
                      placeholder="https://..."
                      className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white/65 outline-none transition focus:border-[#c8ad84]/35"
                    />
                  </label>
                )
                : (
                  <label
                    key="private-file-source"
                    className="mt-4 block"
                  >
                    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/28">
                      Private project file
                    </span>

                    <input
                      type="file"
                      onChange={
                        (
                          event,
                        ) =>
                          setFile(
                            event
                              .target
                              .files
                              ?.[0] ??
                            null,
                          )
                      }
                      className="mt-2 block w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-xs text-white/50 file:mr-4 file:rounded-full file:border-0 file:bg-white/[0.08] file:px-4 file:py-2 file:text-[9px] file:font-semibold file:uppercase file:tracking-[0.1em] file:text-white/60"
                    />

                    {
                      file && (
                        <p className="mt-2 text-[10px] text-white/25">
                          {
                            file.name
                          }{" "}
                          /{" "}
                          {
                            formatBytes(
                              file.size,
                            )
                          }
                        </p>
                      )
                    }
                  </label>
                )
            }

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/28">
                  Version
                </span>

                <input
                  type="number"
                  min={
                    1
                  }
                  value={
                    versionNumber
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setVersionNumber(
                        Number(
                          event
                            .target
                            .value,
                        ),
                      )
                  }
                  className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white/65 outline-none transition focus:border-[#c8ad84]/35"
                />
              </label>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/28">
                  Order
                </span>

                <input
                  type="number"
                  min={
                    0
                  }
                  value={
                    sortOrder
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setSortOrder(
                        Number(
                          event
                            .target
                            .value,
                        ),
                      )
                  }
                  className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white/65 outline-none transition focus:border-[#c8ad84]/35"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {
                  error && (
                    <p className="text-xs leading-5 text-red-300/75">
                      {
                        error
                      }
                    </p>
                  )
                }

                {
                  notice && (
                    <p className="text-xs leading-5 text-[#c8ad84]/65">
                      {
                        notice
                      }
                    </p>
                  )
                }
              </div>

              <button
                type="button"
                onClick={
                  createDeliverable
                }
                disabled={
                  creating
                }
                className="rounded-full border border-[#c8ad84]/25 bg-[#c8ad84]/[0.07] px-6 py-3 text-[9px] font-semibold uppercase tracking-[0.11em] text-[#ead6b5]/80 transition hover:border-[#c8ad84]/45 hover:bg-[#c8ad84]/[0.11] disabled:cursor-not-allowed disabled:opacity-35"
              >
                {
                  creating
                    ? (
                        sourceKind ===
                          "file"
                          ? "Uploading..."
                          : "Creating..."
                      )
                    : "Add deliverable"
                }
              </button>
            </div>
          </div>
        )
      }

      {
        initialDeliverables
          .length ===
          0
          ? (
            <div className="mt-8 rounded-2xl border border-dashed border-white/[0.08] px-6 py-10 text-center">
              <p className="text-sm text-white/32">
                No project deliverables yet.
              </p>

              <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-white/20">
                Add the first private file or external handoff URL when
                project output is ready for tracking.
              </p>
            </div>
          )
          : (
            <div className="mt-8 space-y-4">
              {
                initialDeliverables
                  .map(
                    (
                      deliverable,
                    ) => (
                      <DeliverableEditor
                        key={`${deliverable.id}:${deliverable.updated_at}`}
                        projectId={
                          projectId
                        }
                        archived={
                          archived
                        }
                        deliverable={
                          deliverable
                        }
                      />
                    ),
                  )
              }
            </div>
          )
      }
    </section>
  );
}
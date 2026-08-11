"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type Receipt = {
  report_number: number;
  filename: string;
  file_sha256: string;
  acknowledgment: string;
  accepted_at: string;
};

type ReceiptPayload = {
  downloadedAt:
    | string
    | null;
  receipt:
    Receipt | null;
  error?: string;
};

function formatDate(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl
    .DateTimeFormat(
      "en",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      },
    )
    .format(date);
}

function shortHash(
  value: string,
) {
  return value.length <= 30
    ? value
    : `${value.slice(0, 16)}...${value.slice(-12)}`;
}

export default function BrandDeliveryReceipt({
  token,
  fileId,
  reportNumber,
}: {
  token: string;
  fileId: string;
  reportNumber: number;
}) {
  const [
    downloadedAt,
    setDownloadedAt,
  ] =
    useState<
      string | null
    >(null);

  const [
    receipt,
    setReceipt,
  ] =
    useState<
      Receipt | null
    >(null);

  const [
    acknowledgment,
    setAcknowledgment,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const load =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              `/api/delivery/${token}/accept?fileId=${encodeURIComponent(
                fileId,
              )}`,
              { cache: "no-store" },
            );

          const payload =
            await response.json() as
              ReceiptPayload;

          if (!response.ok) {
            throw new Error(
              payload.error ||
                "Could not load delivery receipt.",
            );
          }

          setDownloadedAt(
            payload.downloadedAt ??
              null,
          );
          setReceipt(
            payload.receipt ??
              null,
          );

          if (
            payload.receipt
          ) {
            setAcknowledgment(
              payload.receipt
                .acknowledgment,
            );
          }

          setError(null);
        }
        catch (
          loadError
        ) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load delivery receipt.",
          );
        }
        finally {
          setLoading(false);
        }
      },
      [
        fileId,
        token,
      ],
    );

  useEffect(
    () => {
      const timer =
        window.setTimeout(
          () => {
            void load();
          },
          0,
        );

      return () =>
        window.clearTimeout(
          timer,
        );
    },
    [
      load,
    ],
  );

  function refreshAfterDownload() {
    window.setTimeout(
      () => {
        void load();
      },
      1400,
    );
  }

  async function acceptReceipt() {
    setBusy(true);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/delivery/${token}/accept`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                fileId,
                acknowledgment,
              }),
          },
        );

      const payload =
        await response.json() as
          ReceiptPayload;

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Could not acknowledge receipt.",
        );
      }

      setDownloadedAt(
        payload.downloadedAt ??
          null,
      );
      setReceipt(
        payload.receipt ??
          null,
      );
    }
    catch (
      actionError
    ) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not acknowledge receipt.",
      );
    }
    finally {
      setBusy(false);
    }
  }

  const downloadHref =
    `/api/delivery/${token}/download?fileId=${encodeURIComponent(
      fileId,
    )}`;

  if (receipt) {
    return (
      <div className="w-full max-w-[330px] rounded-xl border border-emerald-300/10 bg-emerald-300/[0.025] p-4">
        <p className="text-[9px] font-semibold tracking-[0.13em] text-emerald-200/55 uppercase">
          Receipt acknowledged
        </p>

        <p className="mt-2 text-xs leading-5 text-white/55">
          Report {
            String(
              receipt.report_number,
            ).padStart(2, "0")
          } was acknowledged on {
            formatDate(
              receipt.accepted_at,
            )
          }.
        </p>

        {receipt.acknowledgment && (
          <p className="mt-3 border-l border-white/10 pl-3 text-[10px] leading-5 text-white/30">
            {
              receipt.acknowledgment
            }
          </p>
        )}

        <p className="mt-3 font-mono text-[9px] leading-5 text-white/18">
          {
            shortHash(
              receipt.file_sha256,
            )
          }
        </p>

        <a
          href={downloadHref}
          onClick={
            refreshAfterDownload
          }
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-[10px] text-white/45 transition hover:border-white/20 hover:text-white/70"
        >
          Download again
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[330px]">
      <a
        href={downloadHref}
        onClick={
          refreshAfterDownload
        }
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#f4f0e8] px-6 py-3 text-xs font-semibold text-[#11110f] transition hover:bg-white"
      >
        Download PDF
      </a>

      <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/10 p-4">
        <p className="text-[9px] font-semibold tracking-[0.13em] text-white/25 uppercase">
          Delivery receipt
        </p>

        <p className="mt-2 text-[10px] leading-5 text-white/28">
          After downloading Report {
            String(
              reportNumber,
            ).padStart(2, "0")
          }, acknowledge that you received the issued document.
        </p>

        <textarea
          value={acknowledgment}
          onChange={(
            event,
          ) =>
            setAcknowledgment(
              event.target.value,
            )
          }
          maxLength={1000}
          rows={3}
          placeholder="Optional note to ELLIPSIS..."
          className="mt-3 w-full resize-y rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2.5 text-[10px] leading-5 text-white/55 outline-none transition placeholder:text-white/15 focus:border-[#c5a577]/30"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={
              busy ||
              loading
            }
            onClick={() =>
              void acceptReceipt()
            }
            className="rounded-lg border border-[#c5a577]/20 bg-[#c5a577]/[0.05] px-4 py-2.5 text-[10px] font-semibold text-[#d9bd94] transition hover:border-[#c5a577]/35 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {
              busy
                ? "Recording..."
                : "Acknowledge receipt"
            }
          </button>

          <button
            type="button"
            onClick={() =>
              void load()
            }
            className="px-2 py-2 text-[9px] text-white/20 transition hover:text-white/45"
          >
            Check download status
          </button>
        </div>

        <p className="mt-3 text-[9px] leading-4 text-white/18">
          {
            downloadedAt
              ? `Verified download: ${formatDate(
                  downloadedAt,
                )}`
              : "A verified PDF download is required before the receipt can be recorded."
          }
        </p>

        <p className="mt-2 text-[9px] leading-4 text-white/15">
          This is an operational delivery acknowledgment, not an electronic signature or acceptance of contractual terms.
        </p>

        {error && (
          <p className="mt-3 rounded-lg border border-red-300/10 bg-red-300/[0.03] px-3 py-2 text-[9px] leading-5 text-red-100/60">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
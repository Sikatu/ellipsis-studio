import "server-only";

import {
  createElement,
} from "react";

import {
  renderToBuffer,
} from "@react-pdf/renderer";

import BrandStrategyPdfDocument from "@/components/pdf/BrandStrategyPdfDocument";

import {
  isAIStrategyOutput,
} from "@/lib/final-strategy";

import {
  normalizeReportConfiguration,
} from "@/lib/report-production";

export function safeFilenamePart(
  value: string,
) {
  const normalized =
    value
      .normalize(
        "NFKD",
      )
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-",
      )
      .replace(
        /-+/g,
        "-",
      )
      .replace(
        /^[-_.]+|[-_.]+$/g,
        "",
      )
      .slice(
        0,
        80,
      );

  return normalized || "brand";
}

export function buildReportPdfFilename({
  brandName,
  reportNumber,
  sourceStrategyVersionNumber,
}: {
  brandName: string;

  reportNumber: number;

  sourceStrategyVersionNumber:
    number;
}) {
  return [
    "ELLIPSIS",
    safeFilenamePart(
      brandName,
    ),
    `Report-${reportNumber}`,
    `Strategy-v${sourceStrategyVersionNumber}`,
  ].join("-") + ".pdf";
}

export async function renderStrategyReportPdf({
  brandName,
  reportNumber,
  status,
  sourceStrategyVersionNumber,
  strategySnapshot,
  configuration,
  issuedAt,
  updatedAt,
}: {
  brandName: string;

  reportNumber: number;

  status:
    | "ready"
    | "issued";

  sourceStrategyVersionNumber:
    number;

  strategySnapshot:
    unknown;

  configuration:
    unknown;

  issuedAt:
    | string
    | null;

  updatedAt: string;
}) {
  if (
    !isAIStrategyOutput(
      strategySnapshot,
    )
  ) {
    throw new Error(
      "Production report strategy snapshot is invalid.",
    );
  }

  const normalizedConfiguration =
    normalizeReportConfiguration(
      configuration,
      brandName,
    );

  const document =
    createElement(
      BrandStrategyPdfDocument,
      {
        brandName,

        reportNumber,

        status,

        sourceStrategyVersionNumber,

        strategy:
          strategySnapshot,

        configuration:
          normalizedConfiguration,

        issuedAt,

        updatedAt,
      },
    );

  const buffer =
    await renderToBuffer(
      document as unknown as Parameters<
        typeof renderToBuffer
      >[0],
    );

  if (
    buffer.length <
    500
  ) {
    throw new Error(
      "Generated PDF was unexpectedly small.",
    );
  }

  return {
    buffer,

    configuration:
      normalizedConfiguration,
  };
}
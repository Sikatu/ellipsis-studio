import "server-only";

import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  normalizeReportConfiguration,
} from "@/lib/report-production";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const DELIVERY_TOKEN_BYTES =
  32;

export const DELIVERY_TOKEN_PATTERN =
  /^[0-9a-f]{64}$/;

export type DeliveryPortalItem = {
  fileId: string;

  reportId: string;

  reportNumber: number;

  reportTitle: string;

  reportSubtitle: string;

  sourceStrategyVersionNumber:
    number;

  issuedAt: string;

  filename: string;

  mimeType: string;

  byteSize: number;

  sha256: string;

  storageBucket: string;

  storagePath: string;
};

export type DeliveryPortalContext = {
  accessId: string;

  tokenVersion: number;

  projectId: string;

  brandName: string;

  projectTitle: string;

  deliverables:
    DeliveryPortalItem[];
};

export function createDeliveryToken() {
  return randomBytes(
    DELIVERY_TOKEN_BYTES,
  ).toString(
    "hex",
  );
}

export function hashDeliveryToken(
  token: string,
) {
  return createHash(
    "sha256",
  )
    .update(
      token,
      "utf8",
    )
    .digest(
      "hex",
    );
}

export function isDeliveryToken(
  token: string,
) {
  return DELIVERY_TOKEN_PATTERN.test(
    token,
  );
}

export async function loadDeliveryPortal(
  token: string,
  {
    touchAccess =
      true,
  }: {
    touchAccess?:
      boolean;
  } = {},
): Promise<
  DeliveryPortalContext | null
> {
  if (
    !isDeliveryToken(
      token,
    )
  ) {
    return null;
  }

  const admin =
    createAdminClient();

  const tokenHash =
    hashDeliveryToken(
      token,
    );

  const {
    data: access,
    error:
      accessError,
  } =
    await admin
      .from(
        "client_delivery_access",
      )
      .select(
        "id,project_id,status,token_version,expires_at,last_accessed_at,last_downloaded_at",
      )
      .eq(
        "token_hash",
        tokenHash,
      )
      .eq(
        "status",
        "active",
      )
      .maybeSingle();

  if (
    accessError ||
    !access
  ) {
    return null;
  }

  if (
    access.expires_at &&
    new Date(
      access.expires_at,
    ).getTime() <=
      Date.now()
  ) {
    return null;
  }

  const {
    data: project,
    error:
      projectError,
  } =
    await admin
      .from(
        "discovery_projects",
      )
      .select(
        "id,client_id,title",
      )
      .eq(
        "id",
        access.project_id,
      )
      .maybeSingle();

  if (
    projectError ||
    !project
  ) {
    return null;
  }

  const {
    data: client,
    error:
      clientError,
  } =
    await admin
      .from(
        "clients",
      )
      .select(
        "id,brand_name",
      )
      .eq(
        "id",
        project.client_id,
      )
      .maybeSingle();

  if (
    clientError ||
    !client
  ) {
    return null;
  }

  const {
    data: reports,
    error:
      reportsError,
  } =
    await admin
      .from(
        "strategy_reports",
      )
      .select(
        "id,report_number,status,source_strategy_version_number,configuration,issued_at",
      )
      .eq(
        "project_id",
        project.id,
      )
      .eq(
        "status",
        "issued",
      )
      .order(
        "report_number",
        {
          ascending:
            false,
        },
      );

  if (
    reportsError
  ) {
    throw new Error(
      reportsError.message,
    );
  }

  const reportRows =
    reports ?? [];

  const reportIds =
    reportRows.map(
      (report) =>
        report.id,
    );

  let fileRows:
    Array<{
      id: string;

      report_id: string;

      report_number: number;

      filename: string;

      mime_type: string;

      byte_size: number;

      sha256: string;

      storage_bucket: string;

      storage_path: string;

      source_strategy_version_number:
        number;
    }> = [];

  if (
    reportIds.length >
    0
  ) {
    const {
      data: files,
      error:
        filesError,
    } =
      await admin
        .from(
          "strategy_report_files",
        )
        .select(
          "id,report_id,report_number,filename,mime_type,byte_size,sha256,storage_bucket,storage_path,source_strategy_version_number",
        )
        .eq(
          "project_id",
          project.id,
        )
        .in(
          "report_id",
          reportIds,
        );

    if (
      filesError
    ) {
      throw new Error(
        filesError.message,
      );
    }

    fileRows =
      files ?? [];
  }

  const filesByReport =
    new Map(
      fileRows.map(
        (file) => [
          file.report_id,
          file,
        ],
      ),
    );

  const deliverables =
    reportRows
      .map(
        (
          report,
        ): DeliveryPortalItem | null => {
          const file =
            filesByReport.get(
              report.id,
            );

          if (
            !file ||
            !report.issued_at
          ) {
            return null;
          }

          const configuration =
            normalizeReportConfiguration(
              report.configuration,
              client.brand_name,
            );

          return {
            fileId:
              file.id,

            reportId:
              report.id,

            reportNumber:
              report.report_number,

            reportTitle:
              configuration
                .reportTitle,

            reportSubtitle:
              configuration
                .reportSubtitle,

            sourceStrategyVersionNumber:
              report
                .source_strategy_version_number,

            issuedAt:
              report.issued_at,

            filename:
              file.filename,

            mimeType:
              file.mime_type,

            byteSize:
              Number(
                file.byte_size,
              ),

            sha256:
              file.sha256,

            storageBucket:
              file.storage_bucket,

            storagePath:
              file.storage_path,
          };
        },
      )
      .filter(
        (
          item,
        ): item is DeliveryPortalItem =>
          item !==
          null,
      );

  if (
    touchAccess
  ) {
    await admin
      .from(
        "client_delivery_access",
      )
      .update({
        last_accessed_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        access.id,
      );
  }

  return {
    accessId:
      access.id,

    tokenVersion:
      access.token_version,

    projectId:
      project.id,

    brandName:
      client.brand_name,

    projectTitle:
      project.title,

    deliverables,
  };
}
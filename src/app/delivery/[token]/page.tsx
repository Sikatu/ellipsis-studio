import BrandDeliveryReceipt from "@/components/delivery/BrandDeliveryReceipt";

import type {
  Metadata,
} from "next";

import {
  notFound,
} from "next/navigation";

import {
  loadDeliveryPortal,
} from "@/lib/delivery-portal";

import {
  recordDeliveryEvent,
} from "@/lib/delivery-audit";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export const metadata:
  Metadata = {
    title:
      "Client Deliverables | ELLIPSIS",

    description:
      "Private ELLIPSIS client deliverables.",

    robots: {
      index:
        false,

      follow:
        false,

      nocache:
        true,
    },
  };

function formatDate(
  value: string,
) {
  const date =
    new Date(
      value,
    );

  return new Intl
    .DateTimeFormat(
      "en",
      {
        month:
          "long",

        day:
          "numeric",

        year:
          "numeric",
      },
    )
    .format(
      date,
    );
}

function formatBytes(
  value: number,
) {
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

function shortHash(
  value: string,
) {
  if (
    value.length <=
    28
  ) {
    return value;
  }

  return `${value.slice(
    0,
    16,
  )}...${value.slice(
    -12,
  )}`;
}

export default async function DeliveryPage({
  params,
}: {
  params:
    Promise<{
      token: string;
    }>;
}) {
  const {
    token,
  } =
    await params;

  const portal =
    await loadDeliveryPortal(
      token,
    );

  if (!portal) {
    notFound();
  }

  await recordDeliveryEvent({
    projectId:
      portal.projectId,

    accessId:
      portal.accessId,

    eventType:
      "portal_viewed",

    actorType:
      "client",

    tokenVersion:
      portal.tokenVersion,

    dedupeWindowMs:
      120000,
  });

  return (
    <main className="min-h-screen bg-[#11110f] text-[#f4f0e8]">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-12">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="text-[11px] font-semibold tracking-[0.22em] text-[#f4f0e8]">
            ELLIPSIS
          </div>

          <div className="text-[9px] font-medium tracking-[0.16em] text-white/25 uppercase">
            Private client delivery
          </div>
        </header>

        <section className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] text-[#c5a577] uppercase">
              Client Deliverables
            </p>

            <h1 className="mt-5 max-w-4xl text-4xl font-medium tracking-[-0.035em] sm:text-6xl">
              {
                portal.brandName
              }
            </h1>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/40">
              Your studio-approved brand strategy documents, preserved as the exact files issued by ELLIPSIS.
            </p>
          </div>

          <div className="border-l border-white/10 pl-5">
            <p className="text-[9px] font-semibold tracking-[0.15em] text-white/20 uppercase">
              Delivery status
            </p>

            <p className="mt-3 text-sm text-white/65">
              {
                portal
                  .deliverables
                  .length
              } official {
                portal
                  .deliverables
                  .length ===
                    1
                    ? "file"
                    : "files"
              }
            </p>

            <p className="mt-2 text-[10px] leading-5 text-white/25">
              Only issued deliverables are visible in this private portal.
            </p>
          </div>
        </section>

        <section className="border-t border-white/10 pt-8">
          <div className="flex items-end justify-between gap-5">
            <div>
              <p className="text-[9px] font-semibold tracking-[0.16em] text-white/20 uppercase">
                Issued Library
              </p>

              <h2 className="mt-3 text-2xl font-medium">
                Your official files.
              </h2>
            </div>

            <span className="hidden rounded-full border border-white/10 px-4 py-2 text-[9px] text-white/30 sm:block">
              SHA-256 verified
            </span>
          </div>

          {portal
            .deliverables
            .length ===
            0 ? (
            <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.015] px-6 py-10 text-sm leading-7 text-white/30">
              There are no issued client files available yet.
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {portal
                .deliverables
                .map(
                  (
                    deliverable,
                  ) => (
                    <article
                      key={
                        deliverable
                          .fileId
                      }
                      className="rounded-2xl border border-white/[0.09] bg-[#161612] p-6 sm:p-8"
                    >
                      <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-[#c5a577]/20 bg-[#c5a577]/[0.05] px-3 py-1 text-[9px] font-semibold tracking-[0.13em] text-[#d9bd94] uppercase">
                              Report {
                                String(
                                  deliverable
                                    .reportNumber,
                                ).padStart(
                                  2,
                                  "0",
                                )
                              }
                            </span>

                            <span className="text-[10px] text-white/25">
                              Strategy v{
                                deliverable
                                  .sourceStrategyVersionNumber
                              }
                            </span>
                          </div>

                          <h3 className="mt-5 text-2xl font-medium tracking-[-0.02em]">
                            {
                              deliverable
                                .reportTitle
                            }
                          </h3>

                          <p className="mt-3 max-w-2xl text-xs leading-6 text-white/35">
                            {
                              deliverable
                                .reportSubtitle
                            }
                          </p>

                          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[10px] text-white/25">
                            <span>
                              Issued {
                                formatDate(
                                  deliverable
                                    .issuedAt,
                                )
                              }
                            </span>

                            <span>
                              {
                                formatBytes(
                                  deliverable
                                    .byteSize,
                                )
                              }
                            </span>

                            <span>
                              PDF
                            </span>
                          </div>

                          <div className="mt-4 flex items-center gap-2 font-mono text-[9px] text-white/20">
                            <span className="font-sans font-semibold tracking-[0.12em] uppercase">
                              Verified
                            </span>

                            <span>
                              {
                                shortHash(
                                  deliverable
                                    .sha256,
                                )
                              }
                            </span>
                          </div>
                        </div>

                        <BrandDeliveryReceipt
                          token={token}
                          fileId={
                            deliverable
                              .fileId
                          }
                          reportNumber={
                            deliverable
                              .reportNumber
                          }
                        />
                      </div>
                    </article>
                  ),
                )}
            </div>
          )}
        </section>

        <footer className="mt-16 flex flex-col justify-between gap-4 border-t border-white/10 pt-6 text-[9px] leading-5 text-white/20 sm:flex-row">
          <p>
            ELLIPSIS Client Delivery
          </p>

          <p>
            Private link. Issued documents only.
          </p>
        </footer>
      </div>
    </main>
  );
}
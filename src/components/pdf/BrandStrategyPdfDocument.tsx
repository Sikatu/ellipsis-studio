import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type {
  AIStrategyOutput,
} from "@/lib/ai-strategy";

import type {
  StrategyReportConfiguration,
} from "@/lib/report-production";

import {
  buildStrategyReportSections,
} from "@/lib/strategy-report";

export type BrandStrategyPdfDocumentProps = {
  brandName: string;
  reportNumber: number;
  status:
    | "ready"
    | "issued";
  sourceStrategyVersionNumber: number;
  strategy: AIStrategyOutput;
  configuration: StrategyReportConfiguration;
  issuedAt:
    | string
    | null;
  updatedAt: string;
};

const colors = {
  paper: "#F4F0E8",
  ink: "#171713",
  muted: "#706D65",
  faint: "#A29D92",
  rule: "#D8D0C3",
  accent: "#9D794C",
};

const styles = StyleSheet.create({
  cover: {
    backgroundColor: colors.paper,
    color: colors.ink,
    paddingTop: 48,
    paddingRight: 54,
    paddingBottom: 44,
    paddingLeft: 54,
    fontFamily: "Helvetica",
    display: "flex",
    flexDirection: "column",
  },

  coverTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  wordmark: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 2.4,
  },

  coverMeta: {
    alignItems: "flex-end",
  },

  coverMetaText: {
    fontSize: 7.5,
    color: colors.muted,
    marginBottom: 3,
  },

  coverMiddle: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 18,
  },

  coverEyebrow: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.5,
    color: colors.accent,
    marginBottom: 14,
  },

  coverTitle: {
    fontFamily: "Times-Roman",
    fontSize: 46,
    lineHeight: 0.98,
    color: colors.ink,
    marginBottom: 22,
  },

  coverSubtitle: {
    maxWidth: 330,
    fontSize: 11,
    lineHeight: 1.65,
    color: colors.muted,
  },

  coverStatement: {
    maxWidth: 300,
    marginTop: 26,
    paddingLeft: 14,
    borderLeftWidth: 1,
    borderLeftColor: colors.accent,
    fontFamily: "Times-Italic",
    fontSize: 12,
    lineHeight: 1.55,
    color: colors.muted,
  },

  coverFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  coverFooterBlock: {
    width: "23%",
  },

  metaLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    letterSpacing: 0.9,
    color: colors.faint,
    marginBottom: 5,
  },

  metaValue: {
    fontSize: 8,
    lineHeight: 1.35,
    color: colors.muted,
  },

  sectionPage: {
    backgroundColor: colors.paper,
    color: colors.ink,
    paddingTop: 74,
    paddingRight: 54,
    paddingBottom: 64,
    paddingLeft: 54,
    fontFamily: "Helvetica",
  },

  sectionHeader: {
    position: "absolute",
    top: 34,
    left: 54,
    right: 54,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionHeaderBrand: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    letterSpacing: 1.3,
    color: colors.faint,
  },

  sectionHeaderReport: {
    fontSize: 6.5,
    color: colors.faint,
  },

  sectionIntro: {
    marginBottom: 28,
  },

  sectionNumber: {
    fontFamily: "Times-Roman",
    fontSize: 25,
    color: colors.accent,
    marginBottom: 24,
  },

  eyebrow: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1.3,
    color: colors.accent,
    marginBottom: 9,
  },

  sectionTitle: {
    fontFamily: "Times-Roman",
    fontSize: 34,
    lineHeight: 1.02,
    color: colors.ink,
  },

  paragraphs: {
    marginBottom: 22,
  },

  paragraph: {
    fontSize: 10,
    lineHeight: 1.75,
    color: colors.muted,
    marginBottom: 12,
  },

  group: {
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    paddingTop: 12,
    marginBottom: 20,
  },

  groupLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1.1,
    color: colors.faint,
    marginBottom: 10,
  },

  listItem: {
    flexDirection: "row",
    marginBottom: 8,
  },

  listMarker: {
    width: 12,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: colors.accent,
  },

  listText: {
    flexGrow: 1,
    flexBasis: 0,
    fontSize: 9.5,
    lineHeight: 1.65,
    color: colors.muted,
  },

  emptyText: {
    fontSize: 9,
    color: colors.faint,
  },

  sectionFooter: {
    position: "absolute",
    left: 54,
    right: 54,
    bottom: 27,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionFooterText: {
    fontSize: 6.5,
    color: colors.faint,
  },

  pageNumber: {
    fontSize: 6.5,
    color: colors.faint,
  },
});

function formatDate(
  value:
    | string
    | null,
) {
  if (!value) {
    return "Ready for delivery";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  ).format(date);
}

function PdfFooter({
  brandName,
  reportNumber,
}: {
  brandName: string;
  reportNumber: number;
}) {
  return (
    <View
      fixed
      style={
        styles.sectionFooter
      }
    >
      <Text
        style={
          styles.sectionFooterText
        }
      >
        {brandName}
        {" | "}
        Report {reportNumber}
      </Text>

      <Text
        style={
          styles.pageNumber
        }
        render={({
          pageNumber,
          totalPages,
        }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

export default function BrandStrategyPdfDocument({
  brandName,
  reportNumber,
  status,
  sourceStrategyVersionNumber,
  strategy,
  configuration,
  issuedAt,
}: BrandStrategyPdfDocumentProps) {
  const sections =
    buildStrategyReportSections(
      strategy,
      configuration.includedSections,
    );

  const statusLabel =
    status === "issued"
      ? "ISSUED"
      : "READY";

  return (
    <Document
      title={`${brandName} - ${configuration.reportTitle}`}
      author={
        configuration.preparedBy ||
        "ELLIPSIS"
      }
      subject={
        configuration.reportSubtitle
      }
      creator="ELLIPSIS Brand Discovery"
      producer="ELLIPSIS Brand Discovery"
      language="en"
    >
      <Page
        size="A4"
        wrap={false}
        style={
          styles.cover
        }
      >
        <View
          style={
            styles.coverTop
          }
        >
          <Text
            style={
              styles.wordmark
            }
          >
            ELLIPSIS
          </Text>

          <View
            style={
              styles.coverMeta
            }
          >
            <Text
              style={
                styles.coverMetaText
              }
            >
              {
                configuration.reportTitle
              }
            </Text>

            <Text
              style={
                styles.coverMetaText
              }
            >
              REPORT {reportNumber}
            </Text>

            <Text
              style={
                styles.coverMetaText
              }
            >
              {statusLabel}
            </Text>
          </View>
        </View>

        <View
          style={
            styles.coverMiddle
          }
        >
          <Text
            style={
              styles.coverEyebrow
            }
          >
            {
              configuration.reportTitle.toUpperCase()
            }
          </Text>

          <Text
            style={
              styles.coverTitle
            }
          >
            {brandName}
          </Text>

          <Text
            style={
              styles.coverSubtitle
            }
          >
            {
              configuration.reportSubtitle
            }
          </Text>

          {configuration.coverStatement && (
            <Text
              style={
                styles.coverStatement
              }
            >
              {
                configuration.coverStatement
              }
            </Text>
          )}
        </View>

        <View
          style={
            styles.coverFooter
          }
        >
          <View
            style={
              styles.coverFooterBlock
            }
          >
            <Text
              style={
                styles.metaLabel
              }
            >
              PREPARED FOR
            </Text>

            <Text
              style={
                styles.metaValue
              }
            >
              {
                configuration.preparedFor
              }
            </Text>
          </View>

          <View
            style={
              styles.coverFooterBlock
            }
          >
            <Text
              style={
                styles.metaLabel
              }
            >
              PREPARED BY
            </Text>

            <Text
              style={
                styles.metaValue
              }
            >
              {
                configuration.preparedBy
              }
            </Text>
          </View>

          <View
            style={
              styles.coverFooterBlock
            }
          >
            <Text
              style={
                styles.metaLabel
              }
            >
              STRATEGY SOURCE
            </Text>

            <Text
              style={
                styles.metaValue
              }
            >
              Approved Strategy v{
                sourceStrategyVersionNumber
              }
            </Text>
          </View>

          <View
            style={
              styles.coverFooterBlock
            }
          >
            <Text
              style={
                styles.metaLabel
              }
            >
              DELIVERY STATUS
            </Text>

            <Text
              style={
                styles.metaValue
              }
            >
              {
                formatDate(
                  issuedAt,
                )
              }
            </Text>
          </View>
        </View>
      </Page>

      {sections.map(
        (section) => (
          <Page
            key={
              section.id
            }
            size="A4"
            wrap
            style={
              styles.sectionPage
            }
          >
            <View
              fixed
              style={
                styles.sectionHeader
              }
            >
              <Text
                style={
                  styles.sectionHeaderBrand
                }
              >
                ELLIPSIS
              </Text>

              <Text
                style={
                  styles.sectionHeaderReport
                }
              >
                {
                  configuration.reportTitle
                }
                {" | "}
                Report {
                  reportNumber
                }
              </Text>
            </View>

            <View
              style={
                styles.sectionIntro
              }
            >
              <Text
                style={
                  styles.sectionNumber
                }
              >
                {
                  section.number
                }
              </Text>

              <Text
                style={
                  styles.eyebrow
                }
              >
                {
                  section.eyebrow.toUpperCase()
                }
              </Text>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                {
                  section.title
                }
              </Text>
            </View>

            {section.paragraphs.length >
              0 && (
              <View
                style={
                  styles.paragraphs
                }
              >
                {section.paragraphs.map(
                  (
                    paragraph,
                    index,
                  ) => (
                    <Text
                      key={
                        `${section.id}-paragraph-${index}`
                      }
                      style={
                        styles.paragraph
                      }
                    >
                      {paragraph}
                    </Text>
                  ),
                )}
              </View>
            )}

            {section.groups.map(
              (group) => (
                <View
                  key={
                    `${section.id}-${group.label}`
                  }
                  wrap={false}
                  style={
                    styles.group
                  }
                >
                  <Text
                    style={
                      styles.groupLabel
                    }
                  >
                    {
                      group.label.toUpperCase()
                    }
                  </Text>

                  {group.items.length >
                  0 ? (
                    group.items.map(
                      (
                        item,
                        index,
                      ) => (
                        <View
                          key={
                            `${group.label}-${index}`
                          }
                          style={
                            styles.listItem
                          }
                        >
                          <Text
                            style={
                              styles.listMarker
                            }
                          >
                            -
                          </Text>

                          <Text
                            style={
                              styles.listText
                            }
                          >
                            {item}
                          </Text>
                        </View>
                      ),
                    )
                  ) : (
                    <Text
                      style={
                        styles.emptyText
                      }
                    >
                      No additional direction established.
                    </Text>
                  )}
                </View>
              ),
            )}

            <PdfFooter
              brandName={
                brandName
              }
              reportNumber={
                reportNumber
              }
            />
          </Page>
        ),
      )}
    </Document>
  );
}
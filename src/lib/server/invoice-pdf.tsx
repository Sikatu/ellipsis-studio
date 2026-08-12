import React from "react";

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

export type InvoicePdfRow = {
  id: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date: string;
  currency: string;
  sender_snapshot: unknown;
  client_snapshot: unknown;
  payment_instructions_snapshot: string;
  notes: string;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  adjustment_cents: number;
  total_cents: number;
};

export type InvoicePdfItem = {
  id: string;
  sort_order: number;
  description: string;
  quantity: number | string;
  unit_label: string;
  unit_rate_cents: number;
  amount_cents: number;
  notes: string;
};

type JsonObject =
  Record<
    string,
    unknown
  >;

const palette = {
  ink:
    "#171714",
  muted:
    "#68665F",
  faint:
    "#A7A39A",
  rule:
    "#DED8CE",
  paper:
    "#FFFFFF",
  soft:
    "#F6F2EB",
  brass:
    "#9A7A4F",
  cream:
    "#F4F0E8",
};

const styles =
  StyleSheet.create({
    page: {
      backgroundColor:
        palette.paper,
      color:
        palette.ink,
      fontFamily:
        "Helvetica",
      fontSize:
        9,
      lineHeight:
        1.45,
      paddingTop:
        42,
      paddingRight:
        42,
      paddingBottom:
        58,
      paddingLeft:
        42,
    },

    topRule: {
      height:
        2,
      backgroundColor:
        palette.ink,
      marginBottom:
        24,
    },

    header: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      alignItems:
        "flex-start",
    },

    senderBlock: {
      width:
        "55%",
      paddingRight:
        20,
    },

    senderEyebrow: {
      color:
        palette.brass,
      fontSize:
        7,
      fontFamily:
        "Helvetica-Bold",
      letterSpacing:
        1.3,
      textTransform:
        "uppercase",
      marginBottom:
        7,
    },

    senderBusiness: {
      fontFamily:
        "Times-Bold",
      fontSize:
        20,
      lineHeight:
        1.05,
      marginBottom:
        5,
    },

    senderName: {
      color:
        palette.muted,
      fontSize:
        9,
      marginBottom:
        2,
    },

    invoiceBlock: {
      width:
        "45%",
      alignItems:
        "flex-end",
    },

    invoiceLabel: {
      fontFamily:
        "Times-Bold",
      fontSize:
        27,
      lineHeight:
        1,
      letterSpacing:
        -0.6,
    },

    invoiceNumber: {
      fontFamily:
        "Helvetica-Bold",
      fontSize:
        9,
      marginTop:
        8,
    },

    statusPill: {
      marginTop:
        8,
      borderWidth:
        1,
      borderColor:
        palette.brass,
      paddingTop:
        4,
      paddingRight:
        8,
      paddingBottom:
        4,
      paddingLeft:
        8,
    },

    statusText: {
      color:
        palette.brass,
      fontFamily:
        "Helvetica-Bold",
      fontSize:
        6.5,
      letterSpacing:
        1,
      textTransform:
        "uppercase",
    },

    infoBand: {
      flexDirection:
        "row",
      marginTop:
        28,
      borderTopWidth:
        1,
      borderTopColor:
        palette.rule,
      borderBottomWidth:
        1,
      borderBottomColor:
        palette.rule,
      paddingTop:
        16,
      paddingBottom:
        16,
    },

    infoColumn: {
      width:
        "50%",
      paddingRight:
        16,
    },

    infoColumnRight: {
      width:
        "50%",
      paddingLeft:
        16,
      borderLeftWidth:
        1,
      borderLeftColor:
        palette.rule,
    },

    sectionEyebrow: {
      color:
        palette.brass,
      fontFamily:
        "Helvetica-Bold",
      fontSize:
        6.5,
      letterSpacing:
        1.1,
      textTransform:
        "uppercase",
      marginBottom:
        7,
    },

    primaryLine: {
      fontFamily:
        "Helvetica-Bold",
      fontSize:
        10,
      marginBottom:
        3,
    },

    detailLine: {
      color:
        palette.muted,
      fontSize:
        8,
      marginBottom:
        2,
    },

    metaBand: {
      flexDirection:
        "row",
      marginTop:
        18,
      backgroundColor:
        palette.soft,
      paddingTop:
        12,
      paddingBottom:
        12,
      paddingLeft:
        14,
      paddingRight:
        14,
    },

    metaCell: {
      width:
        "33.333%",
    },

    metaLabel: {
      color:
        palette.faint,
      fontSize:
        6.5,
      fontFamily:
        "Helvetica-Bold",
      letterSpacing:
        0.8,
      textTransform:
        "uppercase",
      marginBottom:
        4,
    },

    metaValue: {
      fontFamily:
        "Helvetica-Bold",
      fontSize:
        8.5,
    },

    table: {
      marginTop:
        24,
    },

    tableHeader: {
      flexDirection:
        "row",
      backgroundColor:
        palette.ink,
      color:
        palette.cream,
      paddingTop:
        8,
      paddingRight:
        10,
      paddingBottom:
        8,
      paddingLeft:
        10,
    },

    tableHeaderText: {
      fontFamily:
        "Helvetica-Bold",
      fontSize:
        6.5,
      letterSpacing:
        0.8,
      textTransform:
        "uppercase",
    },

    tableRow: {
      flexDirection:
        "row",
      borderBottomWidth:
        1,
      borderBottomColor:
        palette.rule,
      paddingTop:
        10,
      paddingRight:
        10,
      paddingBottom:
        10,
      paddingLeft:
        10,
    },

    descriptionColumn: {
      width:
        "46%",
      paddingRight:
        10,
    },

    quantityColumn: {
      width:
        "14%",
      textAlign:
        "right",
      paddingLeft:
        6,
    },

    rateColumn: {
      width:
        "20%",
      textAlign:
        "right",
      paddingLeft:
        6,
    },

    amountColumn: {
      width:
        "20%",
      textAlign:
        "right",
      paddingLeft:
        6,
    },

    itemTitle: {
      fontFamily:
        "Helvetica-Bold",
      fontSize:
        8.5,
    },

    itemNotes: {
      color:
        palette.muted,
      fontSize:
        7,
      marginTop:
        3,
    },

    tableValue: {
      fontSize:
        8,
    },

    summaryWrap: {
      flexDirection:
        "row",
      justifyContent:
        "flex-end",
      marginTop:
        18,
    },

    summary: {
      width:
        230,
    },

    summaryRow: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      paddingTop:
        5,
      paddingBottom:
        5,
    },

    summaryLabel: {
      color:
        palette.muted,
      fontSize:
        8,
    },

    summaryValue: {
      fontFamily:
        "Helvetica-Bold",
      fontSize:
        8,
    },

    totalRow: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      borderTopWidth:
        1.5,
      borderTopColor:
        palette.ink,
      marginTop:
        5,
      paddingTop:
        10,
    },

    totalLabel: {
      fontFamily:
        "Times-Bold",
      fontSize:
        13,
    },

    totalValue: {
      fontFamily:
        "Times-Bold",
      fontSize:
        13,
    },

    notesGrid: {
      flexDirection:
        "row",
      marginTop:
        28,
      borderTopWidth:
        1,
      borderTopColor:
        palette.rule,
      paddingTop:
        16,
    },

    notesColumn: {
      width:
        "50%",
      paddingRight:
        16,
    },

    notesColumnRight: {
      width:
        "50%",
      paddingLeft:
        16,
      borderLeftWidth:
        1,
      borderLeftColor:
        palette.rule,
    },

    noteText: {
      color:
        palette.muted,
      fontSize:
        7.5,
      lineHeight:
        1.5,
    },

    thankYou: {
      marginTop:
        26,
      fontFamily:
        "Times-Italic",
      fontSize:
        12,
      color:
        palette.ink,
    },

    draftNotice: {
      marginTop:
        14,
      backgroundColor:
        palette.soft,
      borderLeftWidth:
        2,
      borderLeftColor:
        palette.brass,
      paddingTop:
        8,
      paddingRight:
        10,
      paddingBottom:
        8,
      paddingLeft:
        10,
    },

    draftNoticeText: {
      color:
        palette.muted,
      fontSize:
        7,
    },

    footer: {
      position:
        "absolute",
      left:
        42,
      right:
        42,
      bottom:
        24,
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      borderTopWidth:
        1,
      borderTopColor:
        palette.rule,
      paddingTop:
        8,
    },

    footerText: {
      color:
        palette.faint,
      fontSize:
        6.5,
    },
  });

function objectValue(
  value: unknown,
):
  JsonObject {
  if (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  ) {
    return value as
      JsonObject;
  }

  return {};
}

function cleanText(
  value: unknown,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return "";
  }

  return String(
    value,
  )
    .replace(
      /[\u2018\u2019]/g,
      "'",
    )
    .replace(
      /[\u201C\u201D]/g,
      '"',
    )
    .replace(
      /[\u2013\u2014]/g,
      "-",
    )
    .replace(
      /\u2022/g,
      "-",
    )
    .replace(
      /\u00D7/g,
      "x",
    )
    .replace(
      /[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g,
      "?",
    )
    .trim();
}

function field(
  source:
    JsonObject,
  key: string,
) {
  return cleanText(
    source[
      key
    ],
  );
}

function compact(
  values:
    Array<
      string
    >,
) {
  return values.filter(
    Boolean,
  );
}

function addressLines(
  source:
    JsonObject,
) {
  const locality =
    compact([
      field(
        source,
        "city",
      ),
      field(
        source,
        "region",
      ),
      field(
        source,
        "postalCode",
      ),
    ]).join(
      ", ",
    );

  return compact([
    field(
      source,
      "addressLine1",
    ),
    field(
      source,
      "addressLine2",
    ),
    locality,
    field(
      source,
      "country",
    ),
  ]);
}

function formatMoney(
  cents: number,
  currency: string,
) {
  const amount =
    Number(
      cents ??
      0,
    ) /
    100;

  const formatted =
    new Intl.NumberFormat(
      "en-US",
      {
        minimumFractionDigits:
          2,
        maximumFractionDigits:
          2,
      },
    ).format(
      amount,
    );

  return `${cleanText(currency)} ${formatted}`;
}

function formatDate(
  value: string,
) {
  const parsed =
    new Date(
      `${value}T00:00:00Z`,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return cleanText(
      value,
    );
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",
      day:
        "numeric",
      year:
        "numeric",
      timeZone:
        "UTC",
    },
  ).format(
    parsed,
  );
}

function formatQuantity(
  value:
    number |
    string,
  unit: string,
) {
  const numeric =
    Number(
      value,
    );

  const quantity =
    Number.isFinite(
      numeric,
    )
      ? (
          Number.isInteger(
            numeric,
          )
            ? String(
                numeric,
              )
            : numeric
                .toFixed(
                  2,
                )
                .replace(
                  /\.?0+$/,
                  "",
                )
        )
      : cleanText(
          value,
        );

  const normalizedUnit =
    cleanText(
      unit,
    );

  if (
    normalizedUnit ===
      "hour"
  ) {
    return `${quantity} hr${quantity === "1" ? "" : "s"}`;
  }

  if (
    normalizedUnit ===
      "service"
  ) {
    return quantity;
  }

  return `${quantity} ${normalizedUnit}`.trim();
}

function safeFilenamePart(
  value: string,
) {
  return cleanText(
    value,
  )
    .normalize(
      "NFKD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^A-Za-z0-9._-]+/g,
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
}

function InvoiceDocument({
  invoice,
  items,
}: {
  invoice:
    InvoicePdfRow;
  items:
    InvoicePdfItem[];
}) {
  const sender =
    objectValue(
      invoice
        .sender_snapshot,
    );

  const client =
    objectValue(
      invoice
        .client_snapshot,
    );

  const senderBusiness =
    field(
      sender,
      "businessName",
    ) ||
    field(
      sender,
      "displayName",
    ) ||
    "Invoice";

  const senderName =
    field(
      sender,
      "displayName",
    );

  const clientName =
    field(
      client,
      "billingName",
    ) ||
    field(
      client,
      "companyName",
    ) ||
    "Client";

  const clientCompany =
    field(
      client,
      "companyName",
    );

  const senderAddress =
    addressLines(
      sender,
    );

  const clientAddress =
    addressLines(
      client,
    );

  const senderEmail =
    field(
      sender,
      "email",
    );

  const senderPhone =
    field(
      sender,
      "phone",
    );

  const clientEmail =
    field(
      client,
      "email",
    );

  const clientPhone =
    field(
      client,
      "phone",
    );

  const showSenderName =
    senderName &&
    senderName !==
      senderBusiness;

  const showClientCompany =
    clientCompany &&
    clientCompany !==
      clientName;

  const hasPayment =
    cleanText(
      invoice
        .payment_instructions_snapshot,
    );

  const hasNotes =
    cleanText(
      invoice.notes,
    );

  const status =
    cleanText(
      invoice.status,
    ) ||
    "draft";

  return (
    <Document
      title={`Invoice ${cleanText(invoice.invoice_number)}`}
      author={senderBusiness}
      subject="Client invoice"
      creator="ELLIPSIS Studio"
    >
      <Page
        size="A4"
        style={
          styles.page
        }
      >
        <View
          style={
            styles.topRule
          }
        />

        <View
          style={
            styles.header
          }
        >
          <View
            style={
              styles.senderBlock
            }
          >
            <Text
              style={
                styles.senderEyebrow
              }
            >
              From
            </Text>

            <Text
              style={
                styles.senderBusiness
              }
            >
              {
                senderBusiness
              }
            </Text>

            {showSenderName && (
              <Text
                style={
                  styles.senderName
                }
              >
                {senderName}
              </Text>
            )}

            {senderEmail && (
              <Text
                style={
                  styles.detailLine
                }
              >
                {senderEmail}
              </Text>
            )}

            {senderPhone && (
              <Text
                style={
                  styles.detailLine
                }
              >
                {senderPhone}
              </Text>
            )}
          </View>

          <View
            style={
              styles.invoiceBlock
            }
          >
            <Text
              style={
                styles.invoiceLabel
              }
            >
              INVOICE
            </Text>

            <Text
              style={
                styles.invoiceNumber
              }
            >
              {
                cleanText(
                  invoice
                    .invoice_number,
                )
              }
            </Text>

            <View
              style={
                styles.statusPill
              }
            >
              <Text
                style={
                  styles.statusText
                }
              >
                {status}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={
            styles.infoBand
          }
        >
          <View
            style={
              styles.infoColumn
            }
          >
            <Text
              style={
                styles.sectionEyebrow
              }
            >
              Bill To
            </Text>

            <Text
              style={
                styles.primaryLine
              }
            >
              {clientName}
            </Text>

            {showClientCompany && (
              <Text
                style={
                  styles.detailLine
                }
              >
                {
                  clientCompany
                }
              </Text>
            )}

            {clientEmail && (
              <Text
                style={
                  styles.detailLine
                }
              >
                {clientEmail}
              </Text>
            )}

            {clientPhone && (
              <Text
                style={
                  styles.detailLine
                }
              >
                {clientPhone}
              </Text>
            )}

            {clientAddress.map(
              (
                line,
              ) => (
                <Text
                  key={
                    line
                  }
                  style={
                    styles.detailLine
                  }
                >
                  {line}
                </Text>
              ),
            )}
          </View>

          <View
            style={
              styles.infoColumnRight
            }
          >
            <Text
              style={
                styles.sectionEyebrow
              }
            >
              Sender Address
            </Text>

            {senderAddress.length >
            0 ? (
              senderAddress.map(
                (
                  line,
                ) => (
                  <Text
                    key={
                      line
                    }
                    style={
                      styles.detailLine
                    }
                  >
                    {line}
                  </Text>
                ),
              )
            ) : (
              <Text
                style={
                  styles.detailLine
                }
              >
                Address not provided
              </Text>
            )}
          </View>
        </View>

        <View
          style={
            styles.metaBand
          }
        >
          <View
            style={
              styles.metaCell
            }
          >
            <Text
              style={
                styles.metaLabel
              }
            >
              Invoice Date
            </Text>

            <Text
              style={
                styles.metaValue
              }
            >
              {
                formatDate(
                  invoice
                    .invoice_date,
                )
              }
            </Text>
          </View>

          <View
            style={
              styles.metaCell
            }
          >
            <Text
              style={
                styles.metaLabel
              }
            >
              Due Date
            </Text>

            <Text
              style={
                styles.metaValue
              }
            >
              {
                formatDate(
                  invoice
                    .due_date,
                )
              }
            </Text>
          </View>

          <View
            style={
              styles.metaCell
            }
          >
            <Text
              style={
                styles.metaLabel
              }
            >
              Currency
            </Text>

            <Text
              style={
                styles.metaValue
              }
            >
              {
                cleanText(
                  invoice
                    .currency,
                )
              }
            </Text>
          </View>
        </View>

        <View
          style={
            styles.table
          }
        >
          <View
            style={
              styles.tableHeader
            }
          >
            <Text
              style={[
                styles.tableHeaderText,
                styles.descriptionColumn,
              ]}
            >
              Service / Work
            </Text>

            <Text
              style={[
                styles.tableHeaderText,
                styles.quantityColumn,
              ]}
            >
              Qty
            </Text>

            <Text
              style={[
                styles.tableHeaderText,
                styles.rateColumn,
              ]}
            >
              Rate
            </Text>

            <Text
              style={[
                styles.tableHeaderText,
                styles.amountColumn,
              ]}
            >
              Amount
            </Text>
          </View>

          {items.map(
            (
              item,
            ) => (
              <View
                key={
                  item.id
                }
                wrap={false}
                style={
                  styles.tableRow
                }
              >
                <View
                  style={
                    styles.descriptionColumn
                  }
                >
                  <Text
                    style={
                      styles.itemTitle
                    }
                  >
                    {
                      cleanText(
                        item.description,
                      )
                    }
                  </Text>

                  {cleanText(
                    item.notes,
                  ) && (
                    <Text
                      style={
                        styles.itemNotes
                      }
                    >
                      {
                        cleanText(
                          item.notes,
                        )
                      }
                    </Text>
                  )}
                </View>

                <Text
                  style={[
                    styles.tableValue,
                    styles.quantityColumn,
                  ]}
                >
                  {
                    formatQuantity(
                      item.quantity,
                      item
                        .unit_label,
                    )
                  }
                </Text>

                <Text
                  style={[
                    styles.tableValue,
                    styles.rateColumn,
                  ]}
                >
                  {
                    formatMoney(
                      item
                        .unit_rate_cents,
                      invoice
                        .currency,
                    )
                  }
                </Text>

                <Text
                  style={[
                    styles.tableValue,
                    styles.amountColumn,
                  ]}
                >
                  {
                    formatMoney(
                      item
                        .amount_cents,
                      invoice
                        .currency,
                    )
                  }
                </Text>
              </View>
            ),
          )}
        </View>

        <View
          style={
            styles.summaryWrap
          }
        >
          <View
            style={
              styles.summary
            }
          >
            <SummaryRow
              label="Subtotal"
              value={
                formatMoney(
                  invoice
                    .subtotal_cents,
                  invoice
                    .currency,
                )
              }
            />

            {invoice
              .discount_cents >
              0 && (
              <SummaryRow
                label="Discount"
                value={`- ${formatMoney(
                  invoice
                    .discount_cents,
                  invoice
                    .currency,
                )}`}
              />
            )}

            {invoice
              .tax_cents >
              0 && (
              <SummaryRow
                label="Tax"
                value={
                  formatMoney(
                    invoice
                      .tax_cents,
                    invoice
                      .currency,
                  )
                }
              />
            )}

            {invoice
              .adjustment_cents !==
              0 && (
              <SummaryRow
                label="Adjustment"
                value={
                  formatMoney(
                    invoice
                      .adjustment_cents,
                    invoice
                      .currency,
                  )
                }
              />
            )}

            <View
              style={
                styles.totalRow
              }
            >
              <Text
                style={
                  styles.totalLabel
                }
              >
                Total
              </Text>

              <Text
                style={
                  styles.totalValue
                }
              >
                {
                  formatMoney(
                    invoice
                      .total_cents,
                    invoice
                      .currency,
                  )
                }
              </Text>
            </View>
          </View>
        </View>

        {(hasPayment ||
          hasNotes) && (
          <View
            style={
              styles.notesGrid
            }
          >
            <View
              style={
                styles.notesColumn
              }
            >
              <Text
                style={
                  styles.sectionEyebrow
                }
              >
                Payment
              </Text>

              <Text
                style={
                  styles.noteText
                }
              >
                {hasPayment ||
                  "No payment instructions provided."}
              </Text>
            </View>

            <View
              style={
                styles.notesColumnRight
              }
            >
              <Text
                style={
                  styles.sectionEyebrow
                }
              >
                Note
              </Text>

              <Text
                style={
                  styles.noteText
                }
              >
                {hasNotes ||
                  "No additional note."}
              </Text>
            </View>
          </View>
        )}

        <Text
          style={
            styles.thankYou
          }
        >
          Thank you.
        </Text>

        {status ===
          "draft" && (
          <View
            style={
              styles.draftNotice
            }
          >
            <Text
              style={
                styles.draftNoticeText
              }
            >
              Draft invoice - review details before sending to the client.
            </Text>
          </View>
        )}

        <View
          fixed
          style={
            styles.footer
          }
        >
          <Text
            style={
              styles.footerText
            }
          >
            Created with ELLIPSIS Studio - {
              cleanText(
                invoice
                  .invoice_number,
              )
            }
          </Text>

          <Text
            style={
              styles.footerText
            }
            render={({
              pageNumber,
              totalPages,
            }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.summaryRow
      }
    >
      <Text
        style={
          styles.summaryLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.summaryValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

export function invoicePdfFilename(
  invoice:
    InvoicePdfRow,
) {
  const client =
    objectValue(
      invoice
        .client_snapshot,
    );

  const clientName =
    field(
      client,
      "companyName",
    ) ||
    field(
      client,
      "billingName",
    ) ||
    "Client";

  const number =
    safeFilenamePart(
      invoice
        .invoice_number,
    ) ||
    "Invoice";

  const clientPart =
    safeFilenamePart(
      clientName,
    ) ||
    "Client";

  return `${number}-${clientPart}.pdf`;
}

export async function renderInvoicePdf(
  invoice:
    InvoicePdfRow,
  items:
    InvoicePdfItem[],
) {
  const buffer =
    await renderToBuffer(
      <InvoiceDocument
        invoice={
          invoice
        }
        items={
          [...items].sort(
            (
              left,
              right,
            ) =>
              left.sort_order -
              right.sort_order,
          )
        }
      />,
    );

  return {
    buffer,
    filename:
      invoicePdfFilename(
        invoice,
      ),
  };
}

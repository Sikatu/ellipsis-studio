export const INVOICE_CURRENCIES =
  [
    "USD",
    "PHP",
    "AUD",
    "CAD",
    "GBP",
    "EUR",
  ] as const;

export type InvoiceCurrency =
  typeof INVOICE_CURRENCIES[number];

export type StudioBillingProfile = {
  id: string;
  created_by: string;
  display_name: string;
  business_name: string;
  email: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  default_currency: InvoiceCurrency;
  default_payment_terms_days: number;
  invoice_prefix: string;
  payment_instructions: string;
  default_notes: string;
  created_at: string;
  updated_at: string;
};

export type StudioBillingProfileDraft = {
  displayName: string;
  businessName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  defaultCurrency: InvoiceCurrency;
  defaultPaymentTermsDays: number;
  invoicePrefix: string;
  paymentInstructions: string;
  defaultNotes: string;
};

export function emptyStudioBillingProfile():
  StudioBillingProfileDraft {
  return {
    displayName:
      "",
    businessName:
      "",
    email:
      "",
    phone:
      "",
    addressLine1:
      "",
    addressLine2:
      "",
    city:
      "",
    region:
      "",
    postalCode:
      "",
    country:
      "",
    defaultCurrency:
      "USD",
    defaultPaymentTermsDays:
      14,
    invoicePrefix:
      "ELL",
    paymentInstructions:
      "",
    defaultNotes:
      "",
  };
}

export function billingDraftFromRow(
  profile: StudioBillingProfile,
):
  StudioBillingProfileDraft {
  return {
    displayName:
      profile.display_name,
    businessName:
      profile.business_name,
    email:
      profile.email,
    phone:
      profile.phone,
    addressLine1:
      profile.address_line_1,
    addressLine2:
      profile.address_line_2,
    city:
      profile.city,
    region:
      profile.region,
    postalCode:
      profile.postal_code,
    country:
      profile.country,
    defaultCurrency:
      profile.default_currency,
    defaultPaymentTermsDays:
      profile.default_payment_terms_days,
    invoicePrefix:
      profile.invoice_prefix,
    paymentInstructions:
      profile.payment_instructions,
    defaultNotes:
      profile.default_notes,
  };
}

export function normalizeInvoicePrefix(
  value: string,
) {
  return value
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9-]/g,
      "",
    )
    .slice(
      0,
      12,
    );
}

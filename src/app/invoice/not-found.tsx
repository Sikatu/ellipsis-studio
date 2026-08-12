export default function InvoiceNotFound() {
  return (
    <main className="min-h-screen bg-[#11110f] px-6 py-16 text-[#f4f0e8]">
      <div className="mx-auto max-w-xl rounded-[28px] border border-white/[0.08] bg-[#161612] p-8 sm:p-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8ad84]/55">
          ELLIPSIS Studio / Secure Invoice
        </p>

        <h1 className="mt-5 text-3xl font-medium tracking-[-0.045em]">
          This invoice link is unavailable.
        </h1>

        <p className="mt-4 text-sm leading-7 text-white/40">
          The secure link may have been replaced, revoked, or the invoice is no longer available for client delivery. Please ask the sender for a current link.
        </p>
      </div>
    </main>
  );
}
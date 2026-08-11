import Link from "next/link";

const features = [
  {
    number: "01",
    title: "Private discovery",
    text: "Each client receives a unique invitation created specifically for their branding project.",
  },
  {
    number: "02",
    title: "Cross-device autosave",
    text: "Responses are stored securely in the project database instead of being tied to one browser.",
  },
  {
    number: "03",
    title: "Strategic intelligence",
    text: "Business, audience, positioning, personality, visual direction, and verbal identity remain connected.",
  },
  {
    number: "04",
    title: "Studio control",
    text: "ELLIPSIS manages every client discovery from one protected administration environment.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4f0e8] text-[#161612]">
      <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between border-b border-black/10 pb-6">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase">
            Ellipsis
          </p>

          <Link
            href="/admin"
            className="rounded-full bg-[#161612] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black"
          >
            Studio login
          </Link>
        </header>

        <section className="grid min-h-[72vh] items-end gap-12 border-b border-black/10 py-16 lg:grid-cols-[1.45fr_.55fr] lg:py-20">
          <div>
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-black/10 bg-white/45 px-4 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9e7d52]" />

              <span className="text-[11px] font-semibold tracking-[0.17em] text-black/50 uppercase">
                Brand Discovery System
              </span>
            </div>

            <h1 className="max-w-5xl text-[clamp(3.4rem,8vw,8.5rem)] leading-[0.88] font-medium tracking-[-0.065em]">
              Better brands begin with better questions.
            </h1>
          </div>

          <div className="pb-2 lg:pb-4">
            <p className="max-w-md text-base leading-8 text-black/55">
              A private discovery experience designed to reveal the strategic,
              emotional, visual, and commercial foundation behind every client
              brand.
            </p>

            <Link
              href="/admin"
              className="mt-8 inline-flex rounded-full bg-[#161612] px-6 py-3.5 text-sm font-medium text-white"
            >
              Open studio
              <span className="ml-2">→</span>
            </Link>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mb-12 grid gap-6 lg:grid-cols-2">
            <p className="text-xs font-semibold tracking-[0.22em] text-[#8a6d46] uppercase">
              The system
            </p>

            <h2 className="max-w-2xl text-3xl leading-tight font-medium tracking-[-0.035em] sm:text-4xl">
              Enough depth for real strategy. Simple enough that clients actually finish it.
            </h2>
          </div>

          <div className="grid border-t border-black/10 md:grid-cols-2 xl:grid-cols-4">
            {features.map(
              (feature) => (
                <article
                  key={
                    feature.number
                  }
                  className="min-h-64 border-b border-black/10 py-8 md:px-7 xl:border-r xl:border-b-0"
                >
                  <p className="text-xs font-medium text-black/30">
                    {
                      feature.number
                    }
                  </p>

                  <h3 className="mt-12 text-xl font-medium">
                    {
                      feature.title
                    }
                  </h3>

                  <p className="mt-4 max-w-xs text-sm leading-7 text-black/50">
                    {
                      feature.text
                    }
                  </p>
                </article>
              ),
            )}
          </div>
        </section>

        <footer className="flex flex-col justify-between gap-4 border-t border-black/10 py-7 text-[11px] tracking-[0.12em] text-black/35 uppercase sm:flex-row">
          <span>
            Ellipsis Brand Discovery
          </span>

          <span>
            Strategy before aesthetics
          </span>
        </footer>
      </div>
    </main>
  );
}
import Link from "next/link";

import LogoutButton from "@/components/admin/LogoutButton";

type StudioNavProps = {
  active:
    | "studio"
    | "clients"
    | "projects"
    | "brand"
    | "invoices";
};

const links = [
  {
    id: "studio",
    href: "/admin",
    label: "Studio Home",
  },
  {
    id: "clients",
    href: "/admin/clients",
    label: "Clients",
  },
  {
    id: "projects",
    href: "/admin/projects",
    label: "Projects",
  },
  {
    id: "brand",
    href: "/admin/brand-discovery",
    label: "Brand Discovery",
  },
  {
    id: "invoices",
    href: "/admin/invoices",
    label: "Invoices",
  },
] as const;

export default function StudioNav({
  active,
}: StudioNavProps) {
  return (
    <header className="border-b border-white/[0.07]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div className="flex items-center justify-between gap-5">
          <Link
            href="/admin"
            className="group"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#c8ad84]/55">
              ELLIPSIS
            </p>

            <p className="mt-1 text-sm font-medium tracking-[-0.02em] text-[#f4f0e8]/80 transition group-hover:text-[#f4f0e8]">
              Studio
            </p>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-1">
            {links.map(
              (link) => {
                const selected =
                  active ===
                  link.id;

                return (
                  <Link
                    key={link.id}
                    href={link.href}
                    className={[
                      "rounded-xl px-3 py-2 text-[10px] font-medium transition",
                      selected
                        ? "bg-[#f4f0e8] text-[#11110f]"
                        : "text-white/35 hover:bg-white/[0.04] hover:text-white/60",
                    ].join(" ")}
                  >
                    {link.label}
                  </Link>
                );
              },
            )}
          </nav>

          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
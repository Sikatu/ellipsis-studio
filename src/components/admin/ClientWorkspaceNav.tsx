"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

const navigation = [
  {
    id: "overview",
    label: "Overview",
  },
  {
    id: "analysis",
    label: "Analysis",
  },
  {
    id: "strategy",
    label: "Strategy",
  },
  {
    id: "review",
    label: "Review",
  },
  {
    id: "ai-strategist",
    label: "AI",
  },
  {
    id: "final-strategy",
    label: "Final",
  },
  {
    id: "report-production",
    label: "Report",
  },
  {
    id: "discovery",
    label: "Discovery",
  },
  {
    id: "direction",
    label: "Direction",
  },
  {
    id: "alignment",
    label: "Alignment",
  },
] as const;

type WorkspaceId =
  | "all"
  | typeof navigation[number]["id"];

const hiddenAttribute =
  "data-ellipsis-focus-hidden";

function validWorkspace(
  value: string,
): value is WorkspaceId {
  return (
    value === "all" ||
    navigation.some(
      (item) =>
        item.id === value,
    )
  );
}

function restoreFocusedChildren(
  container: HTMLElement,
) {
  const managed =
    container.querySelectorAll<HTMLElement>(
      `[${hiddenAttribute}="true"]`,
    );

  for (
    const element
    of managed
  ) {
    element.hidden = false;

    element.removeAttribute(
      hiddenAttribute,
    );
  }
}

function hideFocusChild(
  element: HTMLElement,
) {
  if (element.hidden) {
    return;
  }

  element.setAttribute(
    hiddenAttribute,
    "true",
  );

  element.hidden = true;
}

function directChildContaining(
  container: HTMLElement,
  target: HTMLElement,
): HTMLElement | null {
  let current:
    HTMLElement | null =
      target;

  while (
    current &&
    current.parentElement !==
      container
  ) {
    current =
      current.parentElement;
  }

  return current;
}

export default function ClientWorkspaceNav() {
  const [
    active,
    setActive,
  ] = useState<WorkspaceId>(
    "all",
  );

  const applyView =
    useCallback(
      (
        next:
          WorkspaceId,
      ) => {
        const navRoot =
          document.getElementById(
            "client-workspace-nav",
          );

        if (!navRoot) {
          return;
        }

        const container =
          navRoot.parentElement;

        if (!container) {
          return;
        }

        restoreFocusedChildren(
          container,
        );

        if (
          next === "all"
        ) {
          setActive(
            "all",
          );

          return;
        }

        const selected =
          document.getElementById(
            next,
          );

        if (!selected) {
          setActive(
            "all",
          );

          return;
        }

        const children =
          Array.from(
            container.children,
          ).filter(
            (
              child,
            ): child is HTMLElement =>
              child instanceof
              HTMLElement,
          );

        const navIndex =
          children.indexOf(
            navRoot,
          );

        if (navIndex < 0) {
          return;
        }

        const contentChildren =
          children.slice(
            navIndex + 1,
          );

        /*
         * DISCOVERY IS A LOGICAL RANGE
         *
         * The Discovery heading itself is one direct child.
         * Business / Goals / Audience / Positioning / etc.
         * are rendered by sections.map() as subsequent sibling
         * sections.
         *
         * Direction is the reliable boundary that follows those
         * generated discovery sections.
         */
        if (
          next === "discovery"
        ) {
          const discoveryRoot =
            directChildContaining(
              container,
              selected,
            );

          const direction =
            document.getElementById(
              "direction",
            );

          const directionRoot =
            direction
              ? directChildContaining(
                  container,
                  direction,
                )
              : null;

          const additional =
            document.getElementById(
              "additional",
            );

          const additionalRoot =
            additional
              ? directChildContaining(
                  container,
                  additional,
                )
              : null;

          if (!discoveryRoot) {
            setActive(
              "all",
            );

            return;
          }

          const discoveryIndex =
            contentChildren.indexOf(
              discoveryRoot,
            );

          const directionIndex =
            directionRoot
              ? contentChildren.indexOf(
                  directionRoot,
                )
              : -1;

          for (
            let index = 0;
            index <
              contentChildren.length;
            index++
          ) {
            const element =
              contentChildren[
                index
              ];

            const inDiscoveryRange =
              discoveryIndex >= 0 &&
              index >=
                discoveryIndex &&
              (
                directionIndex <
                  0 ||
                index <
                  directionIndex
              );

            const isAdditional =
              Boolean(
                additionalRoot &&
                element ===
                  additionalRoot,
              );

            if (
              !inDiscoveryRange &&
              !isAdditional
            ) {
              hideFocusChild(
                element,
              );
            }
          }

          setActive(
            "discovery",
          );

          window.setTimeout(
            () => {
              discoveryRoot
                .scrollIntoView({
                  behavior:
                    "smooth",

                  block:
                    "start",
                });
            },
            0,
          );

          return;
        }

        /*
         * EVERY OTHER WORKSPACE
         *
         * Resolve the selected section/component to its actual
         * direct child under the client-page container, then hide
         * every other content child.
         *
         * This also hides unmanaged generated discovery sections,
         * metadata blocks, and future sibling content.
         */
        const selectedRoot =
          directChildContaining(
            container,
            selected,
          );

        if (!selectedRoot) {
          setActive(
            "all",
          );

          return;
        }

        for (
          const element
          of contentChildren
        ) {
          if (
            element !==
              selectedRoot
          ) {
            hideFocusChild(
              element,
            );
          }
        }

        setActive(
          next,
        );

        window.setTimeout(
          () => {
            selectedRoot
              .scrollIntoView({
                behavior:
                  "smooth",

                block:
                  "start",
              });
          },
          0,
        );
      },
      [],
    );

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          const hash =
            window.location.hash
              .replace(
                "#",
                "",
              );

          if (
            hash &&
            validWorkspace(
              hash,
            )
          ) {
            applyView(
              hash,
            );
          }
          else {
            applyView(
              "all",
            );
          }
        },
        0,
      );

    function handleHashChange() {
      const hash =
        window.location.hash
          .replace(
            "#",
            "",
          );

      if (
        hash &&
        validWorkspace(
          hash,
        )
      ) {
        applyView(
          hash,
        );
      }
      else {
        applyView(
          "all",
        );
      }
    }

    window.addEventListener(
      "hashchange",
      handleHashChange,
    );

    return () => {
      window.clearTimeout(
        timer,
      );

      window.removeEventListener(
        "hashchange",
        handleHashChange,
      );

      const navRoot =
        document.getElementById(
          "client-workspace-nav",
        );

      const container =
        navRoot?.parentElement;

      if (container) {
        restoreFocusedChildren(
          container,
        );
      }
    };
  }, [applyView]);

  function selectView(
    next:
      WorkspaceId,
  ) {
    if (
      next === "all"
    ) {
      window.history
        .replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}`,
        );

      applyView(
        "all",
      );

      window.scrollTo({
        top: 0,
        behavior:
          "smooth",
      });

      return;
    }

    window.history
      .replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#${next}`,
      );

    applyView(
      next,
    );
  }

  return (
    <div
      id="client-workspace-nav"
      className="sticky top-0 z-40 -mx-5 mt-10 border-y border-white/10 bg-[#11110f]/95 px-5 backdrop-blur-xl sm:-mx-8 sm:px-8"
    >
      <div className="mx-auto flex max-w-[1500px] items-center gap-3">
        <span className="hidden shrink-0 text-[9px] font-semibold tracking-[0.16em] text-white/20 uppercase xl:block">
          Workspace
        </span>

        <nav
          aria-label="Client intelligence workspace"
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-3"
        >
          <button
            type="button"
            aria-pressed={
              active === "all"
            }
            onClick={() =>
              selectView(
                "all",
              )
            }
            className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-medium transition ${
              active === "all"
                ? "bg-[#f5f0e6] text-[#11110f]"
                : "text-white/40 hover:bg-white/[0.05] hover:text-white/75"
            }`}
          >
            All
          </button>

          {navigation.map(
            (item) => {
              const isActive =
                active ===
                item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={
                    isActive
                  }
                  onClick={() =>
                    selectView(
                      item.id,
                    )
                  }
                  className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-medium transition ${
                    isActive
                      ? "bg-[#f5f0e6] text-[#11110f]"
                      : "text-white/40 hover:bg-white/[0.05] hover:text-white/75"
                  }`}
                >
                  {item.label}
                </button>
              );
            },
          )}
        </nav>
      </div>
    </div>
  );
}
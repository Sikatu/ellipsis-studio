import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import BrandIntelligenceAnalysis, {
  BrandAlignmentWorkspace,
  BrandDirectionWorkspace,
} from "@/components/admin/BrandIntelligenceAnalysis";
import BrandStrategySynthesis from "@/components/admin/BrandStrategySynthesis";
import BrandStrategyReviewPanel from "@/components/admin/BrandStrategyReviewPanel";
import BrandAIStrategist from "@/components/admin/BrandAIStrategist";
import BrandFinalStrategyWorkspace from "@/components/admin/BrandFinalStrategyWorkspace";
import BrandCreativeDirectionWorkspace from "@/components/admin/BrandCreativeDirectionWorkspace";
import BrandVisualSystemWorkspace from "@/components/admin/BrandVisualSystemWorkspace";
import BrandReportProductionWorkspace from "@/components/admin/BrandReportProductionWorkspace";
import ClientWorkspaceNav from "@/components/admin/ClientWorkspaceNav";
import ClientDetailRealtimeRefresh from "@/components/admin/ClientDetailRealtimeRefresh";
import LogoutButton from "@/components/admin/LogoutButton";
import {
  allQuestionIds,
  buildBrandIntelligence,
  getDiscoverySections,
  getQuestionTitle,
} from "@/lib/discovery-intelligence";
import { buildStrategySynthesis } from "@/lib/strategy-synthesis";
import { createClient } from "@/lib/supabase/server";

type ClientRecord = {
  id: string;
  brand_name: string;
  contact_name: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type ProjectRecord = {
  id: string;
  client_id: string;
  title: string;
  status: string;
  progress: number;
  current_question_index: number;
  last_opened_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

type ResponseRecord = {
  question_id: string;
  answer: unknown;
  updated_at: string;
};

const sections = getDiscoverySections([
  "Business",
  "Goals",
  "Audience",
  "Positioning",
]);

function statusLabel(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}


function formatDate(
  value: string | null | undefined,
) {
  if (!value) {
    return "Not yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function valuePreview(value: unknown) {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .filter(
        (item): item is string =>
          typeof item === "string",
      )
      .join(" · ");
  }

  return "";
}

function AnswerDisplay({
  value,
}: {
  value: unknown;
}) {
  if (Array.isArray(value)) {
    const values = value.filter(
      (item): item is string =>
        typeof item === "string" &&
        item.trim().length > 0,
    );

    if (values.length === 0) {
      return (
        <p className="text-sm text-white/30">
          No response yet.
        </p>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {values.map((item) => (
          <span
            key={item}
            className="rounded-full border border-[#c5a577]/20 bg-[#c5a577]/[0.06] px-3 py-1.5 text-xs leading-5 text-[#d9c09b]"
          >
            {item}
          </span>
        ))}
      </div>
    );
  }

  if (typeof value === "number") {
    return (
      <div>
        <p className="text-3xl font-medium tracking-[-0.03em]">
          {value}
        </p>

        <p className="mt-2 text-xs text-white/30">
          Scale response
        </p>
      </div>
    );
  }

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-7 text-white/70">
        {value.trim()}
      </p>
    );
  }

  if (
    value !== null &&
    value !== undefined
  ) {
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-white/55">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return (
    <p className="text-sm text-white/30">
      No response yet.
    </p>
  );
}

function ResponseCard({
  response,
}: {
  response: ResponseRecord;
}) {
  const label = getQuestionTitle(response.question_id);

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <p className="text-[11px] font-medium tracking-[0.14em] text-white/30 uppercase">
        {label}
      </p>

      <div className="mt-4">
        <AnswerDisplay
          value={response.answer}
        />
      </div>

      <p className="mt-5 border-t border-white/[0.06] pt-4 text-[10px] text-white/20">
        Updated {formatDate(response.updated_at)}
      </p>
    </article>
  );
}

export default async function ClientIntelligencePage({
  params,
}: {
  params: Promise<{
    clientId: string;
  }>;
}) {
  const { clientId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const {
    data: clientData,
    error: clientError,
  } = await supabase
    .from("clients")
    .select(
      "id, brand_name, contact_name, email, website, notes, status, created_at, updated_at",
    )
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) {
    throw new Error(
      `Unable to load client: ${clientError.message}`,
    );
  }

  if (!clientData) {
    notFound();
  }

  const client =
    clientData as ClientRecord;

  const {
    data: projectData,
    error: projectError,
  } = await supabase
    .from("discovery_projects")
    .select(
      "id, client_id, title, status, progress, current_question_index, last_opened_at, submitted_at, created_at, updated_at",
    )
    .eq("client_id", client.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (projectError) {
    throw new Error(
      `Unable to load discovery project: ${projectError.message}`,
    );
  }

  const project =
    (projectData as ProjectRecord | null) ??
    null;

  let responseRows: ResponseRecord[] = [];

  if (project) {
    const {
      data: responseData,
      error: responseError,
    } = await supabase
      .from("discovery_responses")
      .select(
        "question_id, answer, updated_at",
      )
      .eq("project_id", project.id)
      .order("updated_at", {
        ascending: true,
      });

    if (responseError) {
      throw new Error(
        `Unable to load responses: ${responseError.message}`,
      );
    }

    responseRows =
      (responseData ?? []) as ResponseRecord[];
  }

  const responseById = new Map(
    responseRows.map((response) => [
      response.question_id,
      response,
    ]),
  );

  const knownQuestionIds = new Set(allQuestionIds);

  const additionalResponses =
    responseRows.filter(
      (response) =>
        !knownQuestionIds.has(
          response.question_id,
        ),
    );

  const intelligence = buildBrandIntelligence(responseRows);
  const strategySynthesis = buildStrategySynthesis(responseRows, intelligence);

  const marketPosition = valuePreview(
    responseById.get("marketPosition")
      ?.answer,
  );

  const brandingGoals = valuePreview(
    responseById.get("brandingGoals")
      ?.answer,
  );

  const customerAfter = valuePreview(
    responseById.get("customerAfter")
      ?.answer,
  );

  const differentiator = valuePreview(
    responseById.get("differentiator")
      ?.answer,
  );

  const snapshot = [
    {
      label: "Market position",
      value:
        marketPosition ||
        "Not answered yet",
    },
    {
      label: "Branding goals",
      value:
        brandingGoals ||
        "Not answered yet",
    },
    {
      label: "Customer outcome",
      value:
        customerAfter ||
        "Not answered yet",
    },
    {
      label: "Differentiator",
      value:
        differentiator ||
        "Not answered yet",
    },
  ];

  return (
    <main className="min-h-screen bg-[#11110f] text-[#f5f0e6]">
      <ClientDetailRealtimeRefresh
        projectId={project?.id ?? null}
      />

      <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="text-xs font-semibold tracking-[0.24em] uppercase"
            >
              Ellipsis
            </Link>

            <span className="hidden h-4 w-px bg-white/10 sm:block" />

            <Link
              href="/admin"
              className="hidden text-xs text-white/35 transition hover:text-white/70 sm:block"
            >
              ← Client discoveries
            </Link>
          </div>

          <div className="flex items-center gap-6">
            <span className="hidden text-xs text-white/30 sm:block">
              {user.email}
            </span>

            <LogoutButton />
          </div>
        </header>

        <section className="pb-10 pt-12 sm:pb-14 sm:pt-16">
          <div className="flex flex-col justify-between gap-8 xl:flex-row xl:items-end">
            <div>
              <p className="mb-4 text-xs font-semibold tracking-[0.22em] text-[#c5a577] uppercase">
                Client Intelligence
              </p>

              <h1 className="max-w-5xl text-4xl font-medium tracking-[-0.045em] sm:text-6xl">
                {client.brand_name}
              </h1>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/40">
                <span>
                  {project?.title ??
                    "Brand Discovery"}
                </span>

                {client.contact_name && (
                  <>
                    <span className="text-white/15">
                      /
                    </span>
                    <span>
                      {client.contact_name}
                    </span>
                  </>
                )}

                {client.email && (
                  <>
                    <span className="text-white/15">
                      /
                    </span>
                    <span>
                      {client.email}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-[#c5a577]/20 bg-[#c5a577]/[0.07] px-4 py-2 text-xs font-medium text-[#d6b98e]">
                {project
                  ? statusLabel(
                      project.status,
                    )
                  : "No Discovery"}
              </span>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-[10px] tracking-[0.16em] text-white/30 uppercase">
              Progress
            </p>

            <p className="mt-5 text-4xl font-medium tracking-[-0.04em]">
              {project?.progress ?? 0}%
            </p>

            <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#c5a577]"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      project?.progress ?? 0,
                    ),
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-[10px] tracking-[0.16em] text-white/30 uppercase">
              Saved answers
            </p>

            <p className="mt-5 text-4xl font-medium tracking-[-0.04em]">
              {responseRows.length}
            </p>

            <p className="mt-5 text-xs text-white/30">
              of 27 discovery questions
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-[10px] tracking-[0.16em] text-white/30 uppercase">
              Last active
            </p>

            <p className="mt-5 text-sm font-medium leading-6 text-white/70">
              {formatDate(
                project?.last_opened_at ??
                  project?.updated_at,
              )}
            </p>

            <p className="mt-5 text-xs text-white/30">
              Client activity
            </p>
          </div>

          <div className="rounded-2xl border border-[#c5a577]/20 bg-[#c5a577]/[0.055] p-6">
            <p className="text-[10px] tracking-[0.16em] text-[#c9a777] uppercase">
              Submission
            </p>

            <p className="mt-5 text-sm font-medium leading-6">
              {project?.submitted_at
                ? formatDate(
                    project.submitted_at,
                  )
                : "Not submitted yet"}
            </p>

            <p className="mt-5 text-xs text-white/30">
              {project?.submitted_at
                ? "Discovery completed"
                : "Discovery remains editable"}
            </p>
          </div>
        </section>

        <ClientWorkspaceNav />

        <section
          id="overview"
          className="scroll-mt-8 py-12 sm:py-16"
        >
          <div className="mb-7">
            <p className="text-xs font-semibold tracking-[0.18em] text-[#c5a577] uppercase">
              Live Discovery Data
            </p>

            <h2 className="mt-3 text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
              Brand snapshot.
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/40">
              A studio-side view of the
              strongest strategic signals
              currently available from the
              client&apos;s discovery responses.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {snapshot.map((item) => (
              <article
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-6"
              >
                <p className="text-[10px] font-medium tracking-[0.16em] text-white/30 uppercase">
                  {item.label}
                </p>

                <p className="mt-4 text-sm leading-7 text-white/70">
                  {item.value}
                </p>
              </article>
            ))}
          </div>
        </section>

        <BrandIntelligenceAnalysis intelligence={intelligence} />

        <BrandStrategySynthesis
          synthesis={strategySynthesis}
        />
        {project && (
          <BrandStrategyReviewPanel
            projectId={project.id}
            synthesis={strategySynthesis}
          />
        )}
        {project && (
          <BrandAIStrategist
            projectId={project.id}
          />
        )}
        {project && (
          <BrandFinalStrategyWorkspace
            projectId={project.id}
          />
        )}
        {project && (
          <BrandCreativeDirectionWorkspace
            projectId={project.id}
          />
        )}
        {project && (
          <BrandVisualSystemWorkspace
            projectId={project.id}
          />
        )}
        {project && (
          <BrandReportProductionWorkspace
            projectId={project.id}
          />
        )}

        <section
          id="discovery"
          className="scroll-mt-24 border-t border-white/10 pt-12 sm:pt-16"
        >
          <p className="text-xs font-semibold tracking-[0.18em] text-[#c5a577] uppercase">
            Source Discovery
          </p>

          <h2 className="mt-3 text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
            Client responses.
          </h2>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/40">
            Review the original discovery evidence behind the strategic analysis.
          </p>
        </section>
        {sections.map((section) => {
          const sectionResponses =
            section.questionIds
              .map((questionId) =>
                responseById.get(
                  questionId,
                ),
              )
              .filter(
                (
                  response,
                ): response is ResponseRecord =>
                  Boolean(response),
              );

          return (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-8 border-t border-white/10 py-12 sm:py-16"
            >
              <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-[#c5a577] uppercase">
                    Discovery
                  </p>

                  <h2 className="mt-3 text-3xl font-medium tracking-[-0.035em]">
                    {section.label}
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm leading-7 text-white/40">
                    {section.description}
                  </p>
                </div>

                <span className="text-xs text-white/25">
                  {sectionResponses.length} answered
                </span>
              </div>

              {sectionResponses.length >
              0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {sectionResponses.map(
                    (response) => (
                      <ResponseCard
                        key={
                          response.question_id
                        }
                        response={response}
                      />
                    ),
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
                  <p className="text-sm text-white/35">
                    The client has not reached
                    this section yet.
                  </p>
                </div>
              )}
            </section>
          );
        })}

        <BrandDirectionWorkspace
          intelligence={intelligence}
        />

        <BrandAlignmentWorkspace
          intelligence={intelligence}
        />
        {additionalResponses.length > 0 && (
          <section
            id="additional"
            className="scroll-mt-8 border-t border-white/10 py-12 sm:py-16"
          >
            <div className="mb-7">
              <p className="text-xs font-semibold tracking-[0.18em] text-[#c5a577] uppercase">
                Discovery
              </p>

              <h2 className="mt-3 text-3xl font-medium tracking-[-0.035em]">
                Additional responses
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/40">
                Responses from later
                questionnaire sections remain
                visible even before their full
                intelligence views are added.
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {additionalResponses.map(
                (response) => (
                  <ResponseCard
                    key={
                      response.question_id
                    }
                    response={response}
                  />
                ),
              )}
            </div>
          </section>
        )}

        <section className="border-t border-white/10 py-12">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 p-5">
              <p className="text-[10px] tracking-[0.14em] text-white/25 uppercase">
                Website
              </p>

              <p className="mt-3 break-words text-sm text-white/60">
                {client.website ||
                  "Not provided"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 p-5">
              <p className="text-[10px] tracking-[0.14em] text-white/25 uppercase">
                Client created
              </p>

              <p className="mt-3 text-sm text-white/60">
                {formatDate(
                  client.created_at,
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 p-5">
              <p className="text-[10px] tracking-[0.14em] text-white/25 uppercase">
                Discovery updated
              </p>

              <p className="mt-3 text-sm text-white/60">
                {formatDate(
                  project?.updated_at,
                )}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

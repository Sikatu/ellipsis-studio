"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  questionnaireSections,
  questions,
  type Question,
} from "@/lib/questionnaire";

type Answer =
  | string
  | string[]
  | number;

type DiscoveryStatus =
  | "in_progress"
  | "submitted";

type SaveState =
  | "saved"
  | "saving"
  | "error";

function isAnswered(
  question: Question,
  value:
    | Answer
    | undefined,
) {
  void question;

  if (
    typeof value === "number"
  ) {
    return value >= 1;
  }

  if (
    Array.isArray(value)
  ) {
    return value.length > 0;
  }

  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function formatAnswer(
  value:
    | Answer
    | undefined,
) {
  if (
    Array.isArray(value)
  ) {
    return value.join(", ");
  }

  if (
    typeof value === "number"
  ) {
    return `${value} / 7`;
  }

  if (!value) {
    return "Not provided";
  }

  return value;
}

export default function DiscoveryFlow({
  token,
}: {
  token: string;
}) {
  const [
    answers,
    setAnswers,
  ] = useState<
    Record<string, Answer>
  >({});

  const [
    currentIndex,
    setCurrentIndex,
  ] = useState(0);

  const [
    status,
    setStatus,
  ] =
    useState<DiscoveryStatus>(
      "in_progress",
    );

  const [
    submittedAt,
    setSubmittedAt,
  ] =
    useState<
      string | undefined
    >();

  const [
    brandName,
    setBrandName,
  ] = useState("");

  const [
    hydrated,
    setHydrated,
  ] = useState(false);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    saveState,
    setSaveState,
  ] =
    useState<SaveState>(
      "saved",
    );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response =
          await fetch(
            `/api/discovery/${encodeURIComponent(token)}`,
            {
              cache:
                "no-store",
            },
          );

        const data =
          await response.json();

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ??
              "Unable to load this discovery.",
          );
        }

        if (!active) {
          return;
        }

        setAnswers(
          data.answers ?? {},
        );

        setBrandName(
          data.brandName ?? "",
        );

        setStatus(
          data.status ===
            "submitted"
            ? "submitted"
            : "in_progress",
        );

        setSubmittedAt(
          data.submittedAt ??
            undefined,
        );

        setCurrentIndex(
          Math.max(
            0,
            Math.min(
              questions.length,
              Number(
                data.currentQuestionIndex ??
                  0,
              ),
            ),
          ),
        );
      }
      catch (
        loadFailure
      ) {
        if (!active) {
          return;
        }

        setLoadError(
          loadFailure instanceof
            Error
            ? loadFailure.message
            : "Unable to load this discovery.",
        );
      }
      finally {
        if (active) {
          setHydrated(true);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [token]);

  const completedRequired =
    useMemo(
      () =>
        questions.filter(
          (question) =>
            isAnswered(
              question,
              answers[
                question.id
              ],
            ),
        ).length,
      [answers],
    );

  const progress =
    Math.round(
      (completedRequired /
        questions.length) *
        100,
    );

  useEffect(() => {
    if (
      !hydrated ||
      loadError ||
      status ===
        "submitted"
    ) {
      return;
    }

    const controller =
      new AbortController();

    const timer =
      window.setTimeout(
        async () => {
          setSaveState(
            "saving",
          );

          try {
            const response =
              await fetch(
                `/api/discovery/${encodeURIComponent(token)}`,
                {
                  method:
                    "PATCH",
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                  body:
                    JSON.stringify({
                      answers,
                      currentQuestionIndex:
                        currentIndex,
                    }),
                  signal:
                    controller.signal,
                },
              );

            if (
              !response.ok
            ) {
              throw new Error(
                "Save failed.",
              );
            }

            setSaveState(
              "saved",
            );
          }
          catch (
            saveFailure
          ) {
            if (
              controller
                .signal
                .aborted
            ) {
              return;
            }

            console.error(
              saveFailure,
            );

            setSaveState(
              "error",
            );
          }
        },
        700,
      );

    return () => {
      window.clearTimeout(
        timer,
      );

      controller.abort();
    };
  }, [
    answers,
    currentIndex,
    hydrated,
    loadError,
    status,
    token,
  ]);

  const currentQuestion =
    questions[
      currentIndex
    ];

  const isReview =
    currentIndex >=
    questions.length;

  function updateAnswer(
    id: string,
    value: Answer,
  ) {
    setAnswers(
      (current) => ({
        ...current,
        [id]: value,
      }),
    );

    setError("");
  }

  function goNext() {
    if (
      !currentQuestion
    ) {
      return;
    }

    if (
      currentQuestion
        .required &&
      !isAnswered(
        currentQuestion,
        answers[
          currentQuestion
            .id
        ],
      )
    ) {
      setError(
        "Please answer this question before continuing.",
      );

      return;
    }

    setError("");

    setCurrentIndex(
      (index) =>
        Math.min(
          index + 1,
          questions.length,
        ),
    );
  }

  function goBack() {
    setError("");

    setCurrentIndex(
      (index) =>
        Math.max(
          index - 1,
          0,
        ),
    );
  }

  function toggleMulti(
    question: Question,
    option: string,
  ) {
    const current =
      Array.isArray(
        answers[
          question.id
        ],
      )
        ? (answers[
            question.id
          ] as string[])
        : [];

    if (
      current.includes(
        option,
      )
    ) {
      updateAnswer(
        question.id,
        current.filter(
          (item) =>
            item !== option,
        ),
      );

      return;
    }

    if (
      question.maxSelections &&
      current.length >=
        question.maxSelections
    ) {
      setError(
        `Choose up to ${question.maxSelections} options for this question.`,
      );

      return;
    }

    updateAnswer(
      question.id,
      [
        ...current,
        option,
      ],
    );
  }

  async function submitDiscovery() {
    const firstMissingIndex =
      questions.findIndex(
        (question) =>
          question.required &&
          !isAnswered(
            question,
            answers[
              question.id
            ],
          ),
      );

    if (
      firstMissingIndex !==
      -1
    ) {
      setCurrentIndex(
        firstMissingIndex,
      );

      setError(
        "Please complete this required question.",
      );

      return;
    }

    setSaveState(
      "saving",
    );

    try {
      const response =
        await fetch(
          `/api/discovery/${encodeURIComponent(token)}`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                answers,
              }),
          },
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        if (
          data.firstMissingQuestion
        ) {
          const index =
            questions.findIndex(
              (question) =>
                question.id ===
                data.firstMissingQuestion,
            );

          if (
            index !== -1
          ) {
            setCurrentIndex(
              index,
            );
          }
        }

        throw new Error(
          data.error ??
            "Unable to submit discovery.",
        );
      }

      setSubmittedAt(
        data.submittedAt,
      );

      setStatus(
        "submitted",
      );

      setSaveState(
        "saved",
      );
    }
    catch (
      submissionError
    ) {
      setSaveState(
        "error",
      );

      setError(
        submissionError instanceof
          Error
          ? submissionError.message
          : "Unable to submit discovery.",
      );
    }
  }

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-[#f4f0e8] text-[#161612]">
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm tracking-[0.2em] text-black/45 uppercase">
            Preparing your discovery
          </p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-[#12120f] px-6 py-10 text-[#f5f0e6]">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl flex-col">
          <header className="border-b border-white/10 pb-6">
            <Link
              href="/"
              className="text-xs font-semibold tracking-[0.24em] uppercase"
            >
              Ellipsis
            </Link>
          </header>

          <div className="my-auto max-w-2xl py-20">
            <p className="text-xs font-semibold tracking-[0.22em] text-[#c9aa7c] uppercase">
              Discovery unavailable
            </p>

            <h1 className="mt-5 text-4xl font-medium tracking-[-0.04em] sm:text-6xl">
              We could not open this private discovery.
            </h1>

            <p className="mt-6 text-base leading-8 text-white/50">
              {loadError}
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (
    status ===
    "submitted"
  ) {
    return (
      <main className="min-h-screen bg-[#12120f] px-6 py-10 text-[#f5f0e6]">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col">
          <header className="flex items-center justify-between border-b border-white/10 pb-6">
            <Link
              href="/"
              className="text-xs font-semibold tracking-[0.24em] uppercase"
            >
              Ellipsis
            </Link>

            <span className="text-xs tracking-[0.18em] text-white/45 uppercase">
              Brand Discovery
            </span>
          </header>

          <div className="my-auto max-w-3xl py-20">
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-full border border-[#c4a77c]/45 text-xl text-[#d7b98c]">
              ✓
            </div>

            <p className="mb-5 text-xs font-medium tracking-[0.25em] text-[#c9aa7c] uppercase">
              Discovery submitted
            </p>

            <h1 className="text-4xl leading-[1.05] font-medium tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Thank you. We now have the foundation for{" "}
              {brandName ||
                "your brand"}.
            </h1>

            <p className="mt-8 max-w-2xl text-base leading-8 text-white/55 sm:text-lg">
              Your responses are securely stored and ready for the studio&apos;s strategic analysis.
            </p>
          </div>

          <footer className="border-t border-white/10 pt-5 text-xs text-white/35">
            Submitted{" "}
            {submittedAt
              ? new Date(
                  submittedAt,
                ).toLocaleString()
              : ""}
          </footer>
        </div>
      </main>
    );
  }

  if (isReview) {
    return (
      <main className="min-h-screen bg-[#f4f0e8] px-5 py-6 text-[#161612] sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">
          <header className="flex items-center justify-between border-b border-black/10 pb-5">
            <Link
              href="/"
              className="text-xs font-semibold tracking-[0.24em] uppercase"
            >
              Ellipsis
            </Link>

            <span className="text-xs tracking-[0.18em] text-black/45 uppercase">
              {saveState ===
              "saving"
                ? "Saving..."
                : saveState ===
                    "error"
                  ? "Save issue"
                  : "Saved"}
            </span>
          </header>

          <section className="py-12 sm:py-16">
            <p className="mb-4 text-xs font-semibold tracking-[0.22em] text-[#8a6d46] uppercase">
              Final review
            </p>

            <h1 className="max-w-3xl text-4xl font-medium tracking-[-0.04em] sm:text-6xl">
              Review your discovery.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-black/55">
              Make any final changes before submitting your answers to the studio.
            </p>
          </section>

          <div className="space-y-12">
            {questionnaireSections.map(
              (section) => {
                const sectionQuestions =
                  questions.filter(
                    (question) =>
                      question.section ===
                      section,
                  );

                return (
                  <section
                    key={section}
                    className="border-t border-black/10 pt-6"
                  >
                    <p className="mb-6 text-xs font-semibold tracking-[0.2em] text-black/40 uppercase">
                      {section}
                    </p>

                    <div className="grid gap-3">
                      {sectionQuestions.map(
                        (question) => {
                          const questionIndex =
                            questions.findIndex(
                              (item) =>
                                item.id ===
                                question.id,
                            );

                          return (
                            <button
                              type="button"
                              key={
                                question.id
                              }
                              onClick={() =>
                                setCurrentIndex(
                                  questionIndex,
                                )
                              }
                              className="group grid gap-4 rounded-2xl border border-black/10 bg-white/55 p-5 text-left transition hover:border-black/25 hover:bg-white sm:grid-cols-[1fr_1.3fr_auto] sm:items-start"
                            >
                              <span className="text-sm font-medium">
                                {
                                  question.title
                                }
                              </span>

                              <span className="text-sm leading-6 text-black/55">
                                {formatAnswer(
                                  answers[
                                    question.id
                                  ],
                                )}
                              </span>

                              <span className="text-xs font-semibold tracking-[0.15em] text-[#8a6d46] uppercase">
                                Edit
                              </span>
                            </button>
                          );
                        },
                      )}
                    </div>
                  </section>
                );
              },
            )}
          </div>

          {error && (
            <p className="mt-6 text-sm font-medium text-[#9a3e2f]">
              {error}
            </p>
          )}

          <div className="mt-14 flex flex-col-reverse justify-between gap-4 border-t border-black/10 py-8 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={goBack}
              className="rounded-full border border-black/15 px-6 py-3 text-sm font-medium"
            >
              Back
            </button>

            <button
              type="button"
              onClick={
                submitDiscovery
              }
              className="rounded-full bg-[#161612] px-8 py-3 text-sm font-medium text-white"
            >
              Submit discovery
            </button>
          </div>
        </div>
      </main>
    );
  }

  const answer =
    answers[
      currentQuestion.id
    ];

  const sectionIndex =
    questionnaireSections.indexOf(
      currentQuestion.section,
    );

  return (
    <main className="min-h-screen bg-[#f4f0e8] text-[#161612]">
      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col px-5 py-5 sm:px-8 sm:py-7">
        <header>
          <div className="flex items-center justify-between gap-6">
            <Link
              href="/"
              className="text-xs font-semibold tracking-[0.24em] uppercase"
            >
              Ellipsis
            </Link>

            <div className="flex items-center gap-5">
              <span
                className={`hidden text-xs tracking-[0.14em] uppercase sm:block ${
                  saveState ===
                  "error"
                    ? "text-[#9a3e2f]"
                    : "text-black/35"
                }`}
              >
                {saveState ===
                "saving"
                  ? "Saving..."
                  : saveState ===
                      "error"
                    ? "Save issue"
                    : "Saved"}
              </span>

              <span className="text-xs tabular-nums text-black/50">
                {progress}%
              </span>
            </div>
          </div>

          <div className="mt-5 h-px overflow-hidden bg-black/10">
            <div
              className="h-full bg-[#161612] transition-all duration-500"
              style={{
                width:
                  `${progress}%`,
              }}
            />
          </div>
        </header>

        <div className="grid flex-1 lg:grid-cols-[280px_1fr]">
          <aside className="hidden border-r border-black/10 py-10 pr-8 lg:block">
            <p className="mb-7 text-[11px] font-semibold tracking-[0.22em] text-black/35 uppercase">
              Discovery
            </p>

            <div className="space-y-1">
              {questionnaireSections.map(
                (
                  section,
                  index,
                ) => {
                  const active =
                    section ===
                    currentQuestion.section;

                  const passed =
                    index <
                    sectionIndex;

                  return (
                    <div
                      key={
                        section
                      }
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${
                        active
                          ? "bg-white/65 text-black"
                          : "text-black/35"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] ${
                          active
                            ? "border-black bg-black text-white"
                            : passed
                              ? "border-[#9f8157] bg-[#9f8157] text-white"
                              : "border-black/15"
                        }`}
                      >
                        {passed
                          ? "✓"
                          : index +
                            1}
                      </span>

                      {section}
                    </div>
                  );
                },
              )}
            </div>
          </aside>

          <section className="flex items-center py-12 lg:px-16 lg:py-16 xl:px-24">
            <div className="w-full max-w-4xl">
              <div className="mb-7 flex items-center justify-between gap-5">
                <p className="text-xs font-semibold tracking-[0.22em] text-[#8a6d46] uppercase">
                  {
                    currentQuestion.eyebrow
                  }
                </p>

                <span className="text-xs text-black/35">
                  {currentIndex +
                    1}{" "}
                  /{" "}
                  {
                    questions.length
                  }
                </span>
              </div>

              <h1 className="max-w-4xl text-4xl leading-[1.04] font-medium tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                {
                  currentQuestion.title
                }
              </h1>

              {currentQuestion.description && (
                <p className="mt-5 max-w-2xl text-base leading-7 text-black/50">
                  {
                    currentQuestion.description
                  }
                </p>
              )}

              <div className="mt-10">
                {currentQuestion.type ===
                  "text" && (
                  <input
                    autoFocus
                    value={
                      typeof answer ===
                      "string"
                        ? answer
                        : ""
                    }
                    onChange={(
                      event,
                    ) =>
                      updateAnswer(
                        currentQuestion.id,
                        event.target.value,
                      )
                    }
                    onKeyDown={(
                      event,
                    ) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        goNext();
                      }
                    }}
                    placeholder={
                      currentQuestion.placeholder
                    }
                    className="w-full border-0 border-b border-black/20 bg-transparent px-0 py-5 text-xl outline-none transition placeholder:text-black/25 focus:border-black sm:text-2xl"
                  />
                )}

                {currentQuestion.type ===
                  "textarea" && (
                  <textarea
                    autoFocus
                    value={
                      typeof answer ===
                      "string"
                        ? answer
                        : ""
                    }
                    onChange={(
                      event,
                    ) =>
                      updateAnswer(
                        currentQuestion.id,
                        event.target.value,
                      )
                    }
                    placeholder={
                      currentQuestion.placeholder
                    }
                    rows={6}
                    className="w-full resize-none rounded-2xl border border-black/10 bg-white/50 p-5 text-lg leading-8 outline-none transition placeholder:text-black/25 focus:border-black/35 focus:bg-white/75"
                  />
                )}

                {currentQuestion.type ===
                  "single" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {currentQuestion.options?.map(
                      (
                        option,
                      ) => {
                        const selected =
                          answer ===
                          option;

                        return (
                          <button
                            type="button"
                            key={
                              option
                            }
                            onClick={() =>
                              updateAnswer(
                                currentQuestion.id,
                                option,
                              )
                            }
                            className={`rounded-2xl border p-5 text-left text-base font-medium transition ${
                              selected
                                ? "border-[#161612] bg-[#161612] text-white"
                                : "border-black/10 bg-white/45 hover:border-black/30 hover:bg-white/75"
                            }`}
                          >
                            {
                              option
                            }
                          </button>
                        );
                      },
                    )}
                  </div>
                )}

                {currentQuestion.type ===
                  "multi" && (
                  <div>
                    <div className="flex flex-wrap gap-3">
                      {currentQuestion.options?.map(
                        (
                          option,
                        ) => {
                          const selected =
                            Array.isArray(
                              answer,
                            ) &&
                            answer.includes(
                              option,
                            );

                          return (
                            <button
                              type="button"
                              key={
                                option
                              }
                              onClick={() =>
                                toggleMulti(
                                  currentQuestion,
                                  option,
                                )
                              }
                              className={`rounded-full border px-5 py-3 text-sm font-medium transition ${
                                selected
                                  ? "border-[#161612] bg-[#161612] text-white"
                                  : "border-black/10 bg-white/50 hover:border-black/30 hover:bg-white"
                              }`}
                            >
                              {selected
                                ? "✓ "
                                : ""}
                              {
                                option
                              }
                            </button>
                          );
                        },
                      )}
                    </div>

                    {currentQuestion.maxSelections && (
                      <p className="mt-5 text-xs text-black/35">
                        {Array.isArray(
                          answer,
                        )
                          ? answer.length
                          : 0}{" "}
                        /{" "}
                        {
                          currentQuestion.maxSelections
                        }{" "}
                        selected
                      </p>
                    )}
                  </div>
                )}

                {currentQuestion.type ===
                  "scale" && (
                  <div className="max-w-3xl">
                    <div className="grid grid-cols-7 gap-2 sm:gap-3">
                      {[
                        1, 2, 3, 4,
                        5, 6, 7,
                      ].map(
                        (
                          value,
                        ) => {
                          const selected =
                            answer ===
                            value;

                          return (
                            <button
                              type="button"
                              key={
                                value
                              }
                              onClick={() =>
                                updateAnswer(
                                  currentQuestion.id,
                                  value,
                                )
                              }
                              className={`aspect-square rounded-2xl border text-base font-medium transition sm:text-lg ${
                                selected
                                  ? "border-[#161612] bg-[#161612] text-white"
                                  : "border-black/10 bg-white/50 hover:border-black/30 hover:bg-white"
                              }`}
                            >
                              {
                                value
                              }
                            </button>
                          );
                        },
                      )}
                    </div>

                    <div className="mt-4 flex justify-between text-xs font-medium text-black/45">
                      <span>
                        {
                          currentQuestion.leftLabel
                        }
                      </span>

                      <span>
                        {
                          currentQuestion.rightLabel
                        }
                      </span>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="mt-5 text-sm font-medium text-[#9a3e2f]">
                    {error}
                  </p>
                )}
              </div>

              <div className="mt-12 flex items-center gap-3">
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-full bg-[#161612] px-7 py-3.5 text-sm font-medium text-white transition hover:bg-black"
                >
                  {currentIndex ===
                  questions.length -
                    1
                    ? "Review answers"
                    : "Continue"}
                  <span className="ml-2">
                    →
                  </span>
                </button>

                {currentIndex >
                  0 && (
                  <button
                    type="button"
                    onClick={
                      goBack
                    }
                    className="rounded-full px-5 py-3.5 text-sm font-medium text-black/50 transition hover:text-black"
                  >
                    Back
                  </button>
                )}

                {!currentQuestion.required && (
                  <button
                    type="button"
                    onClick={
                      goNext
                    }
                    className="ml-auto text-xs font-medium tracking-[0.12em] text-black/35 uppercase transition hover:text-black"
                  >
                    Skip
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-between border-t border-black/10 pt-5 text-[11px] tracking-[0.12em] text-black/30 uppercase">
          <span>
            Ellipsis Brand Discovery
          </span>

          <span>
            Private discovery
          </span>
        </footer>
      </div>
    </main>
  );
}

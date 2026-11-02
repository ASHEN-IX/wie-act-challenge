"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import MathContent from "@/features/reader/math-content";
import * as actions from "./formula-actions";
import type { FormulaWorkspace, FormulaResult } from "./formula-types";

export function FormulaReview({
  courseId,
  revisionTag,
  disabled = false,
}: {
  courseId: string;
  revisionTag: string;
  disabled?: boolean;
}) {
  const [workspace, setWorkspace] = useState<FormulaWorkspace | null>(null);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [correction, setCorrection] = useState("");
  const [pollGeneration, setPollGeneration] = useState(0);
  const working = useRef(false);
  const [cropError, setCropError] = useState(false);
  const serial = useRef(0),
    polls = useRef({ id: "", count: 0 });
  const region = workspace?.regions.find(
    (r) => `${r.documentId}/${r.regionId}` === selected,
  );
  const proposal = workspace?.proposals.find(
    (p) =>
      p.regionId === region?.regionId && p.documentId === region?.documentId,
  );
  const job = workspace?.jobs.find(
    (j) =>
      j.regionId === region?.regionId && j.documentId === region?.documentId,
  );
  const active = job?.state === "queued" || job?.state === "running";
  async function refresh(token = serial.current) {
    let result: Awaited<ReturnType<typeof actions.loadFormulaWorkspace>>;
    try {
      result = await actions.loadFormulaWorkspace(courseId, revisionTag);
    } catch {
      if (token === serial.current)
        setMessage("Formula service unavailable. Refresh to retry.");
      return;
    }
    if (token !== serial.current) return;
    if (result.ok) {
      setWorkspace(result.data);
      setSelected(
        (old) =>
          old ||
          (result.data.regions[0]
            ? `${result.data.regions[0].documentId}/${result.data.regions[0].regionId}`
            : ""),
      );
    } else {
      setMessage(result.error);
      if ([401, 403, 409].includes(result.status)) setWorkspace(null);
    }
  }
  useEffect(() => {
    const token = ++serial.current;
    setWorkspace(null);
    setSelected("");
    setMessage("");
    setBusy(false);
    working.current = false;
    void refresh(token);
    return () => {
      serial.current++;
    };
  }, [courseId, revisionTag]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setCropError(false);
    setCorrection(proposal?.reviewedLatex || proposal?.latex || "");
  }, [selected, proposal?._id, proposal?.reviewVersion]);
  useEffect(() => {
    if (!job || !active) return;
    if (polls.current.id !== job._id) polls.current = { id: job._id, count: 0 };
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    const token = serial.current;
    async function poll() {
      if (stopped || token !== serial.current) return;
      if (++polls.current.count > 40) {
        setMessage("Polling paused. Refresh formula status to continue.");
        return;
      }
      const result = await actions.getFormulaJob(
        courseId,
        revisionTag,
        job!._id,
      );
      if (stopped || token !== serial.current) return;
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      if (["queued", "running"].includes(result.data.job.state)) {
        setWorkspace((w) =>
          w
            ? {
                ...w,
                jobs: w.jobs.map((j) =>
                  j._id === result.data.job._id ? result.data.job : j,
                ),
              }
            : w,
        );
        timer = setTimeout(() => {
          void poll().catch(
            () =>
              !stopped &&
              token === serial.current &&
              setMessage("Status connection interrupted. Refresh to retry."),
          );
        }, 2000);
      } else if (
        result.data.job.state === "completed" &&
        result.data.job.proposalId
      ) {
        const saved = await actions.readFormulaProposal(
          courseId,
          revisionTag,
          result.data.job.proposalId,
        );
        if (!stopped && token === serial.current && saved.ok)
          setWorkspace((w) =>
            w
              ? {
                  ...w,
                  jobs: w.jobs.map((j) =>
                    j._id === result.data.job._id ? result.data.job : j,
                  ),
                  proposals: [
                    saved.data.proposal,
                    ...w.proposals.filter(
                      (p) => p._id !== saved.data.proposal._id,
                    ),
                  ],
                }
              : w,
          );
        else if (!stopped && !saved.ok) setMessage(saved.error);
      } else
        setWorkspace((w) =>
          w
            ? {
                ...w,
                jobs: w.jobs.map((j) =>
                  j._id === result.data.job._id ? result.data.job : j,
                ),
              }
            : w,
        );
    }
    timer = setTimeout(() => {
      void poll().catch(
        () =>
          !stopped &&
          token === serial.current &&
          setMessage("Status connection interrupted. Refresh to retry."),
      );
    }, 2000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [job?._id, active, courseId, revisionTag, pollGeneration]);
  async function perform<T>(
    work: () => Promise<FormulaResult<T>>,
    success: string,
  ) {
    if (working.current) return;
    working.current = true;
    const token = serial.current;
    setBusy(true);
    setMessage("");
    try {
      const result = await work();
      if (token !== serial.current) return;
      setMessage(
        result.ok
          ? success
          : result.status === 409
            ? "The draft or review changed. Refreshed the saved state."
            : result.error,
      );
      await refresh(token);
    } catch {
      if (token === serial.current)
        setMessage("The service is unavailable. Refresh and try again.");
    } finally {
      if (token === serial.current) {
        working.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <section
      aria-label="Formula review"
      className="space-y-4 rounded-xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Formula review</h2>
          <p className="text-sm text-muted-foreground">
            Compare reconstructions with the original PDF before recording a
            decision.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            polls.current.count = 0;
            setCropError(false);
            setPollGeneration((n) => n + 1);
            void refresh();
          }}
        >
          Refresh formula status
        </Button>
      </div>
      {workspace && (
        <div className="text-sm" aria-label="Formula publication readiness">
          {(["accepted", "corrected", "rejected", "pending"] as const).map(
            (state) => (
              <span className="mr-3" key={state}>
                {state}:{" "}
                {workspace.proposals.filter((p) => p.state === state).length}
              </span>
            ),
          )}
          <span>stale: {workspace.staleFormulaReviews || 0}</span>
          <p>
            Accepted and corrected formulas from this exact draft appear in a
            new published snapshot. Pending, rejected and missing proposals keep
            the source expression.
          </p>
          {!!workspace.staleFormulaReviews && (
            <p>
              Older draft reviews will not transfer. Review this draft again to
              publish a new reconstruction.
            </p>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="whitespace-pre-wrap text-sm">
          {message}
        </p>
      )}
      {disabled && (
        <p>
          Save or discard course edits before requesting or reviewing formulas.
        </p>
      )}
      {!workspace ? (
        <p>Formula workspace unavailable or loading.</p>
      ) : !workspace.regions.length ? (
        <p>No mathematical source regions are available in this draft.</p>
      ) : (
        <>
          <label className="block text-sm font-medium">
            Mathematical source region
            <select
              className="mt-2 block w-full rounded-md border bg-background p-2"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setMessage("");
              }}
              disabled={busy}
            >
              {workspace.regions.map((r) => (
                <option
                  key={`${r.documentId}/${r.regionId}`}
                  value={`${r.documentId}/${r.regionId}`}
                >
                  Page {r.page} · {r.text.slice(0, 80)}
                </option>
              ))}
            </select>
          </label>
          {region && (
            <div className="grid min-w-0 gap-5 lg:grid-cols-2">
              <div className="min-w-0 space-y-3">
                <h3 className="font-semibold">Original source</h3>
                <p className="break-all text-xs">
                  {region.documentId} · Page {region.page} · {region.regionId}
                </p>
                {cropError ? (
                  <p role="alert">
                    Source crop unavailable. Refresh the current draft and
                    retry.
                  </p>
                ) : (
                  <img
                    className="max-h-80 max-w-full rounded border bg-white object-contain"
                    src={`/api/formula-crop?${new URLSearchParams({ course: courseId, revision: revisionTag, document: region.documentId, region: region.regionId })}`}
                    alt={`Original mathematical expression, page ${region.page}`}
                    onError={() => setCropError(true)}
                  />
                )}
                <h4 className="text-sm font-medium">Extracted text</h4>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-3 text-sm">
                  {region.text}
                </pre>
                {region.warnings.map((w, i) => (
                  <p key={i} className="text-sm">
                    Extraction warning: {w}
                  </p>
                ))}
                <p className="text-sm text-muted-foreground">
                  Recognition sends selected source crops to Gemini only when
                  the server permits it.
                </p>
                {workspace.canConsent ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || busy}
                    onClick={() =>
                      void perform(
                        () =>
                          actions.grantFormulaConsent(
                            courseId,
                            revisionTag,
                            region.documentId,
                            workspace.draftVersion,
                          ),
                        "Document consent recorded for Gemini.",
                      )
                    }
                  >
                    Authorize this document for Gemini
                  </Button>
                ) : (
                  <p className="text-sm">
                    New document consent must be granted by the course owner.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={disabled || busy || !!job || !!proposal}
                    onClick={() =>
                      void perform(
                        () =>
                          actions.requestFormulaRecognition(
                            courseId,
                            revisionTag,
                            region.documentId,
                            region.regionId,
                            workspace.draftVersion,
                          ),
                        "Recognition job submitted.",
                      )
                    }
                  >
                    Request Gemini recognition
                  </Button>
                  {active && job && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void perform(
                          () =>
                            actions.cancelFormulaJob(
                              courseId,
                              revisionTag,
                              job._id,
                            ),
                          "Cancellation requested.",
                        )
                      }
                    >
                      Cancel recognition
                    </Button>
                  )}
                </div>
              </div>
              <div className="min-w-0 space-y-3">
                <h3 className="font-semibold">Recognition and review</h3>
                <p role="status">
                  Job: {job?.state || "not requested"}
                  {job?.error ? ` · ${job.error}` : ""}
                </p>
                {!proposal ? (
                  <p>No saved proposal for this region.</p>
                ) : (
                  <>
                    <p>
                      Review state: <strong>{proposal.state}</strong>
                    </p>
                    <p className="break-all text-xs">
                      {proposal.provider} ·{" "}
                      {proposal.modelVersion || proposal.model} · review version{" "}
                      {proposal.reviewVersion}
                    </p>
                    <h4 className="text-sm font-medium">
                      Original generated LaTeX
                    </h4>
                    <pre className="overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-3 text-sm">
                      {proposal.latex}
                    </pre>
                    <MathContent
                      expression={proposal.reviewedLatex || proposal.latex}
                      notation="latex"
                    />
                    {proposal.warnings.map((w, i) => (
                      <p key={i}>Validation warning: {w}</p>
                    ))}
                    <p className="text-sm">
                      Model output is a proposal. A recorded instructor decision
                      is separate from original PDF evidence.
                    </p>
                    {proposal.state === "pending" ? (
                      <>
                        <label className="block text-sm font-medium">
                          Corrected LaTeX
                          <Textarea
                            value={correction}
                            maxLength={8000}
                            onChange={(e) => setCorrection(e.target.value)}
                            disabled={disabled || busy}
                          />
                        </label>
                        <MathContent expression={correction} notation="latex" />
                        <div className="flex flex-wrap gap-2">
                          {(["accept", "correct", "reject"] as const).map(
                            (action) => (
                              <Button
                                type="button"
                                key={action}
                                variant={
                                  action === "accept" ? "default" : "outline"
                                }
                                disabled={
                                  disabled ||
                                  busy ||
                                  (action === "correct" && !correction.trim())
                                }
                                onClick={() =>
                                  void perform(
                                    () =>
                                      actions.reviewFormulaProposal(
                                        courseId,
                                        revisionTag,
                                        proposal._id,
                                        action,
                                        proposal.reviewVersion,
                                        workspace.draftVersion,
                                        correction,
                                      ),
                                    "Review decision saved.",
                                  )
                                }
                              >
                                {action === "accept"
                                  ? "Accept proposal"
                                  : action === "correct"
                                    ? "Save correction"
                                    : "Reject proposal"}
                              </Button>
                            ),
                          )}
                        </div>
                      </>
                    ) : (
                      <p>This decision is final for this proposal.</p>
                    )}
                    <details
                      onToggle={(e) => {
                        if (e.currentTarget.open) {
                          const token = serial.current;
                          void actions
                            .formulaReviewHistory(
                              courseId,
                              revisionTag,
                              proposal._id,
                            )
                            .then((r) => {
                              if (token !== serial.current) return;
                              if (r.ok)
                                setWorkspace((w) =>
                                  w
                                    ? {
                                        ...w,
                                        proposals: w.proposals.map((p) =>
                                          p._id === proposal._id
                                            ? { ...p, history: r.data.history }
                                            : p,
                                        ),
                                      }
                                    : w,
                                );
                              else setMessage(r.error);
                            })
                            .catch(() => setMessage("History unavailable."));
                        }
                      }}
                    >
                      <summary className="cursor-pointer font-medium">
                        Review history ({proposal.history.length})
                      </summary>
                      <ol className="space-y-2 pt-2">
                        {proposal.history.map((h, i) => (
                          <li key={i} className="break-words text-sm">
                            {h.previous} → {h.next} · {h.reviewer} ·{" "}
                            <time dateTime={h.at}>{h.at}</time>
                            {h.expression && (
                              <pre className="whitespace-pre-wrap">
                                {h.expression}
                              </pre>
                            )}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

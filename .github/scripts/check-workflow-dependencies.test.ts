import { describe, it, expect, mock } from "bun:test";
import {
  isRunSuccessful,
  findRunForWorkflow,
  checkAllDependencies,
  type WorkflowRun,
  type RunFetcher,
} from "./check-workflow-dependencies";

const makeRun = (
  name: string,
  status: WorkflowRun["status"],
  conclusion: WorkflowRun["conclusion"],
): WorkflowRun => ({ name, status, conclusion });

describe("isRunSuccessful", () => {
  it("Returns true for a completed+success run", () => {
    expect(isRunSuccessful(makeRun("CI A", "completed", "success"))).toBe(true);
  });

  it("Returns false for an in_progress run", () => {
    expect(isRunSuccessful(makeRun("CI A", "in_progress", null))).toBe(false);
  });

  it("Returns false for a completed+failure run", () => {
    expect(isRunSuccessful(makeRun("CI A", "completed", "failure"))).toBe(
      false,
    );
  });
});

describe("findRunForWorkflow", () => {
  it("Returns the matching run by workflow name", () => {
    const runs = [
      makeRun("CI A", "completed", "success"),
      makeRun("CI B", "completed", "success"),
    ];
    expect(findRunForWorkflow(runs, "CI A")).toEqual(runs[0]);
  });

  it("Returns undefined when no run matches the given name", () => {
    const runs = [makeRun("CI B", "completed", "success")];
    expect(findRunForWorkflow(runs, "CI A")).toBeUndefined();
  });
});

describe("checkAllDependencies", () => {
  const callWith = (runs: WorkflowRun[], deps = ["CI A", "CI B"]) => {
    const fetchRuns: RunFetcher = mock(async () => runs);
    return checkAllDependencies(
      deps,
      "sha123",
      "owner/repo",
      "token",
      fetchRuns,
    );
  };

  it("Returns true when all dependencies completed successfully", async () => {
    const runs = [
      makeRun("CI A", "completed", "success"),
      makeRun("CI B", "completed", "success"),
    ];
    expect(await callWith(runs)).toBe(true);
  });

  it("Returns false when one dependency has a failed conclusion", async () => {
    const runs = [
      makeRun("CI A", "completed", "success"),
      makeRun("CI B", "completed", "failure"),
    ];
    expect(await callWith(runs)).toBe(false);
  });

  it("Returns false when a dependency has no matching run", async () => {
    const runs = [makeRun("CI B", "completed", "success")];
    expect(await callWith(runs)).toBe(false);
  });
});

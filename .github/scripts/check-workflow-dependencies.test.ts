import { describe, it, expect } from "bun:test";
import {
  findRunForWorkflow,
  buildWorkflowStatuses,
  isAllCompleted,
  isAllPassed,
  type WorkflowRun,
  type WorkflowStatus,
} from "./check-workflow-dependencies";

const makeRun = (
  name: string,
  status: WorkflowRun["status"],
  conclusion: WorkflowRun["conclusion"],
  id = 1,
): WorkflowRun => ({ id, name, status, conclusion });

const makeStatus = (
  name: string,
  status: WorkflowStatus["status"],
  conclusion: WorkflowStatus["conclusion"],
  runId = "1",
): WorkflowStatus => ({ runId, name, status, conclusion });

describe("findRunForWorkflow", () => {
  it("Returns the matching run by workflow name", () => {
    const runs = [
      makeRun("CI A", "completed", "success"),
      makeRun("CI B", "completed", "success"),
    ];
    expect(findRunForWorkflow(runs, "CI B")).toEqual(runs[1]);
  });

  it("Returns undefined when no run matches the given name", () => {
    const runs = [makeRun("CI B", "completed", "success")];
    expect(findRunForWorkflow(runs, "CI A")).toBeUndefined();
  });
});

describe("buildWorkflowStatuses", () => {
  it("Maps a found run to its corresponding WorkflowStatus", () => {
    const runs = [makeRun("CI A", "completed", "success", 42)];
    expect(buildWorkflowStatuses(runs, ["CI A"])).toEqual([
      { runId: "42", name: "CI A", status: "completed", conclusion: "success" },
    ]);
  });

  it("Maps a missing dependency as queued with an empty runId", () => {
    expect(buildWorkflowStatuses([], ["CI A"])).toEqual([
      { runId: "", name: "CI A", status: "queued", conclusion: null },
    ]);
  });

  it("Handles a mix of found and missing runs", () => {
    const runs = [makeRun("CI B", "completed", "success", 7)];
    expect(buildWorkflowStatuses(runs, ["CI A", "CI B"])).toEqual([
      { runId: "", name: "CI A", status: "queued", conclusion: null },
      { runId: "7", name: "CI B", status: "completed", conclusion: "success" },
    ]);
  });
});

describe("isAllCompleted", () => {
  it("Returns true when all statuses are completed", () => {
    const statuses = [
      makeStatus("CI A", "completed", "success"),
      makeStatus("CI B", "completed", "failure"),
    ];
    expect(isAllCompleted(statuses)).toBe(true);
  });

  it("Returns false when any status is not completed", () => {
    const statuses = [
      makeStatus("CI A", "completed", "success"),
      makeStatus("CI B", "in_progress", null),
    ];
    expect(isAllCompleted(statuses)).toBe(false);
  });

  it("Returns true for an empty list", () => {
    expect(isAllCompleted([])).toBe(true);
  });
});

describe("isAllPassed", () => {
  it("Returns true when all statuses are completed with success", () => {
    const statuses = [
      makeStatus("CI A", "completed", "success"),
      makeStatus("CI B", "completed", "success"),
    ];
    expect(isAllPassed(statuses)).toBe(true);
  });

  it("Returns false when any status has a non-success conclusion", () => {
    const statuses = [
      makeStatus("CI A", "completed", "success"),
      makeStatus("CI B", "completed", "failure"),
    ];
    expect(isAllPassed(statuses)).toBe(false);
  });

  it("Returns false when any status is not completed", () => {
    const statuses = [
      makeStatus("CI A", "completed", "success"),
      makeStatus("CI B", "in_progress", null),
    ];
    expect(isAllPassed(statuses)).toBe(false);
  });

  it("Returns true for an empty list", () => {
    expect(isAllPassed([])).toBe(true);
  });
});

import { appendFileSync } from "fs";

// https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-repository

// Possible run status values:
//   queued:      Waiting to be picked up by a runner
//   in_progress: Currently executing
//   completed:   Finished — check conclusion for the outcome
type RunStatus = "queued" | "in_progress" | "completed";

// Possible conclusion values (only set when status == "completed"):
//   success:          All jobs passed
//   failure:          One or more jobs failed
//   cancelled:        Run was manually cancelled
//   skipped:          Run was skipped (e.g. paths filter did not match)
//   timed_out:        Run exceeded the configured timeout
//   action_required:  Run is awaiting a manual approval gate
//   neutral:          Completed without a success/failure verdict (informational)
//   stale:            Superseded by a newer run before finishing
//   startup_failure:  Runner failed to start before executing any jobs
type RunConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "action_required"
  | "neutral"
  | "stale"
  | "startup_failure"
  | null;

export interface WorkflowRun {
  id: number;
  name: string;
  status: RunStatus;
  conclusion: RunConclusion;
}

export interface WorkflowStatus {
  runId: string;
  name: string;
  status: RunStatus;
  conclusion: RunConclusion;
}

export function findRunForWorkflow(
  runs: WorkflowRun[],
  name: string,
): WorkflowRun | undefined {
  return runs.find((run) => run.name === name);
}

function buildApiHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function fetchRunsResponse(
  repo: string,
  headSha: string,
  token: string,
): Promise<Response> {
  const url = `https://api.github.com/repos/${repo}/actions/runs?head_sha=${headSha}`;
  return fetch(url, { headers: buildApiHeaders(token) });
}

// TODO: handle duplicates for the same workflow (should return the latest)
// In practice if the workflows have concurrency groups I don't think this can
// happen. If it ever does ... Sorry 😅
export async function fetchWorkflowRuns(
  repo: string,
  headSha: string,
  token: string,
): Promise<WorkflowRun[]> {
  const response = await fetchRunsResponse(repo, headSha, token);
  if (!response.ok) {
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`,
    );
  }
  const data = (await response.json()) as { workflow_runs: WorkflowRun[] };
  return data.workflow_runs;
}

function mapRunToStatus(
  run: WorkflowRun | undefined,
  name: string,
): WorkflowStatus {
  if (!run) {
    return { runId: "", name, status: "queued", conclusion: null };
  }
  return { runId: String(run.id), name, status: run.status, conclusion: run.conclusion };
}

export function buildWorkflowStatuses(
  runs: WorkflowRun[],
  dependencies: string[],
): WorkflowStatus[] {
  return dependencies.map((name) => mapRunToStatus(findRunForWorkflow(runs, name), name));
}

export function isAllCompleted(statuses: WorkflowStatus[]): boolean {
  return statuses.every((s) => s.status === "completed");
}

export function isAllPassed(statuses: WorkflowStatus[]): boolean {
  return statuses.every(
    (s) => s.status === "completed" && s.conclusion === "success",
  );
}

function readEnvVars() {
  const { HEAD_SHA, DEPENDENCIES, GH_TOKEN, GITHUB_REPOSITORY } = process.env;
  if (!HEAD_SHA || !DEPENDENCIES || !GH_TOKEN || !GITHUB_REPOSITORY) {
    throw new Error(
      "Missing required env vars: HEAD_SHA, DEPENDENCIES, GH_TOKEN, GITHUB_REPOSITORY",
    );
  }
  return {
    headSha: HEAD_SHA,
    dependencies: JSON.parse(DEPENDENCIES) as string[],
    token: GH_TOKEN,
    repo: GITHUB_REPOSITORY,
  };
}

function writeGithubOutput(key: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) {
    throw new Error("GITHUB_OUTPUT is not set");
  }
  appendFileSync(outputFile, `${key}=${value}\n`);
}

if (import.meta.main) {
  const { headSha, dependencies, token, repo } = readEnvVars();
  console.log({ dependencies, headSha, repo });

  const workflowRuns = await fetchWorkflowRuns(repo, headSha, token);
  const workflowStatuses = buildWorkflowStatuses(workflowRuns, dependencies);
  const allCompleted = isAllCompleted(workflowStatuses);
  const allPassed = isAllPassed(workflowStatuses);

  writeGithubOutput("all_completed", String(allCompleted));
  writeGithubOutput("all_passed", String(allPassed));
  writeGithubOutput("workflow_statuses", JSON.stringify(workflowStatuses));
  console.log(`Dependencies check complete. all_completed=${allCompleted}, all_passed=${allPassed}`);
  console.log(workflowStatuses);
}

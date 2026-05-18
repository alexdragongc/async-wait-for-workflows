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
  name: string;
  status: RunStatus;
  conclusion: RunConclusion;
}

export type RunFetcher = (
  repo: string,
  headSha: string,
  token: string
) => Promise<WorkflowRun[]>;

export function findRunForWorkflow(
  runs: WorkflowRun[],
  name: string
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
  token: string
): Promise<Response> {
  const url = `https://api.github.com/repos/${repo}/actions/runs?head_sha=${headSha}`;
  return fetch(url, { headers: buildApiHeaders(token) });
}

export async function fetchWorkflowRuns(
  repo: string,
  headSha: string,
  token: string
): Promise<WorkflowRun[]> {
  const response = await fetchRunsResponse(repo, headSha, token);
  if (!response.ok)
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  const data = (await response.json()) as { workflow_runs: WorkflowRun[] };
  return data.workflow_runs;
}

function formatRunDetail(run: WorkflowRun | undefined): string {
  return run
    ? `status=${run.status}, conclusion=${run.conclusion}`
    : "no run found";
}

function logAndCheck(run: WorkflowRun | undefined, name: string, mustPass: boolean): boolean {
  const passed = run !== undefined && run.status === "completed" && (run.conclusion === "success" || !mustPass);
  console.log(`${name} -> ${formatRunDetail(run)} -> ${passed ? "passed" : "failed"}`);
  return passed;
}

export async function checkAllDependencies(
  dependencies: string[],
  headSha: string,
  repo: string,
  token: string,
  mustPass: boolean,
  fetchRuns: RunFetcher = fetchWorkflowRuns
): Promise<boolean> {
  const runs = await fetchRuns(repo, headSha, token);
  return dependencies.every((name) =>
    logAndCheck(findRunForWorkflow(runs, name), name, mustPass)
  );
}

function readEnvVars() {
  const { HEAD_SHA, DEPENDENCIES, GH_TOKEN, GITHUB_REPOSITORY, DEPENDENCIES_MUST_PASS } = process.env;
    if (!HEAD_SHA || !DEPENDENCIES || !GH_TOKEN || !GITHUB_REPOSITORY || !DEPENDENCIES_MUST_PASS)
    throw new Error(
      "Missing required env vars: HEAD_SHA, DEPENDENCIES, GH_TOKEN, GITHUB_REPOSITORY, DEPENDENCIES_MUST_PASS"
    );
  return {
    headSha: HEAD_SHA,
    dependencies: JSON.parse(DEPENDENCIES) as string[],
    token: GH_TOKEN,
    repo: GITHUB_REPOSITORY,
    mustPass: DEPENDENCIES_MUST_PASS === "true",
  };
}

if (import.meta.main) {
  const { headSha, dependencies, token, repo, mustPass } = readEnvVars();

  console.log({ dependencies, headSha, repo, mustPass });

  const allPassed = await checkAllDependencies(dependencies, headSha, repo, token, mustPass);
  if (!allPassed) {
    console.error("Not all dependencies passed.");
    process.exit(1);
  }
  console.log("All dependencies passed.");
}

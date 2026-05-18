# Asynchronously Wait for Dependency Workflows

Github doesn't provide a native way to wait for an arbitrary list of workflows
to complete before triggering another one. The only event we can work with is
[`workflow_run`](#https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run),
but this one is emitted any time a workflow completes.

The goal of this repository to showcase the piping required to achieve a
dependency chain.

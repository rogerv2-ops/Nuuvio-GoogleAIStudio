# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

Repo: `rogerv2-ops/Nuuvio-GoogleAIStudio` (https://github.com/rogerv2-ops/Nuuvio-GoogleAIStudio).

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

In this environment, `gh` needs `export GH_CONFIG_DIR=/home/ubuntu/.config/gh` and the git
credential helper (`git -c 'credential.helper=!gh auth git-credential'`) for pushes.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

This repo does not use external PRs as a request surface: the work arrives as issues and
leaves as pull requests created by the agent or the owner.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## How this repo actually works (for the agent)

This repo works on **branches + pull requests**, and a merge to `main` **deploys to
production automatically** (Coolify, Docker). That has two consequences the skills must
respect:

- **A change is not delivered until it is merged.** Opening a PR is not the same as
  shipping. Say which one happened.
- **Never merge without the owner's explicit approval.** He is the one who decides what
  reaches production. Prepare the PR, report the result, and wait.

The day-to-day control document is `odd/tasks/punto-10-modularizar-server.md` (specs,
tasks and a running log) and `odd/tasks/mapa-del-sistema.md` (the verified map of the
system: endpoints, tables, events, findings).

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue. Where sub-issues
  aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at
  the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`).
- **Blocking**: GitHub's native issue dependencies. Add an edge with
  `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`
  (the blocker's numeric **database id**, not the `#number`). Where dependencies aren't
  available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body.
- **Frontier query**: list the map's open children, drop any with an open blocker or an
  assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then
  append a context pointer to the map's Decisions-so-far.

Run a Socratic "Devil's Advocate" interview about the changes on the current branch BEFORE opening or merging a Pull Request into `environment/develop`.

## Step 1 — Gather context (don't ask me to paste an architecture description — pull it from git)

1. `git branch --show-current` — confirm I'm not on `environment/develop`, `environment/production`, or `main`.
2. `git fetch origin environment/develop` (if the remote is reachable).
3. `git diff origin/environment/develop...HEAD --stat` and the full `git diff origin/environment/develop...HEAD` — this is the actual review scope.
4. `git log origin/environment/develop..HEAD --oneline` — list of commits going into the PR.
5. Read the product context so the interview is grounded in the real architecture instead of guessing:
   - `.cursor/instructions/ENG-project-description.md`
   - `.cursor/instructions/ENG-prd.md`
   - `.cursor/instructions/ENG-tech-stack.md`

If the diff is trivial (typo fix, one-line config change, version bump) — say so explicitly and suggest skipping the interview instead of forcing it onto nothing.

## Step 2 — Socratic interview (`expenses-tracking-backend/docs/instructions/Socratic-interview.md`)

Ask me the 3 hardest, most challenging questions that push back on the decisions made in THIS branch — based EXCLUSIVELY on this diff, not a review of the whole system from scratch (unless the diff genuinely touches a foundational part of the architecture, e.g. auth, the data layer, caching). Focus on:

- Over-/under-engineering relative to what this change actually needed.
- Data consistency / failure-mode assumptions baked into the diff.
- Maintenance and operational cost this diff adds going forward.

**Ask the 3 questions and wait for my answers — do not generate them on my behalf and do not move on to the verdict without my answers.**

This is the only mandatory round. The other Devil's Advocate angles (`pre-mortem.md`, `resources-exhaustion.md`, `technology-debt-2y.md`) are available but optional — only pull one in if my answers above surface something that specifically warrants it (e.g. I reveal a real single point of failure, or the diff touches something genuinely load-bearing), or if I explicitly ask for a deeper pass. Don't run all four rounds by default — that's disproportionate for most changes and isn't sustainable as a habit.

## Step 3 — Classify findings

Classify each question's outcome as:

- 🔴 **Blocking** — must be fixed before merging into `environment/develop`.
- 🟡 **Worth considering** — an acceptable risk at this stage, but must be documented.
- 🟢 **OK** — considered, no further action needed.

## Step 4 — Save the report

Save the result to `.cursor/plans/documentation/pre-merge-reviews/<branch-slug>.md`, where `<branch-slug>` is the current branch name with every `/` replaced by `-` (e.g. branch `feat/BE-61-foo` → file `feat-BE-61-foo.md`). **This exact naming convention matters** — CI on `environment/develop` PRs verifies this file exists using the same slug rule, and will fail the build if the filename doesn't match.

The report must include: date, branch, diff scope (commits + files), the 3 questions with my answers, final classification of findings, and an **unambiguous verdict line** in the form `Verdict: GO`, `Verdict: GO with caveats`, or `Verdict: NO-GO`, with justification. Commit this file as part of the branch before opening the PR — CI reads it from the PR's head commit.

## Rules

- Be ruthless in the questions — your job is not to protect my feelings, it's to surface real blind spots in this specific branch.
- Don't skip the interview — it's the one input that requires my judgment as a human, not yours.
- Don't create a PR or suggest merging until the report has an explicit `GO` or `GO with caveats` verdict that I've accepted.

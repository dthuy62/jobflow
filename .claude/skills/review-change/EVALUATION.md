# review-change evaluation

The record of how the skill was tested, for whoever edits it next. Re-run
both cases after any change to the role prompts or scripts.

## Method

- **Baseline:** one fresh `general-purpose` subagent, no skill, told to find
  defects in the diff with the spec, severity, file:line, scenario, and fix.
- **Skill:** the session follows `SKILL.md`. Layer 0 and 1 scripts run, four
  fresh reviewers run in parallel, and then verifiers run for findings that
  are not in the ground truth.
- Reviewers were told not to read commits after HEAD, because the fix
  commits live in the same object store.
- Model: Opus 5.5 for all agents. Each arm ran once (n=1), so read the
  results as an indication, not a statistic.

## Case 1: PR #1 before the review fixes (`f4547335..f01a6de`, 92 files, +4744 lines)

Ground truth comes from the three fix commits that landed before the merge:

| Defect | Fixed in | Baseline | Skill reviewers |
| --- | --- | --- | --- |
| Impossible calendar date → 500 on `/offers`, `/reports` | `7e5b4e6` | found, verified | Spec, Impact, Tests: found, verified |
| URL userinfo returned in `/offers` | `168d69f` | found, verified | Tests, Security: found, verified |
| Artifact stream not bounded to `Content-Length` | `1053dd0` | found, read only | Security: found, verified |
| Read path not re-checked after open (TOCTOU) | `1053dd0` | found, read only | Security: suspected |

Catch rate: baseline 4/4 (2 verified), skill 4/4 (3 verified, 1 suspected).
The baseline was not weak on this case, so the skill's gain here is
verification and coverage, not recall.

Additional findings from the skill that are not in the ground truth, and
are still present on `main`:

| Finding | Reviewer | Layer 3 outcome |
| --- | --- | --- |
| 28 new traversal-ID tests pass with the route unregistered | Tests (from Layer 0) | CONFIRMED, LOW |
| Scan-output sanitizer misses absolute paths after `` ` `` or `[`, which the spec requires to be `[PATH]` | Security | CONFIRMED, MEDIUM → LOW |
| All reports read into memory on every request | Security | mechanism confirmed; downgraded to accepted trade-off (spec: "no pagination") |
| Artifact file name failing `SanitizedTextSchema` → 500 on `/artifacts` | Spec | reviewer-verified |
| Symlinked `data/applications.md` → undocumented 403 on `/reports`, `/artifacts` | Impact | reviewer-verified |
| Relative `--workspace` value redacted as a literal word | Impact | reviewer-verified |
| Spec divergences (report-only offers, any-H1 titles, company regex, `offersProjected` on failure, report `offerId`) | Spec | reviewer-verified; owner decisions, not bugs |

False positives: none of the skill's findings were disproved. One was
downgraded to "accepted trade-off" by its verifier (the memory finding).
Spec divergences need an owner ruling before anyone can call them defects.

## Case 2: seeded regression (`15336c0..a5b7828`, eval-only commit, not pushed)

A "refactor" that redacts the home directory only as `${home}/`, so a bare
home path (`cwd /Users/jane`, `"/Users/jane"`) leaks through
`GET /reports/:id`. The commit adds two tests, and all 443 tests pass.

| | Baseline | Skill |
| --- | --- | --- |
| Caught the leak | yes, verified with a probe | 4/4 reviewers, all verified |
| Layer 0 | n/a | flagged the new "keeps the separator" test as proving nothing |
| Other findings | tests use the real `homedir()` (read only); Windows home paths (read only) | none |

## Case 3: the skill reviewing its own PR

The skill was run on this branch, including the Layer 4 fix loop.

- Round 1 (`main..4903445`): the Security reviewer passed. Impact, Tests and
  Spec reported 13 findings, all verified by their reviewer. They included
  impact-map bugs that would hide a security reviewer or callers: quoted
  non-ASCII paths, `---`-prefixed lines, misattributed deletions and JSDoc
  edits, and grep noise from file-local symbols. They also covered Layer 3
  wording that departed from the owner's design. All were fixed test-first,
  except three that were left for the owner.
- Round 2 (`4903445..dd52595`): all three reviewers independently caught a
  regression that the round-1 JSDoc fix had introduced (indented comments
  lost their symbol). They also found a latent `export { name }` gap and a
  `--set` crash. All were fixed test-first.
- Round 3 (`dd52595..2ce750e`): four findings verified by their reviewer
  remain open and were escalated, as the three-round limit requires. Two
  MEDIUM: a doc comment on a top-level statement, or a `//` line between a
  JSDoc and its declaration, attributes the edit to the declaration above.
  Two LOW: a malformed `--set` followed by `--timeout-ms` is accepted, and
  `export { $name }` is not detected. The line-based attribution keeps
  producing comment edge cases; the TypeScript compiler API would remove
  that class of bug.

## Verdict

On these two cases a single strong reviewer with the spec already matched
the skill on recall. What the skill added:

- every finding reproduced before anyone acts on it (the baseline left half
  of its findings unverified);
- a machine signal for weak tests (Layer 0), which no reviewer produced
  unprompted;
- five more reproduced issues on Case 1 that the baseline did not report
  (two confirmed by an independent verifier, three verified by their reviewer);
- five spec divergences separated out as owner decisions.

It did this at roughly 5× the cost. Docs-only changes now get a lighter run
(Layer 0 and the Spec reviewer); see "Changes after the evaluation".

## Known limits

- The `untrusted-input` risk question was written after the date bug was
  known, so Case 1 is not a blind test of that wording. The baseline found
  the bug without it.
- `tests-prove-change.mjs` covers wrapper tests only; Android tests are
  judged by reading them.
- Cost: the skill used about 5× the baseline's tokens on Case 1 (four
  reviewers at 110–155k tokens each, against one reviewer at 119k), plus
  about 75k tokens per verifier.
- Kotlin symbols are still attributed line by line; only TypeScript and
  JavaScript use the compiler.

## Changes after the evaluation (issue #5)

The cases above were not re-run; these changes target the round-3 leftovers
and cost, not reviewer recall.

- The impact map attributes TS/JS lines with the TypeScript compiler API
  (the wrapper's pinned `typescript`) instead of walking lines. The round-3
  findings have regression tests: a doc comment on a top-level statement, a
  `//` line between a JSDoc and its declaration, and `export { $name }`. The
  malformed `--set` finding was in `second-model.mjs`, which is gone; the
  remaining scripts now reject a flag whose value is missing or is another
  flag. On Case 1 the new map reported 172 symbols against 176; the four it
  dropped were false positives (a blank line after a declaration charged to
  it).
- Docs-only light mode: Layer 0 and the Spec reviewer only, when the impact
  map classifies every changed path as documentation.
- The Gemini second-model path was removed: the owner decided not to use
  Gemini for code review.
- CI runs the scripts' tests on changes under `.claude/skills/**`.

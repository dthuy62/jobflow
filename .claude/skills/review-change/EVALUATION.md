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

It did this at roughly 5× the cost. Whether docs-only changes should get a
lighter run is an open owner decision; for now the impact map decides.

## Known limits

- The `untrusted-input` risk question was written after the date bug was
  known, so Case 1 is not a blind test of that wording. The baseline found
  the bug without it.
- `tests-prove-change.mjs` covers wrapper tests only; Android tests are
  judged by reading them.
- Cost: the skill used about 5× the baseline's tokens on Case 1 (four
  reviewers at 110–155k tokens each, against one reviewer at 119k), plus
  about 75k tokens per verifier.
- The second-model (Gemini) path was not exercised: sending repository code
  to Google needs the owner's approval.

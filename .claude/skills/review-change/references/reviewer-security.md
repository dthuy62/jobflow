# Security reviewer

Runs when the impact map lists a security reviewer (security, process-spawn,
workspace-io, workspace-write, auth-token, routes, env, redaction, config,
database, vendor, ci).

You are an independent reviewer. You did not write this change and you have
not seen the writer's reasoning.

## Inputs

- The diff: `git diff {{BASE}}..{{HEAD}}` in {{REPO}}.
- The impact map's risk areas and route list: {{IMPACT_MAP}}.
- Read access to the touched files. For wrapper diffs, also
  `career-ops-wrapper/src/security/`, `src/workspace/`,
  `src/career-ops-engine/` and `src/api/register-routes.ts`. For backend or
  package diffs, also the Security baseline in
  `docs/superpowers/specs/2026-11-02-jobflow-hosted-product-design.md`,
  `backend/src/http/` and `backend/src/adapters/`.

## Backend and packages

Can an anonymous internet client, another signed-in user, a hostile job posting
or a hostile uploaded file make the backend do something it must not?

Check each that applies to the diff:

- **Authentication:** is every new route denied by default? Does token
  verification pin issuer, audience and algorithm, and reject before any body
  is parsed?
- **Authorization:** does each query for user data use the id from the verified
  token? Is there a test that user A cannot read or change user B's data?
- **Leakage:** do tokens, CV text, prompts, AI output, connection strings or
  stack traces reach a response or log?
- **Cost and resources:** can a caller trigger an AI call without an entitlement,
  or unbounded work, memory or storage? Are rate limits still keyed on a value
  the client cannot forge?
- **Untrusted input:** are user URLs SSRF-guarded? Does file parsing run isolated?
  Can a job posting steer a prompt or an action?
- **Database:** does the app role keep only what it needs? Is the migration safe
  to run twice?
- **Secrets and supply chain:** is a secret in code, an image or CI? Is a new
  dependency or vendored file justified, and does vendored code run?
- **Baseline:** does the diff remove or weaken a Security baseline item? That
  needs the owner, so report it.

## Wrapper

Can an attacker on the LAN, a malicious or corrupted workspace file, or a
hostile `scan.mjs` output make the wrapper do something it must not?

Check each that applies to the diff:

- **Workspace escape:** `..`, absolute paths, symlinks (final and parent
  components), and swaps between check and open. Is the opened file
  re-checked (fstat dev/inode or realpath) after open?
- **Leakage:** do absolute paths, home directory, workspace path, tokens, or
  URL userinfo reach a response, log, error message, or child-process env?
- **Command execution:** `spawn` without shell, fixed script, allowlisted
  argv, stripped env, timeout, kill of the process group, bounded output.
- **Token guard:** is every new route registered inside the `/api/v1` plugin
  after `registerLocalPairingTokenGuard`, and not added to its public list?
- **Resource limits:** unbounded reads, streams, or lists from workspace files.

For each finding, say which actor triggers it. Output findings in the format
from `finding-format.md`, which follows.

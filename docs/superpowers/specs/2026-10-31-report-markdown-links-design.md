# Report Markdown: links to artifact IDs, local paths removed

Issue: [#13](https://github.com/dthuy62/jobflow/issues/13). Tier L.

`GET /api/v1/reports/{id}` returns the report's Markdown. Until now it went
through `redactLocalValues`, which replaced the workspace and home path strings
with `[WORKSPACE]` and `[HOME]`. Review of PR #11 (finding C) showed that this
leaks whatever follows the matched prefix: a sibling folder
(`/Users/jane/career-ops-old/cv.pdf` → `[WORKSPACE]-old/cv.pdf`) and a climb
out (`/Users/jane/career-ops/../secret` → `[WORKSPACE]/../secret`).

The fix follows the owner-approved direction in the issue. A path is not
"redacted" by replacing a known prefix. A token that is a local path is
removed as a whole, and links are rebuilt from structured data (artifact IDs).

## Pipeline

`sanitizeReportMarkdown(markdown, context)` in
`src/security/report-markdown.ts`, three passes in order:

1. **Secrets and local values.** The pairing-token patterns from
   `redactSensitiveText` and the literal pairing token become `[REDACTED]`;
   the literal also matches when Markdown escapes its punctuation
   (`tok\_x`). Then every occurrence of the home directory or a workspace
   path variant (case-insensitive), together with the rest of its
   whitespace-free run, becomes `[local path]`. The run stops at `)`, `]`,
   `>`, `"` or a backtick, so a surrounding or following link survives. This runs on the whole text
   because a value can contain a space (`/Users/jane/Career Ops`), which
   the token pass below cannot see as one token.
2. **Links.** Markdown links and images are rewritten or reduced to text (see
   below). This pass only adds one kind of path: the artifact download path.
3. **Paths.** Every whitespace-separated token in the whole document,
   including code spans, fenced code, link text, link titles and HTML, is
   checked. A token that is, contains or continues a local path is replaced by
   `[local path]`.

Pass 3 is the security boundary. Pass 2 is for the reader: it turns links that
work on the desktop into links that work on the phone. A link that pass 2 fails
to recognize (for example one split across lines) is still plain text to
pass 3, so an absolute path in it is still removed.

`redactLocalValues` and its `[WORKSPACE]` / `[HOME]` placeholders are removed.
No report response contains either placeholder any more.

## Links (pass 2)

Recognized grammar, outside fenced code blocks and code spans:

- Inline links and images: `[text](dest)`, `![alt](dest)`, with `dest` either
  `<...>` or a raw destination with balanced parentheses, and an optional
  `"title"`, `'title'` or `(title)`. The `(...)` part must be on one line.
- Reference definitions: a line `[label]: dest "title"` (up to three spaces of
  indent).

Brackets are matched with a stack in one pass; escaped `\[` and `\]` are
ignored. Nested links (an image inside a link) work because every edit touches
a different range.

What happens to the destination:

| Destination | Result |
| --- | --- |
| `#fragment` | Kept |
| `http:`, `https:`, `mailto:` | Kept (pass 3 still strips URL credentials and drops a URL that contains the workspace or home path) |
| Relative, resolves to `output/<file>` and `<file>` is a listed artifact | Destination becomes `/api/v1/artifacts/<id>/download`; text and title kept |
| Anything else: other relative paths (other reports, `data/…`, a missing PDF, climbing out), absolute paths, `~`, `file:` and other schemes, Windows drives | Inline link → its text only (`[CV](x)` → `CV`, `![alt](x)` → `alt`). Reference definition → the line is removed, so `[text][label]` shows as plain text |

Relative destinations are percent-decoded, stripped of `?query` and
`#fragment`, and resolved with POSIX rules against `reports/` (where report
files live) **(builder's call: also against the workspace root, so
`output/x.pdf` matches too; both resolve inside the workspace or are
rejected)**. The artifact map comes from the same `output/` listing as
`GET /artifacts` (regular, non-symlink PDFs whose names pass
`SanitizedTextSchema`), so a rewritten link always downloads.

## Paths (pass 3)

A token is split into leading punctuation (`( [ { < " ' * _` and backtick), a
body, and trailing punctuation (`. , ; : ! ? ) ] } > " ' * _` and backtick).
Punctuation is kept so sentences still read; it never carries a path.

The body is replaced by `[local path]` when any of these hold:

1. **Local value.** It contains, case-insensitively, the home directory or
   any workspace path variant (configured, resolved, real), also after
   decoding (rule 4) and after removing `*`, `_` and backticks
   (`x/Users/j**a**ne`). This catches
   `foo/Users/jane/...`, `http://localhost/Users/jane/...` and sibling folders
   under home, whatever comes after.
2. **Absolute path start.** The body contains a position where an absolute
   path starts. Everything from that position is removed; the text before it
   is kept (`path:/Users/x` → `path:[local path]`). Starts:
   - `/` or `\` not preceded by a letter, digit, `%`, `+`, `#`, `)`, an
     emoji, or one or two dots (looking past `*`, `_` and backtick runs), and
     followed by a letter, digit, `.`, `_`, `~`, `$`, `%` or `{` (after any
     further slashes). A run of backslashes alone must be followed by a letter
     or digit, so Markdown escapes such as `\_` stay.
   - A known system root, whatever comes before it: `/` or `\` followed by
     `Users`, `Volumes`, `home`, `private`, `var`, `tmp`, `etc`, `opt`,
     `mnt`, `srv`, `root`, `usr` or `cygdrive` in that exact casing, then a
     directory and another separator. This catches `item 1)/Users/bob/x` and
     `a/home/bob/x`, while prose such as `Office/Home/Remote`,
     `office/home/remote`, `Public/Private/Nonprofit` and
     `Admin/Users/Roles` stays. So
     `4.2/5`, `CI/CD`, `C++/Kotlin`, `C#/.NET`, `**Kotlin**/Java` and `+/-`
     stay, while `/Users/x`, `(/opt/x)`, `` `/etc` ``, `"/srv/x"`,
     `=/home/x`, `x-/Users/x` and `\\server\share` go.
   - `~/` or `~user/` (user starting with a letter), `$HOME/`, `${HOME}/`,
     `%USERPROFILE%\`, `%HOMEPATH%\`.
   - A Windows drive `C:\` or `C:/`.
   - `file:` and any `scheme://` other than `http` and `https`.
   - The exact artifact download path
     `/api/v1/artifacts/artifact_<16 hex>/download` is not a start: it is the
     one path pass 2 writes.
3. **Climb.** Outside an `http(s)` URL, the body is a relative path that,
   resolved from `reports/`, leaves the workspace (`../../x`,
   `../../../Users/bob`). A relative path that stays inside shows no machine
   detail, so `output/x.pdf`, `../output/x.pdf` and `iOS/Android` are kept
   **(builder's call)**.
4. **Encoded forms.** Rules 1–3 are also checked on a decoded copy of the body
   (Markdown backslash escapes such as `\/`, percent escapes such as `%2F`
   and `%2e`, and HTML character references such as `&#47;` and `&sol;`,
   decoded up to three times). A hit on the
   decoded copy removes the whole body.
5. **Continuation.** The previous token on the same line was replaced by
   rules 1–4 and this body contains `/` or `\` (raw or decoded). This removes
   the rest of a path with spaces in it:
   `in /Users/bob/Application Support/Caches/x now` →
   `in [local path] [local path] now`.

When an absolute path is removed, the removal stops at the next `](` in the
token, so `[/Users/bob/cv.pdf](../output/cv.pdf)` keeps its rewritten link:
`[[local path]](/api/v1/artifacts/<id>/download)`.

`http(s)` URLs inside a body have their userinfo removed
(`https://jane:pw@host/a` → `https://host/a`). The userinfo is everything
between `://` and the last `@` before the first `/`, so a raw `?` or `#` in the
password is removed too. A URL starts at its scheme even after `-`, `+`, `.` or
a digit (`401-https://u:p@host`).

## What Android sees

The DTO shape is unchanged: `markdown` is still a bounded string. The text
changes:

- Workspace links to known PDFs point at `/api/v1/artifacts/<id>/download`
  instead of `../output/<file>.pdf`. This path is relative to the wrapper base
  URL, like `downloadUrl` in `ArtifactDto`.
- Other local links show as their text.
- Local paths show as `[local path]` instead of `[WORKSPACE]/…` or `[HOME]/…`.

No sections are removed and no new fields or error codes are added. If
rewriting makes the Markdown longer than `REPORT_MARKDOWN_MAX_CHARS`, the route
returns the existing `PAYLOAD_TOO_LARGE` **(builder's call)**.

## Builder's calls (summary)

1. Placeholder text `[local path]`, so a sentence still reads.
2. Relative paths that stay inside the workspace are kept in prose.
3. Relative link destinations match against `reports/` and the workspace root.
4. A non-artifact reference definition line is removed.
5. Link titles over 256 characters, and link destinations with `[`, `]` or a
   line break, are not recognized as links (keeps the scan linear); pass 3
   still removes any path in them.
6. Over-long output after rewriting → `PAYLOAD_TOO_LARGE` with the message
   "Report Markdown must be 1 MiB or smaller after local links and paths are
   rewritten."
7. The known-root list above; other roots glued to a word (`a/foo/bar`) are
   relative text.

## Protection level (owner ruling)

The owner chose reasonable protection, not absolute zero leakage.

Guaranteed and tested: no plainly written local path reaches the response.
That covers absolute paths (including those under known roots glued to a
word), the home directory, every workspace path variant (also with spaces on
one line), and relative links into the workspace.

Residual risk, documented and not chased: deliberately obfuscated paths.
Some forms are caught because simple, tested checks already exist (Markdown
escapes such as `\/`, emphasis inside a home or workspace value, percent and
HTML escapes). Others are known to get through:

- A home or workspace path with a space, wrapped onto the next line at that
  space (`/Users/Jane\nDoe/x`): the part after the line break stays.
- The pairing token written with HTML character references or percent
  escapes (`tok&#95;secret`).
- An absolute path outside the known roots, glued to a word
  (`a/srv2/data/x`).

The design also does not trade leaks for mangled prose: rules that removed
ordinary text were narrowed (known roots are case-sensitive and need two
more segments).

## Out of scope (follow-ups)

- Links to other reports (`002-globex.md`) could point at
  `/api/v1/reports/report_002`. They become plain text for now.
- The `**PDF:** output/<file>.pdf` header line is plain text, not a link.

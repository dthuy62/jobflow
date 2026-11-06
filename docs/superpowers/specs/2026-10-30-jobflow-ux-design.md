# JobFlow UX Design

Status: approved by the owner on 2026-11-05, after the design discussion that
started on 2026-10-30.

Interactive mockups: [JobFlow visual directions](https://claude.ai/artifact/EMs5HqUk5Hwrb6hUFsPAbX)
(private canvas; the owner shares it). The rows that count are **F · Vivid** and
**H · Get Started**. Rows A to E and G are rejected explorations, kept for
comparison. Exact values are in this document, so a builder who cannot open the
canvas can still build from here.

## Relation to other documents

- Built on the approved
  [hosted product design](2026-11-02-jobflow-hosted-product-design.md). That
  document owns scope, architecture and what is paid. This one owns how it looks
  and behaves on the phone.
- Replaces the visual direction in
  [the soft bottom navigation design](2026-07-04-jobflow-soft-bottom-navigation-design.md),
  `_bmad-output/design-artifacts/story-1-5-wireframe-spec.md`, and PRD section 4.7
  (neo-brutalist). `docs/design-guidelines.md` gets updated to match on approval.
- The BMad epics describe the old local-first product. Screens below are grouped
  by the hosted design's phases instead. Pairing, wrapper health and "workspace
  unhealthy" no longer exist for users.

## Intent

JobFlow finds jobs that fit a person and says why. The owner's bar is that a first
time user reacts with "wow, this app is great". Two things carry that reaction:

- It looks like an AI product: vivid colour, big confident type, real glass, motion
  that means something.
- It asks for almost nothing: one sentence instead of a form, no waiting, no long
  flows. Users hate tapping many times and hate waiting.

The app stops at "here are the jobs that fit you, and why". Applying happens
outside the app. It is not a LinkedIn competitor.

### Goals

- Set up in one screen. The shortest path is one tap on a sample sentence or one
  typed sentence, plus one tap to send.
- Show the first matching jobs within about two seconds of finishing setup.
- Let people try the app without an account.
- Every screen looks intentional in its empty and unscored states, because most
  jobs will have no AI score.

### Non-goals

- Applying, cover letters, or anything that sends something for the user.
- A chat assistant. The "AI" here is understanding one sentence and scoring jobs,
  not a conversation.
- Dark mode in the first release (builder's note: the owner reacted to the light
  vivid direction and never asked for dark).

### Anti-goals

- A form with many steps. Row G of the canvas was tried and rejected as too long.
- Fake waiting or invented numbers to look smart.
- Any AI call for a guest (hosted design anti-goal: "paying AI bills for
  strangers").
- A generic dashboard look, or a plain Material bottom bar.

## Information architecture

Three tabs in a floating glass bar, plus one separate round AI button:

| Tab | Purpose |
| --- | --- |
| **Job** (Home) | The feed. Replaces today's Home. |
| **Theo dõi** | Jobs the user has acted on. Filter by status. |
| **Hồ sơ** | CV, what job they want, plan, account and settings. Replaces Inputs and Settings. |

There is no Scan button and no search box: the server scans on a schedule and the
user never types a job search. Screens outside the tabs (job detail, report, CV
review, sign-in) hide the bar.

```text
Welcome → sign-in sheet → (new account) Get Started → Job
                        → (returning account) Job
Job → job detail → report
Job or detail → Evaluate → (guest) sign-in sheet → progress → score
```

## Screens by phase

| Phase | Screen | Mockup |
| --- | --- | --- |
| 1 Foundation | Base URL and auth layer only, no visible screen | none |
| 2 Core loop | Welcome and sign-in sheet | F · Đăng nhập |
| 2 | Get Started (one sentence) | H |
| 2 | Job feed | F · App, tab Job |
| 2 | Job detail, free state (posting facts and match reasons) | F · Chi tiết job, without the score |
| 2 | Theo dõi | F · App, tab Theo dõi |
| 2 | Hồ sơ: preferences, CV upload and review, account | F · App, tab Hồ sơ (list only) |
| 3 AI and payment | Evaluate action, progress, score, report reader | F · App and Chi tiết job |
| 3 | AI button and its evaluation history | F · App |
| 3 | Paywall, account deletion | not mocked |
| 4 Next | Share to JobFlow, follow-ups, compare | not mocked |

Screens marked "not mocked" or "list only" follow the visual system below; the
builder designs them and shows the owner before building.

## Main flows

### Welcome and sign-in

One screen, two states. See canvas **F · Đăng nhập**.

- **Collapsed:** a large gradient card (left and right margin 16, top 48, height
  632, radius 32) holds a headline and a stack of tilted white cards previewing the
  product. Three slides change every 4 s, with a thin progress bar under the card.
  Below it, one pill button: "Đăng ký / Đăng nhập".
- **Expanded, on tap:** the card slides up 212 and dims, slides stop, and the
  headline "Bắt đầu thôi" rises into the space. The Google button rises from behind
  the bottom button, which cross-fades its label into the guest action. One button
  becomes two, with no screen change. A chevron collapses it, as does system Back.
- **Options:** "Tiếp tục với Google" and "Tiếp tục với tư cách khách" (a guest the
  backend creates). The owner decided Apple comes later, with iOS, as the hosted
  design says. The layout has room for a third button. A guest starts once per
  install, so after that guest the sheet offers only Google. A guest has no
  sign-out, because that would lose their data.
- A new account or guest goes to Get Started. An account that already has
  preferences goes straight to Job.
- A guest who signs in with Google always has their data **moved into that account
  as part of signing in**, whether the account is new or already used here (common
  after a reinstall). The screen says first that the guest's data will move to the
  account. Then:
  - Firebase gives an ID token, and the app calls `POST /auth/sso` with it and the
    guest's refresh token as `guestRefreshToken`. The backend checks the ID token,
    finds or creates the account, and moves the guest's data in one transaction. A
    retry is safe, also after a merge whose answer was lost. Only the holder of the
    guest's refresh token can name that guest.
  - Merge rules are the hosted design's: preferences keep the account's and the guest's
    only fill gaps; tracker entries combine and the newer wins for the same job; a CV
    moves only if the account has none.
- **Login is all or nothing for the user:** the app keeps the backend's new token pair
  only once `/auth/sso` succeeds, and then signs out of Firebase. If the call fails,
  nothing is written: the app is still the guest it was, the sheet shows an error, and
  the user can retry. There is no half-signed-in state. A user who is already signed in
  is never signed out by a network failure or a 5xx; only a 401 from
  `POST /auth/refresh` ends a session.

### Get Started: one sentence

One screen. See canvas **H**, where typing works live. All of it maps to
`PreferencesDto`:

1. **Idle.** Large orb, "Bạn muốn tìm việc gì?", and a glass composer at the bottom
   (attach, text field, mic, round send button). Above the composer are one-tap
   shortcuts: upload a CV, or use a sample sentence. Each sample must lead to real
   jobs in the current index, so one tap never ends on an empty screen. Add samples
   for other occupations as the index can serve them.
2. **Understanding.** As soon as there is text, the orb shrinks to the top-left, the
   sentence shows large, and **each recognised part is tinted while typing**. A chip
   of the same colour pops in for each part. There is no submit before feedback.
3. **Filling gaps.** A missing field shows a dashed chip ("+ Lương"). Tapping it
   shows a few options above the composer; one tap appends to the sentence. "+ Vị
   trí" has no options and just focuses the text field. Nothing except a role is
   required. The send button stays disabled until there is a role, then gains a
   spinning colour ring.
4. **Send.** The orb grows to the centre, a count rises ("Đã xét 1.240 job", "12 job
   hợp với bạn"), then the orb opens as a circular reveal into the Job tab. The whole
   thing is capped at about 2 s and is not padded: if the data is ready sooner, use
   the short end, and never block longer than the real request needs. If matching
   has not finished at the cap, reveal the Job tab anyway in its "matching" state
   (see UX states) instead of showing a false "no matches".

| Chip | Tint / ink | Contract field |
| --- | --- | --- |
| Vị trí | `#DBEAFE` / `#1E40AF` | `roles` |
| Cấp bậc | `#F3E8FF` / `#5B21B6` | `seniority` |
| Nơi làm | `#DCFCE7` / `#166534` | `countries`, `locations` |
| Hình thức | `#CFFAFE` / `#155E75` | `remotePolicies` |
| Lương | `#FEF3C7` / `#92400E` | `minimumSalary` |
| Loại trừ | `#FFE4E6` / `#9F1239` | `keywordsExclude` |

The original sentence is stored in `aim`. `keywordsInclude` has no chip yet and is
editable in Hồ sơ.

**Moved out of setup on purpose**, each asked at the moment it pays off:

- Notification permission: after the user has seen their first feed.
- CV: when they first tap Evaluate, or on the upload shortcut.
- Editing every field: in Hồ sơ, which keeps a normal form as the fallback for
  anyone who prefers it or was misunderstood.

**How the sentence is understood (builder's call).** Guests may not cause AI calls,
so the first release uses a **rule and dictionary parser, with no LLM for anyone**:
free and instant. It **runs on the phone**, with one small dictionary per app language
(level, work mode, place, salary and exclusion words, not occupations), since the
server stays English-only. **Whatever text is left over becomes the role**, so any
occupation works and nobody can get stuck at this screen. An LLM may improve this for
signed-in users later, and must not spend the user's evaluation quota.

**Matching across languages.** Scanning is not affected by language, since the server
collects postings as they are. Matching is: stage 1 is a keyword filter and most
postings are in English, so "Y tá" alone would miss "Nurse". `roles` therefore stores
the user's words and an English term, and the chip shows the user's words. The English
term comes from on-device translation (for example ML Kit Translation), which is free
and causes no AI bill. The builder checks its quality on real job titles first; if a
translation is missing or poor, the user's words are stored alone.

**The CV shortcut.** In the first release it uploads the CV for later evaluation and
does not prefill the sentence, because turning a CV into preferences needs an LLM. A
guest may upload (plain text extraction). Prefill arrives with phase 3, for signed-in
users, and the mockup's "Tải CV lên để tự điền" label waits until then.

### Job feed

See canvas **F · App**. Top to bottom:

1. Header: wordmark and a notification button.
2. Big headline with the count ("12 job mới hợp với bạn") and "Cập nhật 2 giờ
   trước". The count is matches first seen since the user last opened the feed; on
   the first run, all matches. With no new jobs the headline falls back to the total
   ("24 job hợp với bạn"). The time is the last server scan, not the device sync,
   which would nearly always read "just now" (builder's call).
3. **Hero card:** the first feed item, on a black card with a large title, a score
   pill when scored, and the first match reason.
4. "Mới nhất": compact rows (72 tall) with a logo tile, title, company and location,
   and one trailing state: score pill, spinning orb (evaluating), or "Chấm" (not
   scored).

A big single job card per screen was explicitly rejected; a person should see about
four jobs at once. A job with no score is normal, not second class. Scores only
affect order: higher goes up. They do not decide for the user.

### Job detail and report

See canvas **F · Chi tiết job**. White top with a centred company, location and large
title; a two-part pill (score and work mode); then a gradient panel rising from below
with "Vì sao hợp với bạn". Fixed at the bottom: a round status button and a black
"Mở tin tuyển dụng", which opens the posting in the browser through an external
intent.

- Free state: the two-part pill shows work mode and salary (or location); the panel
  lists `reasons`; a clear "Chấm bằng AI" action sits in the panel.
- Scored: the score, `summary`, and a row to the full report. Show the score as
  `score / 20` with one decimal ("4.2 / 5"), since the contract is 0 to 100 and the
  owner thinks in fives. All AI output carries a visible "Do AI tạo" label
  (`aiGenerated`).
- Report: Markdown on plain white, for long reading.

### Evaluate

Tap "Chấm" or "Chấm bằng AI" and carry on. Nothing blocks.

- Guest: the sign-in sheet opens first, with a line explaining why.
- The row shows the orb; detail shows the real stage (`queued`, `fetching_job`,
  `analyzing`, `writing_report`).
- The AI button's ring spins while anything is running, and tapping shows "AI đang
  chấm 3/10 job". Notifications follow the hosted design (Live Update on Android 16+,
  never for new-job alerts).
- With nothing running, the AI button opens evaluation history and remaining quota
  (builder's call; the owner has not decided).

### Theo dõi

See canvas **F · App**, tab Theo dõi. Big title, filter chips, rows with a status tag
and when it last changed. Status is set from the detail screen's round button. Skipped
jobs leave the feed. The contract's states are `applied`, `interview`, `rejected`,
`skipped`.

## UX states

| State | Trigger | What the user sees | Way out |
| --- | --- | --- | --- |
| Loading | First load of a list | Skeleton rows on the gradient, never a blocking spinner | automatic |
| Fresh | Sync succeeded | Normal, "Cập nhật … trước" | pull to refresh |
| Offline / stale | No network, Room has data | Cached content plus a small "Đang xem dữ liệu lúc 08:12" pill | retry; tracker changes queue through WorkManager |
| Offline, no data | No network, no cache | Illustration and "Không có mạng" | Thử lại |
| Matching | Preferences saved, first match not finished | Orb, "Đang tìm job cho bạn", skeleton rows; a push arrives if the user leaves | automatic |
| No matches | Matching finished, feed empty | Orb, "Chưa có job khớp", and which filter to loosen. No fake or looser results | Sửa mong muốn; thêm công ty |
| Thin feed | Fewer than 5 matches (builder's call) | Normal feed plus a "Thêm công ty" row | add a careers URL |
| No role yet | Text is empty or only filler words | Send stays disabled, dashed "+ Vị trí" chip | keep typing |
| Validation error | `VALIDATION_ERROR` | Message next to the field or chip, input kept | fix |
| CV too large or wrong type | `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE` | "PDF, tối đa 5 MB" | choose another file |
| CV unreadable | `CV_UNREADABLE` | "Hãy dùng file PDF dạng văn bản" | choose another file |
| Job closed | `closed: true` | Tag "Đã đóng", main button disabled | back |
| Evaluating | stage before `done` | Orb on the row, stage text on detail | carries on in background |
| Evaluation failed | `failed` | `failureMessage` on the row and detail | Thử lại |
| Sign-in needed | `SIGN_IN_REQUIRED` or guest action | Sign-in sheet | sign in, or dismiss |
| Plan or trial used up | `ENTITLEMENT_REQUIRED`, `QUOTA_EXCEEDED` | Paywall sheet with remaining quota | buy, or dismiss |
| Device check failed | `INTEGRITY_FAILED` | Plain sentence, no technical words | dismiss |
| API rejected the token | `UNAUTHORIZED` | Session kept, short error. Never signs the user out | Thử lại |
| Account gone | Firebase no longer accepts the account (deleted or disabled) | Session ends, Welcome screen | sign in |
| Sign-in failed | Google or network error, or the API fails after Firebase succeeds | Sheet stays open with a short error. Not signed in. A guest's token is kept for the retry | Thử lại |
| Rate limited | `RATE_LIMITED` | "Thử lại sau N giây" from `retryAfterSeconds` | wait |
| Server down | `UNAVAILABLE`, `AUTH_UNAVAILABLE`, `UNEXPECTED_ERROR` | Cached data if any, plus a retry | retry |

Never show tokens, stack traces, file paths, or CV text in an error.

## Visual system

Name: **Vivid**. Material 3 supplies the rules (grid, type scale, shape scale), and
colour and glass make it distinctive. The owner chose this after rejecting soft,
dark AI-native and neo-brutalist. **Neo-brutalist is retired**: stop using
`NeoBrutalist` colours and components for new screens.

### Colour

Text on the gradient is always ink, or sits on a translucent white panel. Report text
and other long reading sit on white.

| Token | Value | Use |
| --- | --- | --- |
| ink | `#15161A` | text, primary buttons, hero card |
| ink variant | `#3E414B` | secondary text |
| panel | white at 80% | cards and rows on the gradient |
| surface | `#FFFFFF` | detail top, report |
| outside surface | `#FAF8FC` | sign-in background |
| quiet button | `#DAD7E4` | collapsed sign-in button, guest |
| score tint | `#FFE24A` to `#FF8FB8` | score pill on the hero |

Screen gradient, fixed behind scrolling content:

```text
linear 180deg: #FFFFFF 0, #FFF8C9 12%, #FFE24A 32%, #FFB02E 56%, #FF5C8A 80%, #B23CE6 100%
radial 70%x26% at 100% 66%: rgba(255,64,140,.65) to transparent
radial 80%x26% at 0% 96%: rgba(109,40,217,.7) to transparent
```

Status tags: applied `#DBEAFE`/`#1E40AF`, interview `#DCFCE7`/`#166534`, rejected
`#FFE4E6`/`#9F1239`, skipped uses ink variant on `#F1F1F4`.

### Type

**Be Vietnam Pro**, because its bold weights have the tight modern look of the
reference and its Vietnamese marks are excellent. Bundle it or use Downloadable Fonts
(builder's call). Weights 400, 500, 600, 700 only. Large sizes use tight tracking
(-0.035em at 36 and up).

| Role | Size / line |
| --- | --- |
| Display (feed and tab titles) | 45 / 52 |
| Screen headline | 36 / 44 |
| Hero title | 28 / 36 |
| Section, panel title | 22 / 28 |
| Card title, button | 16 / 24 |
| Body | 14 / 20 |
| Meta, chip | 12 / 16 |
| Nav label | 11 / 16 |

### Spacing and shape

4 dp grid, values 4, 8, 12, 16, 20, 24, 32 only. `Spacing.kt` lacks 12 and 20, so add
them. Screen margin 16, between sections 24, title to content 12, card padding 16
(hero 20), rows 8 apart. Radius: large cards 28, rows 20, logo tiles 12, chips and
buttons full. Touch targets at least 48, chips 32 tall with a 48 target.

### Icons

Material Symbols Rounded, weight 400, 24 dp (builder's call; the mockups use
hand-drawn placeholders). Unselected tabs are outlined, the selected tab filled. The
AI mark is JobFlow's own four-point spark, not `auto_awesome`.

### The orb

An iridescent sphere (sky `#38BDF8`, pink `#EC4899`, orange `#F97316` on violet
`#A78BFA`) with a soft highlight. It means one thing: **AI is at work or about to
be**. It appears only in Get Started, on jobs being scored, and nowhere decorative.

### Glass navigation

The owner asked for Apple's Liquid Glass language in the bar, and only there. The
repository already has `io.github.kyant0:backdrop` in `JobFlowBottomNavigation.kt`.

- Floating pill, 64 tall, margin 16, bottom 24, content scrolling behind it. Reserve
  bottom padding so the last row can clear the bar.
- Clear glass (light blur, boosted saturation) with lens refraction at the edges and
  a thin iridescent rim. Not frosted.
- The selected tab sits in a brighter glass droplet that moves with spring motion:
  the leading edge travels first (about 300 ms) and the trailing edge follows (about
  560 ms), so it stretches and settles.
- Separate 64 round button to the right: near-black glass, white spark, spinning
  colour ring while AI is running.
- Android 13+ gets the lens. Android 12 falls back to blur. Below that, a translucent
  fill. Only the bar and composer use real blur. Cards use plain translucency so
  scrolling stays smooth on weak phones.

### Motion

| Moment | Motion |
| --- | --- |
| Sign-in expand, Get Started layout | 620 ms, cubic-bezier(.32,.72,0,1) |
| Chip appears | 360 ms pop with slight overshoot |
| Orb reveal into Job | 760 ms circular clip, cubic-bezier(.4,0,.2,1) |

Respect the system's reduced motion setting: replace the reveal and spinning with
simple fades.

### Accessibility and copy

- Status is never colour alone; there is always text.
- Dynamic type must not clip the big headlines; they wrap.
- Every icon-only control has a label. The orb is decorative except where it means
  "evaluating", which needs a label.
- Copy is short and first-person where the app speaks ("Tối qua mình tìm được…"), plain
  in errors. Do not use "career-ops" anywhere user-facing.
- AI output stays in English in the first release, since the server is English-only:
  `summary` and the report. The screen says so, and a later "Dịch" button can use
  on-device translation (builder's call).

## Contract changes this design needs

Each is additive. None is built yet.

| Need | Today | Proposed |
| --- | --- | --- |
| Score on feed rows and score-aware order | `FeedItemDto` has no evaluation | Add a small `evaluation` (stage, score) to the item; server order considers score |
| "Đã xét 1.240 job" | nothing | Return total jobs considered with the first feed page, or drop the line |
| Headline count and time, thin feed | `FeedPageDto` has only `items` and `nextCursor` | Add new count, total count and last scan time; the server remembers when the feed was last opened |
| "Matching" versus "no matches" | An empty page looks the same for both | Add a matching state to the feed page. Matching may run in a worker |
| Match reasons in the app's language | `reasons` is free English text | Send a reason code and its values (for example "role", "Nurse"); the app writes the sentence |
| Evaluation failure in the app's language | `failureMessage` is free English text | Add a failure code. Error responses already have `code`, so the app maps those and ignores `message` |

## Decided by the owner

- The app is multi-language and the server is English-only. All user-facing wording
  lives in Android string resources. The first release ships Vietnamese and English
  (builder's call on the exact pair), and adding a language must not need a server
  change.
- Sign-in on Android: Google and guest. Apple ships with iOS.
- A guest's data follows them when signing in, including into an existing account.
  The merge is invisible and happens within sign-in, through `POST /auth/sso`. See the
  known limit under [Welcome and sign-in](#welcome-and-sign-in).
- No "Quan tâm" (save for later) status: the tracker stays `applied`, `interview`,
  `rejected`, `skipped`. Rows in the canvas were updated to match.
- Get Started is the one-sentence flow in canvas row H, not the steps in row G.
- Visual direction: Vivid, with Liquid Glass only on the navigation.
- Guests can try the app. Applying stays outside it.

## Left to the builder

- How to structure Compose code, navigation and state.
- Bundled font or Downloadable Fonts.
- Skeleton, illustration and paywall detail, within the visual system.
- Exact spring constants, if they match the feel on the canvas.
- Exact Liquid Glass tuning on real devices. Mockups only approximate it, since
  browsers cannot do true lens refraction.

# Android Agentic Starter documentation

A single-module Android starter (Jetpack Compose, Hilt, Room, DataStore, Navigation 3) built for human and AI-assisted
feature work: clear layer boundaries, two presentation patterns used where they fit, and checks that enforce the rules.

## Guides

| Read                                            | When you want to know                                                                      |
|-------------------------------------------------|--------------------------------------------------------------------------------------------|
| [Quick start](quick-start-guide.md)             | how to run the app, verify it and add a screen                                             |
| [Product requirements](project-overview-pdr.md) | what the starter is for, what it leaves out, how "done" is checked                         |
| [System architecture](system-architecture.md)   | how layers, state, errors, DI and navigation fit together, with diagrams                   |
| [Code standards](code-standards.md)             | conventions, how much structure a feature needs, testing, automated checks                 |
| [Codebase summary](codebase-summary.md)         | what each package holds and how long each object lives                                     |
| [Module guides](module-guides.md)               | recipes: add a screen, share logic, swap the AI engine, change the database                |
| [CI/CD](ci-cd.md)                               | how a merge becomes a Firebase App Distribution build, versioning, secrets, one-time setup |
| [Development roadmap](development-roadmap.md)   | what is done and what is next                                                              |
| [Decisions](decisions/)                         | why things are the way they are (ADRs, one per decision)                                   |

`superpowers/` holds the specs and plans that produced the current setup. It is history, not required reading.

## Where facts live

Each fact has one home, and other files link to it instead of repeating it.

- The verify command: `AGENTS.md`.
- The reasons behind a choice: an ADR in `decisions/`.
- Structure, conventions and recipes: the guides above.
- Rules for agents, kept short: `AGENTS.md`, `.claude/skills/` and `.claude/rules/`.

## Keeping docs current

- `DocsTest` (`app/src/test/.../docs/DocsTest.kt`) runs with the unit tests, locally and in CI, and fails when a link
  or a named path in these docs no longer exists, when the package map misses a top-level package, or when a doc
  repeats a different verify command.
- The review checklist asks whether a change altered structure, commands or conventions, and if so to update the docs or
  write an ADR.
- The roadmap is the one file that needs a person: keep it short and drop finished items.

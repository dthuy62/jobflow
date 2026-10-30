---
paths:
  - "app/src/test/**"
  - "app/src/androidTest/**"
---

# Tests

- Test ViewModels and use cases on the JVM with fakes of domain interfaces; shared fakes and fixtures live in the
  test `testing` package (`FakeHealthRepository`, `healthFixture`, `contractFixture`); no mocking library.
- Use `Dispatchers.setMain` with a test dispatcher for code that touches `Dispatchers.Main`.
- Assert on `state.value` and collected effects, not on internal calls.
- One behaviour per test; name tests after the behaviour (`sending blank message does nothing`).
- Cover the failure path: a fake that returns `Either.Left(AppError...)` and the UI state it produces.
- Wire contracts: parse the wrapper's checked-in examples; never copy fixture JSON into Android.
- UI tests must not import `data/`; build domain objects through `testing` helpers.
- Add Compose tests against `XContent` only when a screen has non-trivial rendering logic.

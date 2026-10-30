# Review checklist

- Does `ui/` import from `data/`, or `domain/` import Android, Room or DataStore types?
- Does one feature import another instead of going through `NavGraph.kt`?
- Does anything read Career Ops workspace files instead of calling the wrapper API?
- Is each screen MVVM-lite or MVI, not both, and would MVVM-lite have been enough?
- Is every layer (use case, mapper, separate model) justified by a concrete need, not by habit?
- Is UI state one immutable value with explicit exclusive states?
- Are expected failures `Either<AppError, T>` mapped only at the source mapper and `toUiError()`, with no `Throwable`
  in state, and is `CancellationException` rethrown?
- Is every new string in `strings.xml` and every spacing from `Spacing`?
- Does new ViewModel or use case logic have a unit test with fakes?
- Did the change alter structure, a command or a convention? If so, are `docs/` updated or an ADR written?
- Did the change stay inside the files the task needed, and is every file under 400 lines?

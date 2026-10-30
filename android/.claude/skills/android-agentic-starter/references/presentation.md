# Screens and UI state

- A stateful `XScreen(viewModel: XViewModel = hiltViewModel(), ...)` collects state and calls a stateless
  `XContent(state, onAction...)`. `XContent` has a `@Preview` and no Hilt.
- `UiState` is an immutable data class, or a sealed interface when states exclude each other
  (`Loading` / `Content` / `Error`). Never parallel booleans such as `isLoading` + `hasError`.
- Lists in state are `ImmutableList` (`persistentListOf()`, `toImmutableList()`).
- Collect with `collectAsStateWithLifecycle()`.
- One-shot events (snackbar, navigation) are MVI effects collected with `CollectEffects`, never a state flag that
  the UI resets.
- ViewModels expose `AppError`; the screen maps it to a string resource. ViewModels never hold `Throwable` or SDK
  types.
- Screens take navigation callbacks (`onOpenSettings`, `onBack`); `navigation/NavGraph.kt` wires them.

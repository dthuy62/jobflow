---
paths:
  - "app/src/main/**/ui/**"
---

# Compose UI

- Adapt by window size, not device type or orientation: use the window size class,
  `NavigationSuiteScaffold` for top-level navigation, and a list-detail layout where a list opens details.
- On wide windows add panes or constrain content width instead of stretching rows and forms.
- Every interactive element has a semantic label (`contentDescription` or text) and a touch target of at least 48dp.
- Text comes from `res/values/strings.xml`; spacing from `ui/theme/Spacing`; colors and type from `MaterialTheme`.
- Use `LazyColumn`/`LazyVerticalGrid` with stable keys for long or unbounded content.
- Give each `XContent` a `@Preview`; keep previews free of Hilt and real data sources.
- Keep navigation, snackbars and dialogs at the screen boundary, driven by callbacks or effects.

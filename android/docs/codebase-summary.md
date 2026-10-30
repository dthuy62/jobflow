# Codebase summary

Paths below are relative to the app's package root (`namespace` in `app/build.gradle.kts`), so they survive a rename
done with `mobile-app-config`.

## Package map

| Package                               | Holds                                                 | Never holds                            |
|---------------------------------------|-------------------------------------------------------|----------------------------------------|
| `core/common`                         | `AppError`, `Outcome`, `DispatcherProvider`           | Android imports                        |
| `core/mvi`                            | `MviViewModel`, `CollectEffects`                      | feature logic                          |
| `domain/model`                        | plain data classes and enums                          | annotations from Room or serialization |
| `domain/repository`, `domain/engine`  | interfaces (ports)                                    | implementations                        |
| `domain/usecase`                      | logic that is real or reused                          | pass-through wrappers                  |
| `data/local`, `data/preferences`      | Room, DataStore                                       | domain rules                           |
| `data/repository/impl`, `data/engine` | port implementations, mappers                         | UI types                               |
| `di`                                  | Hilt modules                                          | business logic                         |
| `navigation`                          | `NavGraph.kt`, the only file that knows every feature | feature logic                          |
| `ui/<feature>`                        | Screen, ViewModel, Route, Contract                    | imports from `data/` or other features |
| `ui/theme`                            | `AppTheme`, `Spacing`                                 | feature code                           |

Root files: `MainApplication` (Hilt entry), `MainActivity` (applies the theme, hosts `AppNavigation`) and
`MainViewModel` (exposes the stored `ThemeMode`).

## Features

| Feature       | Pattern              | Structure level                                       | Notes                                       |
|---------------|----------------------|-------------------------------------------------------|---------------------------------------------|
| `ui/chat`     | MVI (`MviViewModel`) | 1: use cases, Room entity split from the domain model | streaming reply, persistence, scroll effect |
| `ui/settings` | MVVM-lite            | 0: ViewModel talks to the repository directly         | theme mode in DataStore                     |

## Lifetimes

| Object                                                           | Scope                                 | Created by                                |
|------------------------------------------------------------------|---------------------------------------|-------------------------------------------|
| `ChatViewModel`, `SettingsViewModel`                             | back stack entry; cleared when popped | `hiltViewModel()` in `NavGraph.kt`        |
| `MainViewModel`                                                  | activity                              | `by viewModels()`                         |
| `ChatRepositoryImpl`, `DataStoreSettingsRepository`              | app singleton                         | `@Binds @Singleton` in `RepositoryModule` |
| `AppDatabase`, `DispatcherProvider`                              | app singleton                         | `DatabaseModule`, `CoroutinesModule`      |
| `SendMessageUseCase`, `ObserveMessagesUseCase`, `EchoChatEngine` | unscoped, new per injection           | `@Inject constructor`                     |

## Generated and local files

`build/`, `.gradle/` and the Room schema folder (once Room is added back) are generated; hooks block hand edits. Commit the schema folder (it records each
database version for migrations). `local.properties`, `.idea/` and signing files stay out of git; see `.gitignore`.

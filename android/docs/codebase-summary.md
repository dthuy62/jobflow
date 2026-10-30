# Codebase summary

Paths below are relative to the app's package root (`namespace` in `app/build.gradle.kts`), so they survive a rename
done with `mobile-app-config`.

## Package map

| Package                     | Holds                                                                   | Never holds                            |
|-----------------------------|-------------------------------------------------------------------------|----------------------------------------|
| `core/common`               | `Either`, `AppError`, `FeatureError`, `ApiErrorCode`, `unexpected`, `DispatcherProvider` | Android UI imports        |
| `core/mvi`                  | `MviViewModel`, `CollectEffects`                                        | feature logic                          |
| `domain/model`              | plain data classes and enums (`Health`, `HealthSnapshot`, `ThemeMode`)  | annotations from Room or serialization |
| `domain/repository`         | interfaces (ports): `HealthRepository`, `SettingsRepository`            | implementations                        |
| `data/remote`               | `CareerOpsApi`, `ApiJson`, `toApiError`, `PairingTokenInterceptor`, `normalizeBaseUrl` | UI types              |
| `data/remote/dto`           | `@Serializable` wrapper DTOs and their `toDomain()` mappers             | domain rules                           |
| `data/preferences`          | DataStore (`DataStoreSettingsRepository`)                               | domain rules                           |
| `data/repository/impl`      | port implementations (`HealthRepositoryImpl`)                           | UI types                               |
| `di`                        | Hilt modules: `NetworkModule`, `RepositoryModule`, `CoroutinesModule`, `TimeModule` | business logic             |
| `navigation`                | `NavGraph.kt` (the only file that knows every feature), `TopLevelTab`, bottom bar | feature logic            |
| `ui/<feature>`              | Screen, ViewModel, Route, Contract                                      | imports from `data/` or other features |
| `ui/theme`, `ui/components`, `ui/health` | shared UI: `AppTheme`, `Spacing`, soft components, `toUiError`, health cards | feature-specific state  |

Root files: `MainApplication` (Hilt entry), `MainActivity` (applies the theme, hosts `AppNavigation`) and
`MainViewModel` (exposes the stored `ThemeMode`).

## Features

| Feature       | Pattern              | Structure level                                    | Notes                                              |
|---------------|----------------------|----------------------------------------------------|----------------------------------------------------|
| `ui/home`     | MVI (`MviViewModel`) | 1: DTO split from the domain model, cached repository | health refresh, show-once dialog, navigation effects |
| `ui/settings` | MVVM-lite            | 0: ViewModel talks to the repositories directly    | health details, Check again, theme mode in DataStore |
| `ui/inputs`   | stateless screen     | placeholder                                        | CV, profile and portal editors arrive in Stories 2.5 and 3.3 |

## Lifetimes

| Object                                                   | Scope                                 | Created by                                     |
|----------------------------------------------------------|---------------------------------------|------------------------------------------------|
| `HomeViewModel`                                          | Home back stack entry, which is never popped | `hiltViewModel()` in `NavGraph.kt`       |
| `SettingsViewModel`                                      | back stack entry; cleared when popped | `hiltViewModel()` in `NavGraph.kt`             |
| `MainViewModel`                                          | activity                              | `by viewModels()`                              |
| `HealthRepositoryImpl`, `DataStoreSettingsRepository`    | app singleton                         | `@Singleton` / `@Binds @Singleton`             |
| `OkHttpClient`, `Retrofit`, `CareerOpsApi`               | app singleton                         | `NetworkModule`                                |
| `Clock`, `DispatcherProvider`                            | per injection / app singleton         | `TimeModule`, `CoroutinesModule`               |

## Generated and local files

`build/` and `.gradle/` are generated; hooks block hand edits. When Room returns (Story 2.6) its schema folder is
generated too and must be committed. `local.properties`, `.idea/`, `debug.keystore` and signing files stay out of git;
see `.gitignore` (the shared debug key is checked in only as `debug.keystore.base64`).

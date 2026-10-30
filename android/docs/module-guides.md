# Module guides

How-to guides for the recurring jobs. Rules and reasons are in [code standards](code-standards.md) and the ADRs.

## Chat (MVI reference)

`ui/chat` shows the full path: `ChatScreen` -> `ChatViewModel` (`MviViewModel<ChatState, ChatIntent, ChatEffect>`) ->
`ObserveMessagesUseCase` / `SendMessageUseCase` -> `ChatRepository` and `ChatEngine` -> Room and `EchoChatEngine`.
The contract (`ChatContract.kt`) holds the state, intents and effects. The sequence is in
[system architecture](system-architecture.md#sending-a-chat-message).

Use it as the model when a screen has streaming or async work, interdependent state or one-shot effects.

## Settings (MVVM-lite, level 0)

`ui/settings` shows the smallest shape: one `UiState` as a `StateFlow`, plain functions for actions, and the ViewModel
injecting `SettingsRepository` directly because a use case would be a pass-through. Use it as the model for forms and
simple screens.

## Add a screen

```bash
scripts/new-feature.sh profile          # MVVM-lite
scripts/new-feature.sh profile --mvi    # MviViewModel + Contract file
```

It creates `ui/profile/` (Route, ViewModel, Screen + Content) and a starter ViewModel test. Then register the route in
`navigation/NavGraph.kt` with an `entry<ProfileRoute> { ProfileScreen(...) }` line, pass any navigation as callbacks, put
text in `strings.xml`, and run the verify command. Details for agents: skill `new-feature`.

## Share logic between features

A use case or repository used by two features lives in `domain/`, not inside either feature. Both ViewModels inject it.
Features never import each other; if one must open the other, `NavGraph.kt` passes a callback.

## Swap the AI engine

1. Implement `ChatEngine` in `data/engine` (for example `GeminiChatEngine`). It returns a `Flow<String>` of tokens and
   converts SDK exceptions to `AppError`.
2. Change the one `@Binds` for `ChatEngine` in `di/RepositoryModule.kt`.
3. Keep prompt templates, safety settings and model names in `data/`.
4. Add a fake or a test for the new engine; `SendMessageUseCase` tests keep using a fake engine.

## Change the database

The app uses Room 3 (`androidx.room3`, [ADR 6](decisions/0006-use-room-3.md)).

1. Edit the entity or DAO in `data/local`.
2. Bump `version` in `AppDatabase` and provide a migration:
   - basic changes: `autoMigrations = [AutoMigration(from = 1, to = 2)]` on `@Database`. Room fails the build for
     ambiguous changes such as deleting or renaming a table or column and asks for an `AutoMigrationSpec`;
   - complex changes (for example splitting a table): a `Migration(from, to)` from `androidx.room3.migration`, whose
     `suspend fun migrate(connection: SQLiteConnection)` runs SQL, registered with `addMigrations(...)` in
     `DatabaseModule`.
3. Build once so Room exports the new JSON into the app schemas folder (created once Room is added back), and commit it. Never edit that folder by hand.
4. Avoid `fallbackToDestructiveMigration`: it deletes all data. If losing data is acceptable for some versions,
   `fallbackToDestructiveMigrationFrom(...)` and `fallbackToDestructiveMigrationOnDowngrade()` are narrower.
   Chat history is real user data, so the starter does not use any of them.
5. Test migrations with `MigrationTestHelper` from `androidx.room3:room3-testing` in `androidTest`, with the schema
   folder as assets. Add this when the first migration appears; there is no `androidTest` source set yet.

## Change the app identity

Package, applicationId, app name, flavors and Firebase change only through the `mobile-app-config` plugin
([ADR 4](decisions/0004-change-identity-via-mobile-app-config.md)). Steps: skill `setup-starter`.

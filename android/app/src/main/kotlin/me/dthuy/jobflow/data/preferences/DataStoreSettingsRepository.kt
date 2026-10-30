package me.dthuy.jobflow.data.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import me.dthuy.jobflow.domain.model.ThemeMode
import me.dthuy.jobflow.domain.repository.SettingsRepository

private val Context.settingsDataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")
private val THEME_KEY = stringPreferencesKey("theme_mode")

class DataStoreSettingsRepository @Inject constructor(@param:ApplicationContext private val context: Context) :
    SettingsRepository {
    override val themeMode: Flow<ThemeMode> =
        context.settingsDataStore.data.map { prefs ->
            ThemeMode.entries.firstOrNull { it.name == prefs[THEME_KEY] } ?: ThemeMode.System
        }

    override suspend fun setThemeMode(mode: ThemeMode) {
        context.settingsDataStore.edit { it[THEME_KEY] = mode.name }
    }
}

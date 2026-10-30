package me.dthuy.jobflow.domain.repository

import kotlinx.coroutines.flow.Flow
import me.dthuy.jobflow.domain.model.ThemeMode

interface SettingsRepository {
    val themeMode: Flow<ThemeMode>

    suspend fun setThemeMode(mode: ThemeMode)
}

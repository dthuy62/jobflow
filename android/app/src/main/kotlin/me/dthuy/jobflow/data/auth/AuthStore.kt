package me.dthuy.jobflow.data.auth

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import java.io.IOException
import javax.inject.Qualifier
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import timber.log.Timber

/** The file holding auth's own state. Left out of backup and device transfer (`data_extraction_rules.xml`). */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class AuthStore

/** A failed read answers as if nothing was stored: when unsure, never risk losing someone's identity. */
internal suspend fun DataStore<Preferences>.current(): Preferences = data
    .catch { error ->
        if (error !is IOException) throw error
        Timber.w(error, "Could not read auth state")
        emit(emptyPreferences())
    }
    .first()

/** Returns once the change is on disk, or false if it could not be written. */
internal suspend fun DataStore<Preferences>.tryEdit(change: (MutablePreferences) -> Unit): Boolean = try {
    edit(change)
    true
} catch (error: IOException) {
    Timber.w(error, "Could not write auth state")
    false
}

package me.dthuy.jobflow.data.auth

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import javax.inject.Inject
import javax.inject.Singleton

/** Remembers that this install of the app has had its guest. Uninstalling is what resets it. */
interface GuestLedger {
    suspend fun isUsed(): Boolean

    suspend fun markUsed()
}

@Singleton
class DataStoreGuestLedger @Inject constructor(@AuthStore private val store: DataStore<Preferences>) : GuestLedger {
    override suspend fun isUsed(): Boolean = store.current()[USED] == true

    override suspend fun markUsed() {
        store.tryEdit { it[USED] = true }
    }

    private companion object {
        val USED = booleanPreferencesKey("guest_used")
    }
}

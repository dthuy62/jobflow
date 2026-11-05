package me.dthuy.jobflow.data.auth

import android.content.Context
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/** Remembers that this install of the app has had its guest. */
interface GuestLedger {
    fun isUsed(): Boolean

    fun markUsed()
}

/** Left out of backup and device transfer (`data_extraction_rules.xml`), so uninstalling is what resets it. */
@Singleton
class PreferencesGuestLedger @Inject constructor(@param:ApplicationContext context: Context) : GuestLedger {
    private val preferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    override fun isUsed(): Boolean = preferences.getBoolean(KEY_USED, false)

    override fun markUsed() = preferences.edit { putBoolean(KEY_USED, true) }

    private companion object {
        const val FILE = "auth_guest"
        const val KEY_USED = "used"
    }
}

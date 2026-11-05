package me.dthuy.jobflow.data.auth

import androidx.datastore.core.DataStore
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.emptyPreferences
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/** Real DataStore on a real file, because what matters here is what survives on disk and what a broken file does. */
class AuthStoreTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val scopes = mutableListOf<CoroutineScope>()

    @After
    fun tearDown() = scopes.forEach { it.cancel() }

    private fun file() = File(folder.root, "auth.preferences_pb")

    private fun store(file: File = file()): DataStore<Preferences> {
        val scope = CoroutineScope(Dispatchers.IO + SupervisorJob()).also { scopes += it }
        return PreferenceDataStoreFactory.create(
            corruptionHandler = ReplaceFileCorruptionHandler { emptyPreferences() },
            scope = scope,
            produceFile = { file },
        )
    }

    @Test
    fun `the mark is on disk once begin returns, so a new process sees it`() = runTest {
        assertTrue(DataStorePendingLogin(store()).begin(PendingSignIn.GOOGLE))
        scopes.forEach { it.cancel() }

        assertEquals(PendingSignIn.GOOGLE, DataStorePendingLogin(store()).running())
    }

    @Test
    fun `finishing clears the mark`() = runTest {
        val pending = DataStorePendingLogin(store())
        pending.begin(PendingSignIn.GUEST)

        pending.finish()

        assertNull(pending.running())
    }

    @Test
    fun `the guest token is kept until cleared, and finishing leaves it`() = runTest {
        val pending = DataStorePendingLogin(store())
        pending.keepGuestToken("guest_token")

        pending.finish()
        assertEquals("guest_token", pending.guestToken())

        pending.clearGuestToken()
        assertNull(pending.guestToken())
    }

    @Test
    fun `the guest ledger remembers across processes`() = runTest {
        val ledger = DataStoreGuestLedger(store())
        assertFalse(ledger.isUsed())
        ledger.markUsed()
        scopes.forEach { it.cancel() }

        assertTrue(DataStoreGuestLedger(store()).isUsed())
    }

    @Test
    fun `a corrupt file starts empty, which never signs anyone out`() = runTest {
        file().writeText("not a preferences file")

        val pending = DataStorePendingLogin(store())

        assertNull(pending.running())
        assertTrue(pending.begin(PendingSignIn.GOOGLE))
    }

    @Test
    fun `a file that cannot be used reads as nothing, and begin says it failed`() = runTest {
        val blocked = File(folder.newFile("not_a_folder"), "auth.preferences_pb")

        val pending = DataStorePendingLogin(store(blocked))

        assertNull(pending.running())
        assertFalse(pending.begin(PendingSignIn.GOOGLE))
    }
}

package me.dthuy.jobflow.data.auth

import androidx.datastore.core.DataStore
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.emptyPreferences
import java.io.File
import java.io.IOException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.runTest
import me.dthuy.jobflow.testing.MEMBER_ID
import me.dthuy.jobflow.testing.storedSession
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
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
    fun `a session is on disk once saved, so a new process sees it`() = runTest {
        DataStoreSessionStore(store()).save(member)
        scopes.forEach { it.cancel() }

        assertEquals(member, DataStoreSessionStore(store()).read())
    }

    @Test
    fun `a new access token lands only while its session is still the stored one`() = runTest {
        val sessions = DataStoreSessionStore(store())
        sessions.save(member)

        sessions.updateAccessToken(member.refreshToken, "fresh", 42)
        assertEquals(member.copy(accessToken = "fresh", expiresAt = 42), sessions.read())

        sessions.updateAccessToken("refresh_of_an_ended_session", "stale", 1)
        assertEquals("fresh", sessions.read()?.accessToken)
    }

    @Test
    fun `clearing removes every part of the session`() = runTest {
        val store = store()
        val sessions = DataStoreSessionStore(store)
        sessions.save(member)

        sessions.clear()

        assertNull(sessions.read())
        assertEquals(emptyPreferences(), store.data.first())
    }

    @Test
    fun `clearing for an ended session leaves a newer one`() = runTest {
        val sessions = DataStoreSessionStore(store())
        sessions.save(member)

        sessions.clear(onlyIf = "refresh_of_an_ended_session")

        assertEquals(member, sessions.read())
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
    fun `a corrupt file starts empty, which only signs this device out`() = runTest {
        file().writeText("not a preferences file")

        assertNull(DataStoreSessionStore(store()).read())
    }

    @Test
    fun `a file that cannot be used reads as nothing, and saving says it failed`() = runTest {
        val blocked = File(folder.newFile("not_a_folder"), "auth.preferences_pb")
        val sessions = DataStoreSessionStore(store(blocked))

        assertNull(sessions.read())
        assertThrows(IOException::class.java) { runBlocking { sessions.save(member) } }
        // These run while a request waits or a session ends, where a throw would fail the wrong thing.
        sessions.updateAccessToken(member.refreshToken, "fresh", 1)
        sessions.clear()
    }

    @Test
    fun `an unreadable file reads as nothing, but a sign-in's read says it failed`() = runTest {
        DataStoreSessionStore(store()).save(member)
        scopes.forEach { it.cancel() }
        file().setReadable(false)

        val sessions = DataStoreSessionStore(store())

        assertNull(sessions.read())
        assertThrows(IOException::class.java) { runBlocking { sessions.readOrThrow() } }
    }

    private companion object {
        val member = storedSession(MEMBER_ID, isGuest = false, expiresAt = 1_000)
    }
}

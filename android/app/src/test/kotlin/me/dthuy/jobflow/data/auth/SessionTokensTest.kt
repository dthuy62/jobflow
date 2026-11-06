package me.dthuy.jobflow.data.auth

import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import me.dthuy.jobflow.testing.FIXED_CLOCK
import me.dthuy.jobflow.testing.FakeAuthApi
import me.dthuy.jobflow.testing.FakeSessionStore
import me.dthuy.jobflow.testing.GUEST_ID
import me.dthuy.jobflow.testing.MEMBER_ID
import me.dthuy.jobflow.testing.storedSession
import me.dthuy.jobflow.testing.tokens
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

class SessionTokensTest {
    private val now = FIXED_CLOCK.millis()
    private val store = FakeSessionStore()
    private val api = FakeAuthApi()
    private val tokens = SessionTokens(store, { api }, FIXED_CLOCK)

    @Test
    fun `no session means no token`() {
        assertNull(tokens.accessToken())
    }

    @Test
    fun `a token with time left is used as it is`() {
        store.session = member(expiresAt = now + 120_000)

        assertEquals("access_${MEMBER_ID.value}", tokens.accessToken())
        assertTrue(api.refreshes.isEmpty())
    }

    @Test
    fun `a token about to end is refreshed first, with the same refresh token kept`() {
        store.session = member(expiresAt = now + 30_000)

        assertEquals("fresh", tokens.accessToken())
        assertEquals(listOf("refresh_${MEMBER_ID.value}"), api.refreshes)
        assertEquals("fresh", store.session?.accessToken)
        assertEquals("refresh_${MEMBER_ID.value}", store.session?.refreshToken)
        assertEquals(now + 900_000, store.session?.expiresAt)
    }

    @Test
    fun `a refused token is refreshed once`() {
        store.session = member()

        assertEquals("fresh", tokens.refreshedAccessToken("access_${MEMBER_ID.value}"))
        assertEquals(1, api.refreshes.size)
    }

    @Test
    fun `a refused token this session already replaced is retried with the new one`() {
        store.session = member()
        tokens.refreshedAccessToken("access_${MEMBER_ID.value}")

        assertEquals("fresh", tokens.refreshedAccessToken("access_${MEMBER_ID.value}"))
        assertEquals(1, api.refreshes.size)
    }

    @Test
    fun `a refused token of someone signed in before is never retried as the user now`() {
        store.session = member()

        assertNull(tokens.refreshedAccessToken("access_of_the_user_before"))
        assertTrue(api.refreshes.isEmpty())
    }

    @Test
    fun `a refused token replaced before someone else signed in is not retried as them`() {
        store.session = member()
        tokens.refreshedAccessToken("access_${MEMBER_ID.value}")
        store.session = storedSession(GUEST_ID, isGuest = true)

        assertNull(tokens.refreshedAccessToken("access_${MEMBER_ID.value}"))
        assertEquals(1, api.refreshes.size)
    }

    @Test
    fun `requests refused at once share one refresh`() {
        store.session = member()
        val pool = Executors.newFixedThreadPool(4)
        val start = CountDownLatch(1)
        val answers = (1..4).map {
            pool.submit<String?> {
                start.await()
                tokens.refreshedAccessToken("access_${MEMBER_ID.value}")
            }
        }

        start.countDown()

        assertEquals(List(4) { "fresh" }, answers.map { it.get(5, TimeUnit.SECONDS) })
        assertEquals(1, api.refreshes.size)
        pool.shutdown()
    }

    @Test
    fun `a 401 from refresh ends the session and says so`() = runTest(UnconfinedTestDispatcher()) {
        store.session = member()
        api.refreshAnswer = { Response.error(401, "".toResponseBody(null)) }
        var ended = false
        backgroundScope.launch {
            tokens.ended.first()
            ended = true
        }

        assertNull(tokens.refreshedAccessToken("access_${MEMBER_ID.value}"))

        assertNull(store.session)
        assertTrue(ended)
    }

    @Test
    fun `a 5xx from refresh keeps the session`() {
        store.session = member()
        api.refreshAnswer = { Response.error(503, "".toResponseBody(null)) }

        assertThrows(IOException::class.java) { tokens.refreshedAccessToken("access_${MEMBER_ID.value}") }
        assertEquals(member(), store.session)
    }

    @Test
    fun `offline, a token not yet ended is still used`() {
        store.session = member(expiresAt = now + 30_000)
        api.refreshAnswer = { throw IOException("offline") }

        assertEquals("access_${MEMBER_ID.value}", tokens.accessToken())
    }

    @Test
    fun `offline, an ended token fails the request but keeps the session`() {
        store.session = member(expiresAt = now - 1)
        api.refreshAnswer = { throw IOException("offline") }

        assertThrows(IOException::class.java) { tokens.accessToken() }
        assertEquals(member(expiresAt = now - 1), store.session)
    }

    @Test
    fun `an answer for a session that ended meanwhile changes nothing`() {
        store.session = member()
        api.refreshAnswer = {
            store.session = null
            Response.success(tokens(MEMBER_ID, "fresh"))
        }

        tokens.refreshedAccessToken("access_${MEMBER_ID.value}")

        assertNull(store.session)
    }

    private fun member(expiresAt: Long = now + 600_000) =
        storedSession(MEMBER_ID, isGuest = false, expiresAt = expiresAt)
}

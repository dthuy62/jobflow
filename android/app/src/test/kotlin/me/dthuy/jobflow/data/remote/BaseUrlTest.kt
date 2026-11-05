package me.dthuy.jobflow.data.remote

import me.dthuy.jobflow.BuildConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class BaseUrlTest {
    @Test
    fun `flavor default base url gets a trailing slash`() {
        assertEquals(
            "${BuildConfig.API_BASE_URL}/",
            normalizeBaseUrl(BuildConfig.API_BASE_URL),
        )
    }

    @Test
    fun `existing trailing slash is kept and whitespace trimmed`() {
        assertEquals("http://10.0.2.2:4010/", normalizeBaseUrl("  http://10.0.2.2:4010/ "))
    }

    @Test
    fun `blank base url is rejected`() {
        assertThrows(IllegalArgumentException::class.java) { normalizeBaseUrl(" ") }
    }
}

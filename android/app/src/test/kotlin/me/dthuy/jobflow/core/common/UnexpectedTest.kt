package me.dthuy.jobflow.core.common

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class UnexpectedTest {
    @Test
    fun `rethrows so bugs surface in debug builds`() {
        assertThrows(IllegalStateException::class.java) { unexpected(IllegalStateException(), rethrow = true) }
    }

    @Test
    fun `returns Unknown in release builds`() {
        assertEquals(AppError.Unknown, unexpected(IllegalStateException(), rethrow = false))
    }
}

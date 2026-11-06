package me.dthuy.jobflow.data.local

import android.database.SQLException
import kotlinx.coroutines.CancellationException
import me.dthuy.jobflow.core.common.DataSourceError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class LocalErrorsTest {
    @Test
    fun `a SQLite failure maps to StorageFailure`() {
        assertEquals(DataSourceError.Local.StorageFailure, SQLException().toLocalError())
    }

    @Test
    fun `cancellation is rethrown`() {
        assertThrows(CancellationException::class.java) { CancellationException().toLocalError() }
    }

    @Test
    fun `unexpected exception is rethrown in debug`() {
        assertThrows(IllegalStateException::class.java) { IllegalStateException().toLocalError() }
    }
}

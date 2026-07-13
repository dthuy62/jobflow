package me.dthuy.jobflow.core.logging

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test

class AppLoggerTest {
    @After
    fun tearDown() {
        AppLogger.resetForTest()
    }

    @Test
    fun delegatesMessagesToInstalledLogger() {
        val logger = RecordingLogger()

        AppLogger.install(logger)
        AppLogger.tag("Startup").i("Ready")

        assertEquals(listOf("Startup:i:Ready"), logger.entries)
    }

    private class RecordingLogger(
        private val tag: String? = null,
        val entries: MutableList<String> = mutableListOf(),
    ) : Logger {
        override fun v(
            message: String,
            throwable: Throwable?,
        ) = record("v", message)

        override fun d(
            message: String,
            throwable: Throwable?,
        ) = record("d", message)

        override fun i(
            message: String,
            throwable: Throwable?,
        ) = record("i", message)

        override fun w(
            message: String,
            throwable: Throwable?,
        ) = record("w", message)

        override fun e(
            message: String,
            throwable: Throwable?,
        ) = record("e", message)

        override fun tag(tag: String): Logger = RecordingLogger(tag, entries)

        private fun record(
            level: String,
            message: String,
        ) {
            entries += "${tag.orEmpty()}:$level:$message"
        }
    }
}

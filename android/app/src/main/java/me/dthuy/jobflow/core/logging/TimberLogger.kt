package me.dthuy.jobflow.core.logging

import timber.log.Timber

object TimberLogger : Logger {
    fun plantDebugTree() {
        Timber.plant(Timber.DebugTree())
        AppLogger.install(this)
    }

    override fun v(
        message: String,
        throwable: Throwable?,
    ) = Timber.v(throwable, message)

    override fun d(
        message: String,
        throwable: Throwable?,
    ) = Timber.d(throwable, message)

    override fun i(
        message: String,
        throwable: Throwable?,
    ) = Timber.i(throwable, message)

    override fun w(
        message: String,
        throwable: Throwable?,
    ) = Timber.w(throwable, message)

    override fun e(
        message: String,
        throwable: Throwable?,
    ) = Timber.e(throwable, message)

    override fun tag(tag: String): Logger = TaggedTimberLogger(tag)
}

private class TaggedTimberLogger(
    private val tag: String,
) : Logger {
    override fun v(
        message: String,
        throwable: Throwable?,
    ) = Timber.tag(tag).v(throwable, message)

    override fun d(
        message: String,
        throwable: Throwable?,
    ) = Timber.tag(tag).d(throwable, message)

    override fun i(
        message: String,
        throwable: Throwable?,
    ) = Timber.tag(tag).i(throwable, message)

    override fun w(
        message: String,
        throwable: Throwable?,
    ) = Timber.tag(tag).w(throwable, message)

    override fun e(
        message: String,
        throwable: Throwable?,
    ) = Timber.tag(tag).e(throwable, message)

    override fun tag(tag: String): Logger = TaggedTimberLogger(tag)
}

package me.dthuy.jobflow.core.logging

object AppLogger : Logger {
    @Volatile
    private var delegate: Logger = NoOpLogger

    internal fun install(logger: Logger) {
        delegate = logger
    }

    internal fun resetForTest() {
        delegate = NoOpLogger
    }

    override fun v(
        message: String,
        throwable: Throwable?,
    ) = delegate.v(message, throwable)

    override fun d(
        message: String,
        throwable: Throwable?,
    ) = delegate.d(message, throwable)

    override fun i(
        message: String,
        throwable: Throwable?,
    ) = delegate.i(message, throwable)

    override fun w(
        message: String,
        throwable: Throwable?,
    ) = delegate.w(message, throwable)

    override fun e(
        message: String,
        throwable: Throwable?,
    ) = delegate.e(message, throwable)

    override fun tag(tag: String): Logger = delegate.tag(tag)
}

private object NoOpLogger : Logger {
    override fun v(
        message: String,
        throwable: Throwable?,
    ) = Unit

    override fun d(
        message: String,
        throwable: Throwable?,
    ) = Unit

    override fun i(
        message: String,
        throwable: Throwable?,
    ) = Unit

    override fun w(
        message: String,
        throwable: Throwable?,
    ) = Unit

    override fun e(
        message: String,
        throwable: Throwable?,
    ) = Unit

    override fun tag(tag: String): Logger = this
}

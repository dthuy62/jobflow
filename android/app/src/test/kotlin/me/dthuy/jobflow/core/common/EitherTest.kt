package me.dthuy.jobflow.core.common

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import me.dthuy.jobflow.data.remote.toApiError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class EitherTest {
    private val right: Either<String, Int> = 2.right()
    private val left: Either<String, Int> = "boom".left()

    @Test
    fun `fold picks the matching branch`() {
        assertEquals("right 2", right.fold(onLeft = { "left $it" }, onRight = { "right $it" }))
        assertEquals("left boom", left.fold(onLeft = { "left $it" }, onRight = { "right $it" }))
    }

    @Test
    fun `map transforms only the right side`() {
        assertEquals(Either.Right(4), right.map { it * 2 })
        assertEquals(Either.Left("boom"), left.map { it * 2 })
    }

    @Test
    fun `mapLeft transforms only the left side`() {
        assertEquals(Either.Right(2), right.mapLeft { it.length })
        assertEquals(Either.Left(4), left.mapLeft { it.length })
    }

    @Test
    fun `flatMap chains right values and short circuits left`() {
        assertEquals(Either.Right("2"), right.flatMap { it.toString().right() })
        assertEquals(Either.Left("next"), right.flatMap { "next".left() })
        assertEquals(Either.Left("boom"), left.flatMap { it.toString().right() })
    }

    @Test
    fun `getOrNull and leftOrNull expose one side`() {
        assertEquals(2, right.getOrNull())
        assertNull(right.leftOrNull())
        assertNull(left.getOrNull())
        assertEquals("boom", left.leftOrNull())
    }

    @Test
    fun `catch wraps the value in Right`() = runBlocking {
        assertEquals(Either.Right(1), Either.catch(onError = Throwable::toApiError) { 1 })
    }

    @Test
    fun `catch maps a known exception to Left`() = runBlocking {
        val result = Either.catch(onError = Throwable::toApiError) { throw java.io.IOException() }
        assertEquals(Either.Left(AppError.Unreachable), result)
    }

    @Test
    fun `catch rethrows cancellation`() {
        assertThrows(CancellationException::class.java) {
            runBlocking { Either.catch(onError = Throwable::toApiError) { throw CancellationException() } }
        }
    }
}

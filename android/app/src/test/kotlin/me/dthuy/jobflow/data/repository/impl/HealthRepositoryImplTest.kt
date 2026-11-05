package me.dthuy.jobflow.data.repository.impl

import java.io.IOException
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.test.runTest
import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.getOrNull
import me.dthuy.jobflow.data.remote.ApiJson
import me.dthuy.jobflow.data.remote.JobFlowApi
import me.dthuy.jobflow.data.remote.dto.HealthDto
import me.dthuy.jobflow.domain.model.HealthStatus
import me.dthuy.jobflow.testing.contractFixture
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

class HealthRepositoryImplTest {
    private val clock = TestClock(Instant.parse("2026-10-30T02:00:00Z"))
    private val readyDto = ApiJson.decodeFromString<HealthDto>(contractFixture("health.ok.json"))

    @Test
    fun `cached success is reused within the freshness window`() = runTest {
        val api = FakeJobFlowApi { Response.success(readyDto) }
        val repository = HealthRepositoryImpl(api, clock)

        repository.refresh()
        clock.advance(Duration.ofHours(1))
        repository.refresh()

        assertEquals(1, api.calls)
    }

    @Test
    fun `success expires after the freshness window`() = runTest {
        val api = FakeJobFlowApi { Response.success(readyDto) }
        val repository = HealthRepositoryImpl(api, clock)

        repository.refresh()
        clock.advance(Duration.ofMillis(HealthRepositoryImpl.FRESHNESS_WINDOW_MILLIS + 1))
        repository.refresh()

        assertEquals(2, api.calls)
    }

    @Test
    fun `force bypasses the cache`() = runTest {
        val api = FakeJobFlowApi { Response.success(readyDto) }
        val repository = HealthRepositoryImpl(api, clock)

        repository.refresh()
        repository.refresh(force = true)

        assertEquals(2, api.calls)
    }

    @Test
    fun `failure is never served from cache`() = runTest {
        var down = true
        val api = FakeJobFlowApi { Response.success(if (down) throw IOException() else readyDto) }
        val repository = HealthRepositoryImpl(api, clock)

        val first = repository.refresh()
        down = false
        val second = repository.refresh()

        assertEquals(Either.Left(AppError.Unreachable), first.result)
        assertTrue(second.result is Either.Right)
        assertEquals(2, api.calls)
    }

    @Test
    fun `a degraded answer is never served from cache`() = runTest {
        val degradedDto = ApiJson.decodeFromString<HealthDto>(contractFixture("health.degraded.json"))
        var current = degradedDto
        val api = FakeJobFlowApi { Response.success(current) }
        val repository = HealthRepositoryImpl(api, clock)

        repository.refresh()
        current = readyDto
        val second = repository.refresh()

        assertEquals(2, api.calls)
        assertEquals(HealthStatus.OK, second.result.getOrNull()?.status)
    }

    @Test
    fun `a 503 with a degraded body is an answer, not a failure`() = runTest {
        val api = FakeJobFlowApi { httpError(503, contractFixture("health.degraded.json")) }

        val snapshot = HealthRepositoryImpl(api, clock).refresh()

        assertEquals(HealthStatus.DEGRADED, snapshot.result.getOrNull()?.status)
    }

    @Test
    fun `a 503 with an error code keeps that code`() = runTest {
        val api = FakeJobFlowApi { httpError(503, contractFixture("errors/auth-unavailable.json")) }

        val snapshot = HealthRepositoryImpl(api, clock).refresh()

        assertEquals(Either.Left(AppError.Rejected(ApiErrorCode.AUTH_UNAVAILABLE)), snapshot.result)
    }

    @Test
    fun `a 503 with no readable body is a server failure`() = runTest {
        val api = FakeJobFlowApi { httpError(503, "<html>down</html>") }

        val snapshot = HealthRepositoryImpl(api, clock).refresh()

        assertEquals(Either.Left(AppError.ServerFailure(503)), snapshot.result)
    }

    @Test
    fun `a health body on another failure status is not taken as an answer`() = runTest {
        val api = FakeJobFlowApi { httpError(500, contractFixture("health.ok.json")) }

        val snapshot = HealthRepositoryImpl(api, clock).refresh()

        assertEquals(Either.Left(AppError.ServerFailure(500)), snapshot.result)
    }

    @Test
    fun `a success status with no body is an invalid response`() = runTest {
        val api = FakeJobFlowApi { Response.success<HealthDto>(204, null) }

        val snapshot = HealthRepositoryImpl(api, clock).refresh()

        assertEquals(Either.Left(AppError.InvalidResponse), snapshot.result)
    }

    @Test
    fun `a 429 keeps the rate limit code`() = runTest {
        val api = FakeJobFlowApi { httpError(429, contractFixture("errors/rate-limited.json")) }

        val snapshot = HealthRepositoryImpl(api, clock).refresh()

        assertEquals(Either.Left(AppError.Rejected(ApiErrorCode.RATE_LIMITED)), snapshot.result)
    }

    @Test
    fun `latest publishes every snapshot with the clock time`() = runTest {
        val repository = HealthRepositoryImpl(FakeJobFlowApi { Response.success(readyDto) }, clock)

        val snapshot = repository.refresh()

        assertEquals(snapshot, repository.latest.value)
        assertEquals(clock.instant(), snapshot.checkedAt)
    }

    @Test
    fun `latest publishes a failure too, so screens stop showing the last good answer`() = runTest {
        val repository = HealthRepositoryImpl(FakeJobFlowApi { throw IOException() }, clock)

        val snapshot = repository.refresh()

        assertEquals(snapshot, repository.latest.value)
        assertEquals(Either.Left(AppError.Unreachable), snapshot.result)
    }

    @Test
    fun `concurrent refreshes share one request`() = runTest {
        val gate = CompletableDeferred<HealthDto>()
        val api = FakeJobFlowApi { Response.success(gate.await()) }
        val repository = HealthRepositoryImpl(api, clock)

        val pending = List(2) { async { repository.refresh() } }
        testScheduler.advanceUntilIdle()
        gate.complete(readyDto)
        pending.awaitAll()

        assertEquals(1, api.calls)
    }

    private class FakeJobFlowApi(private val respond: suspend () -> Response<HealthDto>) : JobFlowApi {
        var calls = 0
            private set

        override suspend fun getHealth(): Response<HealthDto> {
            calls++
            return respond()
        }
    }

    private fun httpError(status: Int, body: String): Response<HealthDto> =
        Response.error(status, body.toResponseBody())

    private class TestClock(private var now: Instant) : Clock() {
        fun advance(duration: Duration) {
            now = now.plus(duration)
        }

        override fun instant(): Instant = now

        override fun getZone(): ZoneId = ZoneOffset.UTC

        override fun withZone(zone: ZoneId?): Clock = this
    }
}

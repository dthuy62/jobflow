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
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.getOrNull
import me.dthuy.jobflow.data.remote.ApiJson
import me.dthuy.jobflow.data.remote.CareerOpsApi
import me.dthuy.jobflow.data.remote.dto.HealthDto
import me.dthuy.jobflow.domain.model.HealthStatus
import me.dthuy.jobflow.testing.contractFixture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HealthRepositoryImplTest {
    private val clock = TestClock(Instant.parse("2026-10-30T02:00:00Z"))
    private val readyDto = ApiJson.decodeFromString<HealthDto>(contractFixture("health.ready.json"))

    @Test
    fun `cached success is reused within the freshness window`() = runTest {
        val api = FakeCareerOpsApi { readyDto }
        val repository = HealthRepositoryImpl(api, clock)

        repository.refresh()
        clock.advance(Duration.ofHours(1))
        repository.refresh()

        assertEquals(1, api.calls)
    }

    @Test
    fun `success expires after the freshness window`() = runTest {
        val api = FakeCareerOpsApi { readyDto }
        val repository = HealthRepositoryImpl(api, clock)

        repository.refresh()
        clock.advance(Duration.ofMillis(HealthRepositoryImpl.FRESHNESS_WINDOW_MILLIS + 1))
        repository.refresh()

        assertEquals(2, api.calls)
    }

    @Test
    fun `force bypasses the cache`() = runTest {
        val api = FakeCareerOpsApi { readyDto }
        val repository = HealthRepositoryImpl(api, clock)

        repository.refresh()
        repository.refresh(force = true)

        assertEquals(2, api.calls)
    }

    @Test
    fun `failure is never served from cache`() = runTest {
        var down = true
        val api = FakeCareerOpsApi { if (down) throw IOException() else readyDto }
        val repository = HealthRepositoryImpl(api, clock)

        val first = repository.refresh()
        down = false
        val second = repository.refresh()

        assertEquals(Either.Left(AppError.Unreachable), first.result)
        assertTrue(second.result is Either.Right)
        assertEquals(2, api.calls)
    }

    @Test
    fun `a not ready answer is never served from cache`() = runTest {
        val notReadyDto = ApiJson.decodeFromString<HealthDto>(contractFixture("health.not-ready.json"))
        var current = notReadyDto
        val api = FakeCareerOpsApi { current }
        val repository = HealthRepositoryImpl(api, clock)

        repository.refresh()
        current = readyDto
        val second = repository.refresh()

        assertEquals(2, api.calls)
        assertEquals(HealthStatus.READY, second.result.getOrNull()?.status)
    }

    @Test
    fun `latest publishes every snapshot with the clock time`() = runTest {
        val repository = HealthRepositoryImpl(FakeCareerOpsApi { readyDto }, clock)

        val snapshot = repository.refresh()

        assertEquals(snapshot, repository.latest.value)
        assertEquals(clock.instant(), snapshot.checkedAt)
    }

    @Test
    fun `concurrent refreshes share one request`() = runTest {
        val gate = CompletableDeferred<HealthDto>()
        val api = FakeCareerOpsApi { gate.await() }
        val repository = HealthRepositoryImpl(api, clock)

        val pending = List(2) { async { repository.refresh() } }
        testScheduler.advanceUntilIdle()
        gate.complete(readyDto)
        pending.awaitAll()

        assertEquals(1, api.calls)
    }

    private class FakeCareerOpsApi(private val respond: suspend () -> HealthDto) : CareerOpsApi {
        var calls = 0
            private set

        override suspend fun getHealth(): HealthDto {
            calls++
            return respond()
        }
    }

    private class TestClock(private var now: Instant) : Clock() {
        fun advance(duration: Duration) {
            now = now.plus(duration)
        }

        override fun instant(): Instant = now

        override fun getZone(): ZoneId = ZoneOffset.UTC

        override fun withZone(zone: ZoneId?): Clock = this
    }
}

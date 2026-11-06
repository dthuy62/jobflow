package me.dthuy.jobflow.data.local

import javax.inject.Inject
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.catch
import me.dthuy.jobflow.data.local.dao.FeedDao
import me.dthuy.jobflow.domain.auth.SessionObserver
import me.dthuy.jobflow.domain.auth.UserId

/**
 * A user's feed must not outlive their session. The cache is keyed by the backend's user id, which the device keeps
 * with the session. A failure is not fatal: reads filter by owner, and the next change tries again.
 */
class FeedSessionCleanup @Inject constructor(private val dao: FeedDao) : SessionObserver {
    override suspend fun onUserChanged(userId: UserId?) {
        Either.catch(onError = Throwable::toLocalError) {
            if (userId == null) dao.deleteAllFeeds() else dao.deleteFeedsExcept(userId.value)
        }
    }
}

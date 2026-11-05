package me.dthuy.jobflow.data.local

import javax.inject.Inject
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.catch
import me.dthuy.jobflow.data.local.dao.FeedDao
import me.dthuy.jobflow.domain.auth.SessionObserver
import me.dthuy.jobflow.domain.auth.Uid

/**
 * A user's feed must not outlive their session. The cache is keyed by uid: unlike the API's user id, it is known
 * offline, and linking Google keeps it. A failure is not fatal: reads filter by owner, and the next change tries again.
 */
class FeedSessionCleanup @Inject constructor(private val dao: FeedDao) : SessionObserver {
    override suspend fun onSessionChanged(uid: Uid?) {
        Either.catch(onError = Throwable::toLocalError) {
            if (uid == null) dao.deleteAllFeeds() else dao.deleteFeedsExcept(uid.value)
        }
    }
}

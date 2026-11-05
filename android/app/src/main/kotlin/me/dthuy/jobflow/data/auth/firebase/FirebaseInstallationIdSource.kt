package me.dthuy.jobflow.data.auth.firebase

import com.google.firebase.installations.FirebaseInstallations
import javax.inject.Inject
import kotlinx.coroutines.tasks.await
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.catch
import me.dthuy.jobflow.core.common.getOrNull
import me.dthuy.jobflow.data.auth.InstallationIdSource
import timber.log.Timber

/** The Firebase Installation ID, which FCM is moving to. It changes on reinstall or when app data is cleared. */
class FirebaseInstallationIdSource @Inject constructor() : InstallationIdSource {
    override suspend fun id(): String? = Either.catch(onError = {
        Timber.w(it, "Could not read the installation id")
    }) {
        FirebaseInstallations.getInstance().id.await()
    }.getOrNull()
}

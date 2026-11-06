package me.dthuy.jobflow

import android.app.Application
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject
import me.dthuy.jobflow.domain.auth.AuthenticationService
import timber.log.Timber

@HiltAndroidApp
class MainApplication : Application() {
    // Created at start, so the session is read from the device before any screen asks for it.
    @Inject
    lateinit var authentication: AuthenticationService

    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) Timber.plant(Timber.DebugTree())
    }
}

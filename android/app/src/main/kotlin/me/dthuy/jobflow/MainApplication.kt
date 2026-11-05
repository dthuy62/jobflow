package me.dthuy.jobflow

import android.app.Application
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject
import me.dthuy.jobflow.domain.auth.AuthenticationService
import timber.log.Timber

@HiltAndroidApp
class MainApplication : Application() {
    // Created at start so an interrupted sign-in is rolled back before anything reads the session.
    @Inject
    lateinit var authentication: AuthenticationService

    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) Timber.plant(Timber.DebugTree())
    }
}

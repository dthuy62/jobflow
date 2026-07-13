package me.dthuy.jobflow

import android.app.Application
import me.dthuy.jobflow.core.logging.TimberLogger

class JobFlowApplication : Application() {
    lateinit var container: AppContainer

    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) {
            TimberLogger.plantDebugTree()
        }
        container = AppContainerImpl(this)
    }
}

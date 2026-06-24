package me.dthuy.jobflow

import android.app.Application

class JobFlowApplication : Application() {
    lateinit var container: AppContainer

    override fun onCreate() {
        super.onCreate()
        container = AppContainerImpl(this)
    }
}

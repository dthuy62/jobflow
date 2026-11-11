package me.dthuy.jobflow.core.common

import javax.inject.Qualifier

/** A scope that lives as long as the app, for work no screen owns. */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class ApplicationScope

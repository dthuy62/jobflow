package me.dthuy.jobflow.data.remote

import okhttp3.Request

private const val HEALTH_PATH = "api/v1/health"

/** The only public route, so checking the service never depends on a session. */
fun Request.isPublicRoute(): Boolean = url.encodedPath.endsWith(HEALTH_PATH)

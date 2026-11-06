package me.dthuy.jobflow.data.remote

import okhttp3.Request

// Health, so checking the service never depends on a session, and the calls that get or refresh one.
private val PUBLIC_PATHS = listOf("api/v1/health", "api/v1/auth/guest", "api/v1/auth/sso", "api/v1/auth/refresh")

fun Request.isPublicRoute(): Boolean = PUBLIC_PATHS.any(url.encodedPath::endsWith)

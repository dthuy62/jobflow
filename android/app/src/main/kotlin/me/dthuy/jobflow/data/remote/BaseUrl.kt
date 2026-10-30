package me.dthuy.jobflow.data.remote

/** Retrofit needs a base URL ending in `/`; endpoint paths in [CareerOpsApi] are relative to it. */
fun normalizeBaseUrl(raw: String): String {
    val trimmed = raw.trim()
    require(trimmed.isNotEmpty()) { "Wrapper base URL must not be blank." }
    return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
}

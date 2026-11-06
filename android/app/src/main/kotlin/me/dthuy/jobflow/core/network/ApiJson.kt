package me.dthuy.jobflow.core.network

import kotlinx.serialization.json.Json

/** The single JSON configuration for API payloads; additive fields from a newer API are ignored. */
val ApiJson: Json = Json { ignoreUnknownKeys = true }

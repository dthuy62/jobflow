package me.dthuy.jobflow.data.remote

import kotlinx.serialization.json.Json

/** The single JSON configuration for API payloads; additive fields from a newer API are ignored. */
internal val ApiJson: Json = Json { ignoreUnknownKeys = true }

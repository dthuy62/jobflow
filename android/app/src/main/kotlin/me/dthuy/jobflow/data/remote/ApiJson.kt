package me.dthuy.jobflow.data.remote

import kotlinx.serialization.json.Json

/** The single JSON configuration for wrapper payloads; additive fields from newer wrappers are ignored. */
internal val ApiJson: Json = Json { ignoreUnknownKeys = true }

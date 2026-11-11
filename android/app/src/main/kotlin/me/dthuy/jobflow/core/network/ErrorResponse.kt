package me.dthuy.jobflow.core.network

import kotlinx.serialization.Serializable

// The API's error body, the only shape every endpoint shares. Read by the remote error mapper.

@Serializable
data class ErrorResponseDto(val error: ErrorDto)

@Serializable
data class ErrorDto(val code: String, val message: String, val details: ErrorDetailsDto? = null)

@Serializable
data class ErrorDetailsDto(val fields: List<String>? = null, val retryAfterSeconds: Long? = null)

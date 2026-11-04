package me.dthuy.jobflow.domain.model

data class Health(val status: HealthStatus, val database: DependencyStatus)

/** Wire enums: values a newer API adds map to `UNKNOWN` instead of failing (see `toWireEnum`). */
enum class HealthStatus(val wireValue: String) {
    OK("ok"),
    DEGRADED("degraded"),
    UNKNOWN("unknown"),
}

enum class DependencyStatus(val wireValue: String) {
    OK("ok"),
    FAILED("failed"),
    UNKNOWN("unknown"),
}

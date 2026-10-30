package me.dthuy.jobflow.domain.model

data class Health(
    val status: HealthStatus,
    val apiVersion: ApiVersion,
    val workspace: WorkspaceHealth,
    val careerOps: CareerOpsReadiness,
    val capabilities: HealthCapabilities,
    val serverTime: String,
)

data class WorkspaceHealth(
    val status: WorkspaceStatus,
    val detected: Boolean,
    val careerOpsVersion: String?,
    val missingRequirements: List<String>,
    val messages: List<String>,
)

data class CareerOpsReadiness(
    val status: ReadinessStatus,
    val executionMode: ExecutionMode,
    val providerApiKeyRequired: Boolean,
    val aiCliRequired: Boolean,
    val scanner: ScannerReadiness,
)

data class ScannerReadiness(
    val status: ReadinessStatus,
    val commandType: ScannerCommandType,
    val missingRequirements: List<String>,
    val checks: List<ScriptReadinessCheck>,
    val messages: List<String>,
)

data class ScriptReadinessCheck(val name: ScriptReadinessCheckName, val status: ScriptReadinessCheckStatus)

data class HealthCapabilities(
    val cv: Boolean,
    val profile: Boolean,
    val portals: Boolean,
    val scan: Boolean,
    val reports: Boolean,
    val artifacts: Boolean,
    val cvConversion: Boolean,
    val geminiEvaluation: Boolean,
)

/** Wire enums: values a newer wrapper adds map to `UNKNOWN` instead of failing (see `toWireEnum`). */
enum class HealthStatus(val wireValue: String) {
    READY("ready"),
    DEGRADED("degraded"),
    NOT_READY("notReady"),
    UNKNOWN("unknown"),
}

enum class ApiVersion(val wireValue: String) {
    V1("v1"),
    UNKNOWN("unknown"),
}

enum class WorkspaceStatus(val wireValue: String) {
    READY("ready"),
    MISSING("missing"),
    INVALID("invalid"),
    UNKNOWN("unknown"),
}

enum class ReadinessStatus(val wireValue: String) {
    READY("ready"),
    NOT_READY("notReady"),
    UNKNOWN("unknown"),
}

enum class ExecutionMode(val wireValue: String) {
    LOCAL_SCRIPT_RUNNER("local-script-runner"),
    UNKNOWN("unknown"),
}

enum class ScannerCommandType(val wireValue: String) {
    LOCAL_SCRIPT("local-script"),
    UNKNOWN("unknown"),
}

enum class ScriptReadinessCheckName(val wireValue: String) {
    DOCTOR_SCRIPT("doctor-script"),
    SCAN_SCRIPT("scan-script"),
    PORTAL_CONFIG("portal-config"),
    UNKNOWN("unknown"),
}

enum class ScriptReadinessCheckStatus(val wireValue: String) {
    READY("ready"),
    MISSING("missing"),
    INVALID("invalid"),
    UNKNOWN("unknown"),
}

package me.dthuy.jobflow.data.remote.dto

import kotlinx.serialization.Serializable
import me.dthuy.jobflow.domain.model.ApiVersion
import me.dthuy.jobflow.domain.model.CareerOpsReadiness
import me.dthuy.jobflow.domain.model.ExecutionMode
import me.dthuy.jobflow.domain.model.Health
import me.dthuy.jobflow.domain.model.HealthCapabilities
import me.dthuy.jobflow.domain.model.HealthStatus
import me.dthuy.jobflow.domain.model.ReadinessStatus
import me.dthuy.jobflow.domain.model.ScannerCommandType
import me.dthuy.jobflow.domain.model.ScannerReadiness
import me.dthuy.jobflow.domain.model.ScriptReadinessCheck
import me.dthuy.jobflow.domain.model.ScriptReadinessCheckName
import me.dthuy.jobflow.domain.model.ScriptReadinessCheckStatus
import me.dthuy.jobflow.domain.model.WorkspaceHealth
import me.dthuy.jobflow.domain.model.WorkspaceStatus

@Serializable
data class HealthDto(
    val status: String,
    val apiVersion: String,
    val workspace: WorkspaceHealthDto,
    val careerOps: CareerOpsReadinessDto,
    val capabilities: HealthCapabilitiesDto,
    val serverTime: String,
)

@Serializable
data class WorkspaceHealthDto(
    val status: String,
    val detected: Boolean,
    val careerOpsVersion: String? = null,
    val missingRequirements: List<String>,
    val messages: List<String>,
)

@Serializable
data class CareerOpsReadinessDto(
    val status: String,
    val executionMode: String,
    val providerApiKeyRequired: Boolean,
    val aiCliRequired: Boolean,
    val scanner: ScannerReadinessDto,
)

@Serializable
data class ScannerReadinessDto(
    val status: String,
    val commandType: String,
    val missingRequirements: List<String>,
    val checks: List<ScriptReadinessCheckDto>,
    val messages: List<String>,
)

@Serializable
data class ScriptReadinessCheckDto(val name: String, val status: String)

@Serializable
data class HealthCapabilitiesDto(
    val cv: Boolean,
    val profile: Boolean,
    val portals: Boolean,
    val scan: Boolean,
    val reports: Boolean,
    val artifacts: Boolean,
    val cvConversion: Boolean,
    val geminiEvaluation: Boolean,
)

fun HealthDto.toDomain(): Health = Health(
    status = status.toWireEnum(HealthStatus::wireValue),
    apiVersion = apiVersion.toWireEnum(ApiVersion::wireValue),
    workspace = workspace.toDomain(),
    careerOps = careerOps.toDomain(),
    capabilities = capabilities.toDomain(),
    serverTime = serverTime,
)

fun Health.toDto(): HealthDto = HealthDto(
    status = status.wireValue,
    apiVersion = apiVersion.wireValue,
    workspace = workspace.toDto(),
    careerOps = careerOps.toDto(),
    capabilities = capabilities.toDto(),
    serverTime = serverTime,
)

private fun WorkspaceHealthDto.toDomain(): WorkspaceHealth = WorkspaceHealth(
    status = status.toWireEnum(WorkspaceStatus::wireValue),
    detected = detected,
    careerOpsVersion = careerOpsVersion,
    missingRequirements = missingRequirements,
    messages = messages,
)

private fun WorkspaceHealth.toDto(): WorkspaceHealthDto = WorkspaceHealthDto(
    status = status.wireValue,
    detected = detected,
    careerOpsVersion = careerOpsVersion,
    missingRequirements = missingRequirements,
    messages = messages,
)

private fun CareerOpsReadinessDto.toDomain(): CareerOpsReadiness = CareerOpsReadiness(
    status = status.toWireEnum(ReadinessStatus::wireValue),
    executionMode = executionMode.toWireEnum(ExecutionMode::wireValue),
    providerApiKeyRequired = providerApiKeyRequired,
    aiCliRequired = aiCliRequired,
    scanner = scanner.toDomain(),
)

private fun CareerOpsReadiness.toDto(): CareerOpsReadinessDto = CareerOpsReadinessDto(
    status = status.wireValue,
    executionMode = executionMode.wireValue,
    providerApiKeyRequired = providerApiKeyRequired,
    aiCliRequired = aiCliRequired,
    scanner = scanner.toDto(),
)

private fun ScannerReadinessDto.toDomain(): ScannerReadiness = ScannerReadiness(
    status = status.toWireEnum(ReadinessStatus::wireValue),
    commandType = commandType.toWireEnum(ScannerCommandType::wireValue),
    missingRequirements = missingRequirements,
    checks = checks.map { it.toDomain() },
    messages = messages,
)

private fun ScannerReadiness.toDto(): ScannerReadinessDto = ScannerReadinessDto(
    status = status.wireValue,
    commandType = commandType.wireValue,
    missingRequirements = missingRequirements,
    checks = checks.map { it.toDto() },
    messages = messages,
)

private fun ScriptReadinessCheckDto.toDomain(): ScriptReadinessCheck = ScriptReadinessCheck(
    name = name.toWireEnum(ScriptReadinessCheckName::wireValue),
    status = status.toWireEnum(ScriptReadinessCheckStatus::wireValue),
)

private fun ScriptReadinessCheck.toDto(): ScriptReadinessCheckDto = ScriptReadinessCheckDto(
    name = name.wireValue,
    status = status.wireValue,
)

private fun HealthCapabilitiesDto.toDomain(): HealthCapabilities = HealthCapabilities(
    cv = cv,
    profile = profile,
    portals = portals,
    scan = scan,
    reports = reports,
    artifacts = artifacts,
    cvConversion = cvConversion,
    geminiEvaluation = geminiEvaluation,
)

private fun HealthCapabilities.toDto(): HealthCapabilitiesDto = HealthCapabilitiesDto(
    cv = cv,
    profile = profile,
    portals = portals,
    scan = scan,
    reports = reports,
    artifacts = artifacts,
    cvConversion = cvConversion,
    geminiEvaluation = geminiEvaluation,
)

private inline fun <reified T : Enum<T>> String.toWireEnum(wireValue: (T) -> String): T =
    enumValues<T>().firstOrNull { wireValue(it) == this } ?: enumValueOf("UNKNOWN")

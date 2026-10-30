package me.dthuy.jobflow.data.remote.dto

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class ErrorResponseDto(val error: ErrorDto)

@Serializable
data class ErrorDto(val code: String, val message: String, val details: Map<String, JsonElement>? = null)

@Serializable
data class ApiCollectionDto(val items: List<JsonElement>, val syncedAt: String, val sourceRevision: String? = null)

@Serializable
data class CvDto(
    val markdown: String,
    val sizeBytes: Int,
    val updatedAt: String? = null,
    val sourceRevision: String? = null,
)

@Serializable
data class ProfileDto(
    val targetRoles: List<String>,
    val seniorityLevel: String,
    val preferredLocations: List<String>,
    val remotePreference: String,
    val salaryMin: Int? = null,
    val salaryMax: Int? = null,
    val salaryCurrency: String? = null,
    val workAuthorizationNote: String? = null,
    val mustHaveSkills: List<String>,
    val niceToHaveSkills: List<String>,
    val excludedKeywords: List<String>,
    val positioningSummary: String? = null,
    val sourceRevision: String? = null,
    val updatedAt: String? = null,
)

@Serializable
data class PortalDto(
    val titlePositiveKeywords: List<String>,
    val titleNegativeKeywords: List<String>,
    val locationAllowList: List<String>,
    val locationBlockList: List<String>,
    val salaryMin: Int? = null,
    val salaryMax: Int? = null,
    val salaryCurrency: String? = null,
    val trackedCompanies: List<PortalCompanyDto>,
    val searchQueries: List<PortalSearchQueryDto>,
    val sourceRevision: String? = null,
    val updatedAt: String? = null,
)

@Serializable
data class PortalCompanyDto(
    val id: String? = null,
    val name: String,
    val careersUrl: String,
    val provider: String? = null,
    val enabled: Boolean,
)

@Serializable
data class PortalSearchQueryDto(val id: String? = null, val label: String, val query: String, val enabled: Boolean)

@Serializable
data class OfferDto(
    val id: String,
    val company: String,
    val title: String,
    val url: String? = null,
    val location: String? = null,
    val source: String,
    val status: String,
    val firstSeenAt: String? = null,
    val lastSeenAt: String? = null,
    val scanRunId: String? = null,
    val salaryMin: Int? = null,
    val salaryMax: Int? = null,
    val salaryCurrency: String? = null,
    val workMode: String,
    val score: Double? = null,
    val reportId: String? = null,
    val artifactIds: List<String> = emptyList(),
    val rawSource: String? = null,
    val notes: String? = null,
    val warnings: List<String> = emptyList(),
)

@Serializable
data class ScanRunDto(
    val id: String,
    val status: String,
    val stage: String,
    val startedAt: String? = null,
    val finishedAt: String? = null,
    val exitCode: Int? = null,
    val active: Boolean,
    val summary: ScanRunSummaryDto,
    val failure: ScanRunFailureDto? = null,
    val sourceRevision: String? = null,
)

@Serializable
data class ScanRunSummaryDto(val offersFound: Int, val offersProjected: Int, val warnings: List<String>)

@Serializable
data class ScanRunFailureDto(val code: String, val message: String)

@Serializable
data class ReportListItemDto(
    val id: String,
    val offerId: String? = null,
    val title: String,
    val kind: String,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val sourceRevision: String? = null,
)

@Serializable
data class ReportDetailDto(
    val id: String,
    val offerId: String? = null,
    val title: String,
    val kind: String,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val sourceRevision: String? = null,
    val markdown: String,
)

@Serializable
data class ArtifactDto(
    val id: String,
    val offerId: String? = null,
    val reportId: String? = null,
    val filename: String,
    val contentType: String,
    val sizeBytes: Int? = null,
    val downloadUrl: String,
    val createdAt: String? = null,
    val sourceRevision: String? = null,
)

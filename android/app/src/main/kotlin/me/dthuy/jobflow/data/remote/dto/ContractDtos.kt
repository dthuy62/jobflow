package me.dthuy.jobflow.data.remote.dto

import kotlinx.serialization.Serializable

// Mirrors of the hosted contract that no screen reads yet. Enums stay strings until a mapper needs them.

@Serializable
data class ErrorResponseDto(val error: ErrorDto)

@Serializable
data class ErrorDto(val code: String, val message: String, val details: ErrorDetailsDto? = null)

@Serializable
data class ErrorDetailsDto(val fields: List<String>? = null, val retryAfterSeconds: Long? = null)

@Serializable
data class PreferencesDto(
    val roles: List<String>,
    val keywordsInclude: List<String>,
    val keywordsExclude: List<String>,
    val locations: List<String>,
    val remotePolicies: List<String>,
    val countries: List<String>,
    val minimumSalary: MinimumSalaryDto?,
    val seniority: List<String>,
    val aim: String?,
)

@Serializable
data class MinimumSalaryDto(val amount: Double, val currency: String, val period: String)

@Serializable
data class CvDto(val markdown: String, val updatedAt: String)

@Serializable
data class CvImportDto(val importId: String, val markdown: String)

@Serializable
data class CvUpdateRequest(val importId: String? = null, val markdown: String)

@Serializable
data class SalaryDto(val min: Double?, val max: Double?, val currency: String?, val period: String?)

@Serializable
data class JobSummaryDto(
    val jobId: String,
    val title: String,
    val company: String,
    val location: String?,
    val remotePolicy: String,
    val salary: SalaryDto?,
    val url: String,
    val firstSeenAt: String,
    val closed: Boolean,
)

@Serializable
data class JobDto(
    val jobId: String,
    val title: String,
    val company: String,
    val location: String?,
    val remotePolicy: String,
    val salary: SalaryDto?,
    val url: String,
    val firstSeenAt: String,
    val closed: Boolean,
    val source: String,
    val externalId: String?,
    val acceptedCountries: List<String>,
    val acceptedTimezones: List<String>,
    val descriptionText: String,
    val lastSeenAt: String,
)

@Serializable
data class FeedItemDto(
    val job: JobSummaryDto,
    val reasons: List<String>,
    val trackerStatus: String?,
    val matchedAt: String,
)

@Serializable
data class FeedPageDto(val items: List<FeedItemDto>, val nextCursor: String?)

@Serializable
data class TrackerEntryDto(val job: JobSummaryDto, val status: String, val updatedAt: String)

@Serializable
data class TrackerPageDto(val items: List<TrackerEntryDto>, val nextCursor: String?)

@Serializable
data class TrackerUpdateRequest(val status: String)

@Serializable
data class CompanyDto(val companyId: String, val name: String?, val careersUrl: String)

@Serializable
data class CompanyCreateRequest(val careersUrl: String)

@Serializable
data class DeviceUpdateRequest(val fcmToken: String)

@Serializable
data class SsoRequest(val guestToken: String? = null)

@Serializable
data class SsoResponseDto(val account: MeDto, val guestMerged: Boolean)

@Serializable
data class LogoutRequest(val installationId: String)

@Serializable
data class EvaluationDto(
    val evaluationId: String,
    val jobId: String,
    val stage: String,
    val createdAt: String,
    val updatedAt: String,
    val result: EvaluationResultDto?,
    val failureMessage: String?,
)

@Serializable
data class EvaluationResultDto(
    val score: Double,
    val summary: String,
    val reportMarkdown: String,
    val aiGenerated: Boolean,
)

@Serializable
data class EntitlementDto(val plan: String, val features: List<String>, val quotas: List<QuotaDto>)

@Serializable
data class QuotaDto(val feature: String, val used: Long, val limit: Long, val resetsAt: String?)

@Serializable
data class PurchaseRequest(val productId: String, val purchaseToken: String)

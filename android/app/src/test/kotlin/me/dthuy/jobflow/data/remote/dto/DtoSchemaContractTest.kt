package me.dthuy.jobflow.data.remote.dto

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.StructureKind
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.serializer
import me.dthuy.jobflow.domain.model.JobRemotePolicy
import me.dthuy.jobflow.domain.model.SalaryPeriod
import me.dthuy.jobflow.domain.model.TrackerStatus
import me.dthuy.jobflow.testing.contractFile
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Compares each DTO's shape with its schema in `contracts/openapi.json`. Parsing the examples cannot do this: a field
 * the DTO lost is ignored, and a field no example sets to null says nothing about whether the DTO accepts null.
 */
@OptIn(ExperimentalSerializationApi::class)
class DtoSchemaContractTest {
    private val schemas: JsonObject =
        Json.parseToJsonElement(contractFile("openapi.json")).jsonObject
            .getValue("components").jsonObject
            .getValue("schemas").jsonObject

    private val dtos: Map<String, SerialDescriptor> =
        mapOf(
            "CompanyCreateRequest" to serializer<CompanyCreateRequest>().descriptor,
            "CompanyDto" to serializer<CompanyDto>().descriptor,
            "CvDto" to serializer<CvDto>().descriptor,
            "CvImportDto" to serializer<CvImportDto>().descriptor,
            "CvUpdateRequest" to serializer<CvUpdateRequest>().descriptor,
            "DeviceUpdateRequest" to serializer<DeviceUpdateRequest>().descriptor,
            "EntitlementDto" to serializer<EntitlementDto>().descriptor,
            "ErrorDto" to serializer<ErrorDto>().descriptor,
            "ErrorResponseDto" to serializer<ErrorResponseDto>().descriptor,
            "EvaluationDto" to serializer<EvaluationDto>().descriptor,
            "FeedItemDto" to serializer<FeedItemDto>().descriptor,
            "FeedPageDto" to serializer<FeedPageDto>().descriptor,
            "HealthDto" to serializer<HealthDto>().descriptor,
            "JobDto" to serializer<JobDto>().descriptor,
            "JobSummaryDto" to serializer<JobSummaryDto>().descriptor,
            "MeDto" to serializer<MeDto>().descriptor,
            "PreferencesDto" to serializer<PreferencesDto>().descriptor,
            "PurchaseRequest" to serializer<PurchaseRequest>().descriptor,
            "TrackerEntryDto" to serializer<TrackerEntryDto>().descriptor,
            "TrackerPageDto" to serializer<TrackerPageDto>().descriptor,
            "TrackerUpdateRequest" to serializer<TrackerUpdateRequest>().descriptor,
        )

    @Test
    fun `every object schema in the contract has a DTO`() {
        val objectSchemas = schemas.filterValues { it.jsonObject.type() == "object" }.keys

        assertEquals(objectSchemas, dtos.keys)
    }

    @Test
    fun `domain enums know every wire value the contract allows`() {
        val domain = mapOf(
            "JobRemotePolicy" to JobRemotePolicy.entries.map { it.wireValue },
            "SalaryPeriod" to SalaryPeriod.entries.map { it.wireValue },
            "TrackerStatus" to TrackerStatus.entries.map { it.wireValue },
        )

        domain.forEach { (name, wireValues) ->
            val contract = schemas.getValue(name).jsonObject.getValue("enum").jsonArray.map { it.jsonPrimitive.content }
            assertEquals(name, contract.toSet() + "unknown", wireValues.toSet())
        }
    }

    @Test
    fun `every DTO matches its schema, field by field`() {
        val problems = dtos.flatMap { (name, descriptor) ->
            differences(name, schemas.getValue(name).jsonObject, descriptor)
        }

        assertEquals(emptyList<String>(), problems)
    }

    /** An optional field is `T? = null` in Kotlin though the wire never sends null, so only required ones compare. */
    private fun differences(
        path: String,
        schema: JsonObject,
        descriptor: SerialDescriptor,
        optional: Boolean = false,
    ): List<String> {
        val nonNull = schema["anyOf"]?.jsonArray?.map { it.jsonObject }?.firstOrNull { it.type() != "null" }
        val nullable = nonNull != null
        val resolved = resolve(nonNull ?: schema)
        val nullability =
            if (optional ||
                nullable == descriptor.isNullable
            ) {
                emptyList()
            } else {
                listOf("$path: nullable should be $nullable")
            }
        val shape = when (val type = resolved.type()) {
            "object" -> objectDifferences(path, resolved, descriptor)
            "array" ->
                differences("$path[]", resolved.getValue("items").jsonObject, descriptor.getElementDescriptor(0))
            else -> if (descriptor.kind == PRIMITIVES[type]) emptyList() else listOf("$path: should be $type")
        }
        return nullability + shape
    }

    private fun objectDifferences(path: String, schema: JsonObject, descriptor: SerialDescriptor): List<String> {
        val properties = schema.getValue("properties").jsonObject
        val required = schema["required"]?.jsonArray?.map { it.jsonPrimitive.content }.orEmpty().toSet()
        val names = List(descriptor.elementsCount, descriptor::getElementName)
        if (descriptor.kind != StructureKind.CLASS || names.toSet() != properties.keys) {
            return listOf("$path: fields $names should be ${properties.keys}")
        }
        return names.flatMapIndexed { index, name ->
            val optional = name !in required
            val presence = if (descriptor.isElementOptional(index) == optional) {
                emptyList()
            } else {
                listOf("$path.$name: optional should be $optional")
            }
            val element = descriptor.getElementDescriptor(index)
            presence + differences("$path.$name", properties.getValue(name).jsonObject, element, optional)
        }
    }

    private fun resolve(schema: JsonObject): JsonObject {
        val ref = schema["\$ref"]?.jsonPrimitive?.content ?: return schema
        return schemas.getValue(ref.substringAfterLast('/')).jsonObject
    }

    private fun JsonObject.type(): String? = this["type"]?.jsonPrimitive?.content

    private companion object {
        val PRIMITIVES =
            mapOf(
                "string" to PrimitiveKind.STRING,
                "integer" to PrimitiveKind.LONG,
                "number" to PrimitiveKind.DOUBLE,
                "boolean" to PrimitiveKind.BOOLEAN,
            )
    }
}

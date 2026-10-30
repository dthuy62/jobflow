package me.dthuy.jobflow.data.remote

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.testing.contractFile
import org.junit.Assert.assertEquals
import org.junit.Test

class ApiErrorCodeContractTest {
    @Test
    fun `android error codes match the wrapper error contract`() {
        val wrapperCodes =
            Json.parseToJsonElement(contractFile("error-codes.json")).jsonArray.map { it.jsonPrimitive.content }.toSet()
        val androidCodes = ApiErrorCode.entries.filter { it != ApiErrorCode.UNKNOWN }.map { it.name }.toSet()

        assertEquals(wrapperCodes, androidCodes)
    }
}

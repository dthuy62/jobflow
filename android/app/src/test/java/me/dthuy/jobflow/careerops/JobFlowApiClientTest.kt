package me.dthuy.jobflow.careerops

import me.dthuy.jobflow.BuildConfig
import me.dthuy.jobflow.data.remote.JobFlowApiClient
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertThrows
import org.junit.Test

class JobFlowApiClientTest {
    @Test
    fun createsServiceFromFlavorDefaultBaseUrl() {
        val service = JobFlowApiClient.create(BuildConfig.CAREER_OPS_DEFAULT_BASE_URL, null)

        assertNotNull(service)
    }

    @Test
    fun createsServiceFromBaseUrlWithoutTrailingSlash() {
        val service = JobFlowApiClient.create("http://10.0.2.2:3000", null)

        assertNotNull(service)
    }

    @Test
    fun rejectsBlankBaseUrl() {
        assertThrows(IllegalArgumentException::class.java) {
            JobFlowApiClient.create(" ", null)
        }
    }
}

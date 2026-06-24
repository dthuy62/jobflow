package me.dthuy.jobflow.careerops

import me.dthuy.jobflow.data.remote.JobFlowAuthInterceptor
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class JobFlowAuthInterceptorTest {
    @Test
    fun `adds trimmed token header when token is configured`() {
        val terminal = RecordingTerminalInterceptor()

        executeRequest("  secret-token  ", terminal)

        assertEquals("secret-token", terminal.recordedRequest?.header("X-Career-Ops-Token"))
    }

    @Test
    fun `omits token header when token is blank`() {
        val terminal = RecordingTerminalInterceptor()

        executeRequest("   ", terminal)

        assertNull(terminal.recordedRequest?.header("X-Career-Ops-Token"))
    }

    @Test
    fun `omits token header when token is null`() {
        val terminal = RecordingTerminalInterceptor()

        executeRequest(null, terminal)

        assertNull(terminal.recordedRequest?.header("X-Career-Ops-Token"))
    }

    private fun executeRequest(pairingToken: String?, terminal: RecordingTerminalInterceptor) {
        val client = OkHttpClient.Builder()
            .addInterceptor(JobFlowAuthInterceptor(pairingToken))
            .addInterceptor(terminal)
            .build()

        client.newCall(
            Request.Builder()
                .url("http://10.0.2.2:3000/api/v1/health")
                .build()
        ).execute().close()
    }
}

private class RecordingTerminalInterceptor : Interceptor {
    var recordedRequest: Request? = null

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        recordedRequest = request
        return Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(200)
            .message("OK")
            .body("".toResponseBody(null))
            .build()
    }
}

package me.dthuy.jobflow.architecture

import com.lemonappdev.konsist.api.Konsist
import com.lemonappdev.konsist.api.declaration.KoFileDeclaration
import com.lemonappdev.konsist.api.verify.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ArchitectureTest {
    // Derived from this file's own package so it survives the package rename done by mobile-app-config.
    private val root = ArchitectureTest::class.java.packageName.removeSuffix(".architecture")
    private val sharedUiPackages = setOf("theme", "components", "health", "auth")

    @Test
    fun `ui layer should not import from data layer`() {
        filesIn("ui").assertFalse { file -> file.imports.any { it.name.startsWith("$root.data.") } }
    }

    @Test
    fun `domain layer should not import Android framework types`() {
        filesIn("domain").assertFalse { file ->
            file.imports.any { import ->
                import.name.startsWith("android.") ||
                    import.name.startsWith("androidx.room.") ||
                    import.name.startsWith("androidx.room3.") ||
                    import.name.startsWith("androidx.datastore.")
            }
        }
    }

    @Test
    fun `ui features should not import from each other`() {
        val features = uiFeatures()
        assertTrue("No ui features found; is the package layout still ui/<feature>?", features.isNotEmpty())

        features.forEach { feature ->
            val others = features - feature
            filesIn("ui.$feature").assertFalse { file ->
                file.imports.any { import -> others.any { import.name.startsWith("$root.ui.$it.") } }
            }
        }
    }

    @Test
    fun `exceptions are only caught at data boundaries`() {
        val allowed = listOf("core.common", "core.network", "data.remote", "data.local", "data.auth").map {
            "$root.$it"
        }
        Konsist.scopeFromProduction().files
            .filterNot { file -> allowed.any { file.packagee?.name?.startsWith(it) == true } }
            .assertFalse { file -> CATCHING.containsMatchIn(file.text) }
    }

    @Test
    fun `only the Firebase adapter calls Firebase`() {
        assertOnlyImportedIn(listOf("data.auth.firebase"), "com.google.firebase.", "com.google.android.gms.")
    }

    @Test
    fun `only the Google sheet and the auth adapter use Credential Manager`() {
        assertOnlyImportedIn(
            listOf("ui.auth", "data.auth.firebase"),
            "androidx.credentials.",
            "com.google.android.libraries.identity.googleid.",
        )
    }

    // What keeps auth movable to another project: it needs only itself and core, which any project copies along.
    @Test
    fun `auth depends on nothing else in the app`() {
        val allowedByLayer = mapOf(
            "domain.auth" to listOf("domain.auth", "core.common"),
            "data.auth" to listOf("data.auth", "domain.auth", "core.common", "core.network"),
            "ui.auth" to listOf("ui.auth", "domain.auth", "core.common", "core.mvi", "R"),
        )
        allowedByLayer.forEach { (layer, allowed) ->
            productionFilesIn(layer).assertFalse { file ->
                file.imports.any { import ->
                    import.name.startsWith("$root.") &&
                        allowed.none { import.name == "$root.$it" || import.name.startsWith("$root.$it.") }
                }
            }
        }
    }

    private fun productionFilesIn(subPackage: String): List<KoFileDeclaration> {
        val files = Konsist.scopeFromProduction().files.filter {
            it.packagee?.name?.startsWith("$root.$subPackage") ==
                true
        }
        assertTrue("No files found in $root.$subPackage; did the package move?", files.isNotEmpty())
        return files
    }

    @Test
    fun `everything else in auth does not depend on the Firebase adapter`() {
        val adapter = "$root.data.auth.firebase"
        Konsist.scopeFromProduction().files
            .filterNot { it.name == VENDOR_MODULE || it.packagee?.name?.startsWith(adapter) == true }
            .assertFalse { file -> file.imports.any { it.name.startsWith("$adapter.") } }
    }

    private fun assertOnlyImportedIn(allowedPackages: List<String>, vararg prefixes: String) {
        val allowed = allowedPackages.map { "$root.$it" }
        Konsist.scopeFromProduction().files
            .filterNot { file ->
                file.name == VENDOR_MODULE ||
                    allowed.any { file.packagee?.name?.startsWith(it) == true }
            }
            .assertFalse { file -> file.imports.any { import -> prefixes.any(import.name::startsWith) } }
    }

    private fun filesIn(subPackage: String): List<KoFileDeclaration> {
        val files = Konsist.scopeFromPackage("$root.$subPackage..").files
        assertTrue("No files found in $root.$subPackage; did the package move?", files.isNotEmpty())
        return files
    }

    private fun uiFeatures(): Set<String> = filesIn("ui")
        .mapNotNull { it.packagee?.name }
        .filter { it.startsWith("$root.ui.") }
        .map { it.removePrefix("$root.ui.").substringBefore('.') }
        .filterNot { it in sharedUiPackages }
        .toSet()

    private companion object {
        // The one place that picks the identity vendor (ADR 13), with the rest of auth's wiring (ADR 17).
        const val VENDOR_MODULE = "AuthModule"
        val CATCHING = Regex("""\btry\s*\{|(?<!\.)\bcatch\s*\(|\brunCatching\b""")
    }
}

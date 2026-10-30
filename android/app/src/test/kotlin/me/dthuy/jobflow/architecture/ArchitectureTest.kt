package me.dthuy.jobflow.architecture

import com.lemonappdev.konsist.api.Konsist
import com.lemonappdev.konsist.api.declaration.KoFileDeclaration
import com.lemonappdev.konsist.api.verify.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ArchitectureTest {
    // Derived from this file's own package so it survives the package rename done by mobile-app-config.
    private val root = ArchitectureTest::class.java.packageName.removeSuffix(".architecture")
    private val sharedUiPackages = setOf("theme")

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
        val allowed = listOf("core.common", "data.remote", "data.local").map { "$root.$it" }
        Konsist.scopeFromProduction().files
            .filterNot { file -> allowed.any { file.packagee?.name?.startsWith(it) == true } }
            .assertFalse { file -> CATCHING.containsMatchIn(file.text) }
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
        val CATCHING = Regex("""\btry\s*\{|\bcatch\s*\(|\brunCatching\b""")
    }
}

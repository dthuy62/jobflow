package me.dthuy.jobflow.docs

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

class DocsTest {
    private val root: File =
        generateSequence(File(checkNotNull(System.getProperty("user.dir"))).absoluteFile) { it.parentFile }
            .first { File(it, "settings.gradle.kts").exists() }
    private val docs = File(root, "docs")
    private val guides = docs.listFiles { f -> f.extension == "md" }.orEmpty().sortedBy { it.name }
    private val linkedDocs = guides + File(docs, "decisions").listFiles { f -> f.extension == "md" }.orEmpty()
    private val rootPackage = DocsTest::class.java.packageName.removeSuffix(".docs")

    @Test
    fun `docs folder has the guides`() {
        assertTrue("Expected the docs guides in ${docs.path}", guides.size >= MIN_GUIDES)
    }

    @Test
    fun `relative links and anchors resolve`() {
        val failures = linkedDocs.flatMap { doc ->
            LINK.findAll(doc.readText()).map { it.groupValues[1] }
                .filterNot { it.startsWith("http://") || it.startsWith("https://") || it.startsWith("mailto:") }
                .mapNotNull { target -> brokenLink(doc, target) }
        }
        assertNoFailures(failures)
    }

    @Test
    fun `repo paths named in guides exist`() {
        val failures = guides.flatMap { doc ->
            CODE_SPAN.findAll(doc.readText()).map { literalRepoPath(it.groupValues[1]) }
                .filterNotNull()
                .filterNot { File(root, it).exists() }
                .map { "${doc.name}: `$it` does not exist" }
        }
        assertNoFailures(failures)
    }

    @Test
    fun `package map covers every top level package`() {
        val summary = File(docs, "codebase-summary.md").readText()
        val mainDir = File(root, "app/src/main/kotlin/${rootPackage.replace('.', '/')}")
        val packages = mainDir.listFiles { f -> f.isDirectory }.orEmpty().map { it.name }
        assertTrue("No packages found in ${mainDir.path}", packages.isNotEmpty())
        val failures = packages
            .filterNot { summary.contains("`$it`") || summary.contains("`$it/") }
            .map { "codebase-summary.md does not mention package `$it`" }
        assertNoFailures(failures)
    }

    @Test
    fun `verify command has a single source`() {
        val canonical = checkNotNull(VERIFY.find(File(root, "AGENTS.md").readText())).value.trim()
        val skills = File(root, ".claude/skills").walkTopDown().filter { it.extension == "md" }.toList()
        val failures = (listOf(File(root, "AGENTS.md"), File(root, "README.md")) + guides + skills)
            .flatMap { file ->
                VERIFY.findAll(file.readText()).map { it.value.trim() }
                    .filter { it != canonical }
                    .map { "${file.relativeTo(root).path}: `$it` differs from AGENTS.md" }
            }
        assertNoFailures(failures)
    }

    private fun brokenLink(doc: File, target: String): String? {
        val path = target.substringBefore('#')
        val fragment = target.substringAfter('#', missingDelimiterValue = "")
        val resolved = if (path.isEmpty()) doc else File(doc.parentFile, path).canonicalFile
        return when {
            !resolved.exists() -> "${doc.name}: link `$target` does not resolve"
            fragment.isNotEmpty() && resolved.extension == "md" && fragment !in anchors(resolved) ->
                "${doc.name}: link `$target` has no matching heading"
            else -> null
        }
    }

    private fun anchors(file: File): Set<String> =
        HEADING.findAll(file.readText()).map { slug(it.groupValues[1]) }.toSet()

    private fun slug(heading: String): String =
        heading.lowercase().replace("`", "").replace(NON_SLUG, "").trim().replace(' ', '-')

    private fun literalRepoPath(span: String): String? {
        val candidate = span.trim().trimEnd('.', ',', ';', ':').replace(LINE_SUFFIX, "")
        val isRepoPath = REPO_PATH_ROOTS.any { candidate.startsWith(it) }
        return candidate.takeIf { isRepoPath && NOT_A_LITERAL_PATH.none { marker -> marker in candidate } }
    }

    private fun assertNoFailures(failures: List<String>) {
        assertTrue("Docs are out of date:\n" + failures.joinToString("\n"), failures.isEmpty())
    }

    private companion object {
        const val MIN_GUIDES = 8
        val LINK = Regex("""]\(([^)\s]+)\)""")
        val CODE_SPAN = Regex("""`([^`\n]+)`""")
        val HEADING = Regex("""^#{1,6}\s+(.+?)\s*$""", RegexOption.MULTILINE)
        val VERIFY = Regex("""\./gradlew [^\n`]*test(?:Dev)?DebugUnitTest[^\n`]*""")
        val NON_SLUG = Regex("[^a-z0-9 _-]")
        val LINE_SUFFIX = Regex(":\\d+$")
        val REPO_PATH_ROOTS =
            listOf("app/", "docs/", "scripts/", "config/", "tools/", "gradle/", ".github/", ".claude/")
        val NOT_A_LITERAL_PATH = listOf("<", ">", "*", "...", " ", "{", "(")
    }
}

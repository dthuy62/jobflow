// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.google.devtools.ksp) apply false
    alias(libs.plugins.detekt) apply false
    alias(libs.plugins.ktlint)
}

configure<org.jlleitschuh.gradle.ktlint.KtlintExtension> {
    version.set(libs.versions.ktlint.get())
}

tasks.register("qualityCheck") {
    group = "verification"
    description = "Runs Kotlin formatting and static-analysis checks."
    dependsOn(":ktlintCheck", ":app:ktlintCheck", ":app:detekt")
}

tasks.register<Exec>("installGitHooks") {
    group = "setup"
    description = "Configures this worktree to use the tracked Git hooks."
    workingDir = rootDir.parentFile
    commandLine("git", "config", "--local", "core.hooksPath", ".githooks")
}

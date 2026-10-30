package me.dthuy.jobflow.testing

import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

/** Reads a file from the wrapper's checked-in contracts; Android never keeps its own copy. */
fun contractFile(relativePath: String): String {
    val candidates =
        listOf(
            Paths.get("../career-ops-wrapper/contracts", relativePath),
            Paths.get("../../career-ops-wrapper/contracts", relativePath),
            Paths.get("career-ops-wrapper/contracts", relativePath),
        ).map(Path::normalize)
    val path =
        candidates.firstOrNull(Files::isRegularFile)
            ?: error("Contract file not found: $relativePath; checked $candidates")
    return Files.readString(path)
}

/** Reads a JSON example from `career-ops-wrapper/contracts/examples`. */
fun contractFixture(relativePath: String): String = contractFile("examples/$relativePath")

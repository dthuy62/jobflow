package me.dthuy.jobflow.testing

import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

private val CONTRACT_ROOTS = listOf("../contracts", "../../contracts", "contracts")

private fun contractRoot(): Path = CONTRACT_ROOTS.map { Paths.get(it).normalize() }.firstOrNull(Files::isDirectory)
    ?: error("Contract directory not found; checked $CONTRACT_ROOTS")

/** Reads a file from the hosted contract at the repo root; Android never keeps its own copy. */
fun contractFile(relativePath: String): String = Files.readString(contractRoot().resolve(relativePath))

/** The directory of `contracts/examples`, for tests that check every example. */
fun contractExamplesDir(): Path = contractRoot().resolve("examples")

/** Reads a JSON example from `contracts/examples`. */
fun contractFixture(relativePath: String): String = contractFile("examples/$relativePath")

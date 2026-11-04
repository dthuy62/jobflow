package me.dthuy.jobflow.data.remote

internal inline fun <reified T : Enum<T>> String.toWireEnum(wireValue: (T) -> String): T =
    enumValues<T>().firstOrNull { wireValue(it) == this } ?: enumValueOf("UNKNOWN")

package me.dthuy.jobflow.data.local

import androidx.room3.ColumnTypeConverter
import me.dthuy.jobflow.data.remote.ApiJson

class StringListConverter {
    @ColumnTypeConverter
    fun toJson(values: List<String>): String = ApiJson.encodeToString(values)

    @ColumnTypeConverter
    fun fromJson(json: String): List<String> = ApiJson.decodeFromString(json)
}

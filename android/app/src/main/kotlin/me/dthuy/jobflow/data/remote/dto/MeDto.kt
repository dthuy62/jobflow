package me.dthuy.jobflow.data.remote.dto

import kotlinx.serialization.Serializable
import me.dthuy.jobflow.domain.model.Account

@Serializable
data class MeDto(val userId: String, val isAnonymous: Boolean, val createdAt: String)

fun MeDto.toDomain(): Account = Account(userId = userId, isAnonymous = isAnonymous)

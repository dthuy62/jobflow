package me.dthuy.jobflow.domain.model

enum class ChatRole { User, Assistant }

data class ChatMessage(val id: Long, val role: ChatRole, val text: String, val createdAtMillis: Long)

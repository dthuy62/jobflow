package me.dthuy.jobflow.testing

import me.dthuy.jobflow.data.remote.ApiJson
import me.dthuy.jobflow.data.remote.dto.HealthDto
import me.dthuy.jobflow.data.remote.dto.toDomain
import me.dthuy.jobflow.domain.model.Health

/** A domain [Health] parsed from a wrapper fixture, so UI tests never import `data/`. */
fun healthFixture(name: String): Health = ApiJson.decodeFromString<HealthDto>(contractFixture(name)).toDomain()

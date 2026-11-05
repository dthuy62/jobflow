package me.dthuy.jobflow.domain.repository

import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.domain.model.Account

interface AccountRepository {
    /** What the API knows about the signed-in user. Their first authenticated call creates them there. */
    suspend fun account(): Either<AppError, Account>
}

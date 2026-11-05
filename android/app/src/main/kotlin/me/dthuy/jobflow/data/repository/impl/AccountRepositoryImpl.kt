package me.dthuy.jobflow.data.repository.impl

import javax.inject.Inject
import javax.inject.Singleton
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.catch
import me.dthuy.jobflow.data.remote.JobFlowApi
import me.dthuy.jobflow.data.remote.dto.toDomain
import me.dthuy.jobflow.data.remote.toApiError
import me.dthuy.jobflow.domain.model.Account
import me.dthuy.jobflow.domain.repository.AccountRepository

@Singleton
class AccountRepositoryImpl @Inject constructor(private val api: JobFlowApi) : AccountRepository {
    override suspend fun account(): Either<AppError, Account> =
        Either.catch(onError = Throwable::toApiError) { api.getMe().toDomain() }
}

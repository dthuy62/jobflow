package me.dthuy.jobflow.testing

import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.domain.model.Account
import me.dthuy.jobflow.domain.repository.AccountRepository

class FakeAccountRepository(
    var account: Either<AppError, Account> = Either.Right(Account(userId = "user_1", isAnonymous = true)),
) : AccountRepository {
    var calls = 0

    /** Thrown instead of answering, for what cannot be an expected failure, such as a cancelled task. */
    var failure: Exception? = null

    override suspend fun account(): Either<AppError, Account> {
        calls++
        failure?.let { throw it }
        return account
    }
}

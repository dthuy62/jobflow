package me.dthuy.jobflow.testing

import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.domain.model.Account
import me.dthuy.jobflow.domain.repository.AccountRepository

class FakeAccountRepository(
    var account: Either<AppError, Account> = Either.Right(Account(userId = "user_1", isAnonymous = true)),
) : AccountRepository {
    var calls = 0

    override suspend fun account(): Either<AppError, Account> {
        calls++
        return account
    }
}

package me.dthuy.jobflow.ui.settings

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.testing.FakeAccountRepository
import me.dthuy.jobflow.testing.FakeAuthRepository
import me.dthuy.jobflow.testing.FakeHealthRepository
import me.dthuy.jobflow.testing.MEMBER_SESSION
import me.dthuy.jobflow.ui.auth.AuthViewModel
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** The card's buttons against both real ViewModels, because the bugs here live between them. */
@OptIn(ExperimentalCoroutinesApi::class)
class AccountActionsTest {
    private val dispatcher = UnconfinedTestDispatcher()
    private val accounts = FakeAccountRepository(account = Either.Left(AppError.Unauthorized))
    private val auth = FakeAuthRepository(session = MEMBER_SESSION)

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `a rejected member can sign in, and signing in again asks the API again`() = runTest {
        val card = card()
        val checksBefore = accounts.calls
        assertTrue(card.state().canSignIn)

        card.actions.onSignIn()

        assertEquals(checksBefore + 1, accounts.calls)
        assertTrue(card.state().canSignIn)
        assertNotNull(card.state().error)
    }

    @Test
    fun `closing the sheet keeps the prompt of a rejected member`() = runTest {
        val card = card(requestToken = { Either.Right(null) })

        card.actions.onSignIn()

        assertTrue(card.state().canSignIn)
        assertNotNull(card.state().error)
    }

    @Test
    fun `a failed sign-in of a rejected member can be tried again, and a good one asks the API`() = runTest {
        auth.signIn = Either.Left(AuthError.Network)
        val card = card()
        val checksBefore = accounts.calls

        card.actions.onSignIn()
        assertTrue(card.state().canSignIn)
        auth.signIn = Either.Right(Unit)
        card.actions.onSignIn()

        assertEquals(checksBefore + 1, accounts.calls)
    }

    private fun TestScope.card(
        requestToken: suspend () -> Either<AuthError, IdToken?> = { Either.Right(IdToken("token")) },
    ): Card {
        val settings = SettingsViewModel(FakeHealthRepository(), auth, accounts)
        val authViewModel = AuthViewModel(auth)
        backgroundScope.launch(dispatcher) { settings.uiState.collect {} }
        backgroundScope.launch(dispatcher) { authViewModel.uiState.collect {} }
        return Card(settings, authViewModel, accountActions(settings, authViewModel, requestToken))
    }

    private class Card(val settings: SettingsViewModel, val auth: AuthViewModel, val actions: AccountActions) {
        fun state() = accountUiState(auth.uiState.value, settings.uiState.value.accountCheck)
    }
}

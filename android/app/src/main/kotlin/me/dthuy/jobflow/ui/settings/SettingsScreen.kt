package me.dthuy.jobflow.ui.settings

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import me.dthuy.jobflow.R
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.ui.auth.AuthIntent
import me.dthuy.jobflow.ui.auth.AuthKind
import me.dthuy.jobflow.ui.auth.AuthState
import me.dthuy.jobflow.ui.auth.AuthViewModel
import me.dthuy.jobflow.ui.auth.requestGoogleIdToken
import me.dthuy.jobflow.ui.components.JobFlowPage
import me.dthuy.jobflow.ui.health.HealthDetailsCard
import me.dthuy.jobflow.ui.health.HealthSummaryCard

@Composable
fun SettingsScreen(
    contentPadding: PaddingValues,
    viewModel: SettingsViewModel = hiltViewModel(),
    authViewModel: AuthViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val auth by authViewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val webClientId = stringResource(R.string.default_web_client_id)
    SettingsContent(
        state = state,
        auth = auth,
        contentPadding = contentPadding,
        onCheckAgain = viewModel::onCheckAgain,
        onAuthIntent = authViewModel::onIntent,
        requestGoogleToken = { requestGoogleIdToken(context, webClientId) },
    )
}

@Composable
fun SettingsContent(
    state: SettingsUiState,
    auth: AuthState,
    contentPadding: PaddingValues,
    onCheckAgain: () -> Unit,
    onAuthIntent: (AuthIntent) -> Unit,
    requestGoogleToken: suspend () -> Either<AuthError, IdToken?>,
    modifier: Modifier = Modifier,
) {
    var confirmingMerge by rememberSaveable { mutableStateOf(false) }
    val signIn = { onAuthIntent(AuthIntent.SignInWithGoogle(requestGoogleToken)) }
    if (confirmingMerge) {
        MergeNoticeDialog(
            onConfirm = {
                confirmingMerge = false
                signIn()
            },
            onDismiss = { confirmingMerge = false },
        )
    }
    JobFlowPage(title = stringResource(R.string.settings_title), contentPadding = contentPadding, modifier = modifier) {
        AccountCard(
            state = auth,
            // A guest is told first that their data moves to the account they pick.
            onSignIn = { if (auth.kind == AuthKind.GUEST) confirmingMerge = true else signIn() },
            onContinueAsGuest = { onAuthIntent(AuthIntent.ContinueAsGuest) },
            onSignOut = { onAuthIntent(AuthIntent.SignOut) },
        )
        HealthSummaryCard(state.health)
        HealthDetailsCard(state.health, onCheckAgain = onCheckAgain)
    }
}

@Preview
@Composable
private fun SettingsContentPreview() {
    SettingsContent(
        state = SettingsUiState(),
        auth = AuthState(),
        contentPadding = PaddingValues(),
        onCheckAgain = {},
        onAuthIntent = {},
        requestGoogleToken = { Either.Right(null) },
    )
}

package me.dthuy.jobflow.ui.settings

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import me.dthuy.jobflow.R
import me.dthuy.jobflow.ui.auth.AuthKind
import me.dthuy.jobflow.ui.auth.AuthState
import me.dthuy.jobflow.ui.components.SectionLabel
import me.dthuy.jobflow.ui.components.SoftButton
import me.dthuy.jobflow.ui.components.SoftCard
import me.dthuy.jobflow.ui.theme.JobFlowBlue
import me.dthuy.jobflow.ui.theme.JobFlowInk
import me.dthuy.jobflow.ui.theme.JobFlowSurface

// shortcut: placeholder layout to exercise sign-in, replace it when the account design is ready.
@Composable
fun AccountCard(state: AuthState, onSignIn: () -> Unit, onContinueAsGuest: () -> Unit, onSignOut: () -> Unit) {
    SoftCard {
        SectionLabel(stringResource(R.string.account_section))
        Text(text = stringResource(state.kind.message()), color = JobFlowInk, fontWeight = FontWeight.Bold)
        state.error?.let { Text(text = stringResource(it.message), color = JobFlowInk) }
        if (state.canSignIn) AccountButton(R.string.account_sign_in, onSignIn)
        if (state.canContinueAsGuest) {
            AccountButton(
                R.string.account_continue_as_guest,
                onContinueAsGuest,
                primary = false,
            )
        }
        if (state.canSignOut) AccountButton(R.string.account_sign_out, onSignOut, primary = false)
    }
}

@Composable
private fun AccountButton(label: Int, onClick: () -> Unit, primary: Boolean = true) {
    SoftButton(onClick = onClick, containerColor = if (primary) JobFlowBlue else JobFlowSurface) {
        Text(stringResource(label), color = JobFlowInk, fontWeight = FontWeight.Black)
    }
}

private fun AuthKind.message(): Int = when (this) {
    AuthKind.LOADING -> R.string.account_loading
    AuthKind.SIGNED_OUT -> R.string.account_signed_out
    AuthKind.GUEST -> R.string.account_guest
    AuthKind.MEMBER -> R.string.account_google
}

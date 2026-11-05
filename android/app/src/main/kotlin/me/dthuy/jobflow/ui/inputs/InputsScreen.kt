package me.dthuy.jobflow.ui.inputs

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.sp
import me.dthuy.jobflow.R
import me.dthuy.jobflow.ui.components.JobFlowPage
import me.dthuy.jobflow.ui.components.SectionLabel
import me.dthuy.jobflow.ui.components.SoftCard
import me.dthuy.jobflow.ui.theme.JobFlowInk

/** Placeholder for the CV, profile and portal editors (Stories 2.5 and 3.3); no state yet, so no ViewModel. */
@Composable
fun InputsScreen(contentPadding: PaddingValues, modifier: Modifier = Modifier) {
    JobFlowPage(title = stringResource(R.string.inputs_title), contentPadding = contentPadding, modifier = modifier) {
        PlaceholderCard(R.string.inputs_cv, R.string.inputs_cv_body)
        PlaceholderCard(R.string.inputs_profile, R.string.inputs_profile_body)
        PlaceholderCard(R.string.inputs_portals, R.string.inputs_portals_body)
    }
}

@Composable
private fun PlaceholderCard(@StringRes title: Int, @StringRes body: Int) {
    SoftCard {
        SectionLabel(stringResource(title))
        Text(stringResource(body), color = JobFlowInk, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        Text(
            stringResource(R.string.inputs_coming_soon),
            color = JobFlowInk,
            fontSize = 12.sp,
            fontFamily = FontFamily.Monospace,
        )
    }
}

@Preview
@Composable
private fun InputsScreenPreview() {
    InputsScreen(contentPadding = PaddingValues())
}

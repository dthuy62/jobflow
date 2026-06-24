package me.dthuy.jobflow.presentation.screen.arena.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.dthuy.jobflow.presentation.component.NeoCard
import me.dthuy.jobflow.ui.theme.NeoBlack
import me.dthuy.jobflow.ui.theme.NeoWhite
import me.dthuy.jobflow.ui.theme.NeoYellow

@Composable
fun ArenaHeader(totalXp: Int, modifier: Modifier = Modifier) {
    NeoCard(
        modifier = modifier,
        backgroundColor = NeoYellow,
        shadowColor = NeoBlack,
        shadowOffset = 6.dp,
        shape = RoundedCornerShape(20.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    "TASK ARENA",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.ExtraBold,
                    fontFamily = FontFamily.SansSerif,
                    color = NeoBlack
                )
                Text(
                    "DEFEAT PROCRASTINATION • PLAY HARD",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = NeoBlack
                )
            }
            Column(
                modifier = Modifier
                    .background(NeoBlack, shape = RoundedCornerShape(10.dp))
                    .border(2.dp, NeoWhite, shape = RoundedCornerShape(10.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    "$totalXp XP",
                    color = NeoWhite,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    "EARNED",
                    color = NeoYellow,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
            }
        }
    }
}

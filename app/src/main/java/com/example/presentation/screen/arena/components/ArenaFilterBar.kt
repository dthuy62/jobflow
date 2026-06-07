package com.example.presentation.screen.arena.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import com.example.presentation.component.NeoBadge
import com.example.presentation.screen.arena.ArenaFilter
import com.example.ui.theme.NeoBlack
import com.example.ui.theme.NeoGreen
import com.example.ui.theme.NeoPink
import com.example.ui.theme.NeoWhite

@Composable
fun ArenaFilterBar(
    activeFilter: ArenaFilter,
    visibleCount: Int,
    onFilterSelected: (ArenaFilter) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            ArenaFilter.entries.forEach { filter ->
                val bg = if (filter == activeFilter) NeoGreen else NeoWhite
                Box(
                    modifier = Modifier
                        .background(bg, shape = RoundedCornerShape(10.dp))
                        .border(2.dp, NeoBlack, shape = RoundedCornerShape(10.dp))
                        .clickable { onFilterSelected(filter) }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(
                        filter.name,
                        color = NeoBlack,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }
        NeoBadge(text = "DARES: $visibleCount", backgroundColor = NeoPink)
    }
}

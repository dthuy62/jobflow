package com.example.presentation.component

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.NeoBlack
import com.example.ui.theme.NeoWhite
import com.example.ui.theme.NeoYellow

@Composable
fun NeoCard(
    modifier: Modifier = Modifier,
    backgroundColor: Color = NeoWhite,
    shadowColor: Color = NeoBlack,
    shadowOffset: Dp = 6.dp,
    borderWidth: Dp = 3.dp,
    content: @Composable BoxScope.() -> Unit
) {
    Box(modifier = modifier) {
        // Shadow (drawn underneath)
        Box(
            modifier = Modifier
                .matchParentSize()
                .offset(x = shadowOffset, y = shadowOffset)
                .background(shadowColor, shape = RectangleShape)
                .border(borderWidth, NeoBlack, shape = RectangleShape)
        )
        // Content card on top
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(backgroundColor, shape = RectangleShape)
                .border(borderWidth, NeoBlack, shape = RectangleShape)
                .padding(16.dp)
        ) {
            content()
        }
    }
}

@Composable
fun NeoButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    backgroundColor: Color = NeoYellow,
    shadowColor: Color = NeoBlack,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit
) {
    var isPressed by remember { mutableStateOf(false) }
    // Animate depth of depression on touch
    val offsetAnimation by animateDpAsState(
        targetValue = if (isPressed) 2.dp else 5.dp,
        label = "neoButtonPress"
    )

    Box(
        modifier = modifier
            .pointerInput(enabled) {
                if (enabled) {
                    detectTapGestures(
                        onPress = {
                            isPressed = true
                            try {
                                awaitRelease()
                            } finally {
                                isPressed = false
                            }
                        },
                        onTap = { onClick() }
                    )
                }
            }
            .clickable(
                enabled = enabled,
                onClick = {},
                interactionSource = remember { MutableInteractionSource() },
                indication = null // Disables default Material round-ripple overlays to respect strict brutalist physics
            )
    ) {
        // Flat Black Drop-Shadow
        Box(
            modifier = Modifier
                .matchParentSize()
                .offset(x = 5.dp, y = 5.dp)
                .background(shadowColor, shape = RectangleShape)
                .border(3.dp, NeoBlack, shape = RectangleShape)
        )
        // Button Surface
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .offset(x = offsetAnimation - 5.dp, y = offsetAnimation - 5.dp)
                .background(if (enabled) backgroundColor else Color.LightGray, shape = RectangleShape)
                .border(3.dp, NeoBlack, shape = RectangleShape)
                .padding(vertical = 12.dp, horizontal = 16.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            content()
        }
    }
}

@Composable
fun NeoTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    singleLine: Boolean = true,
    label: String? = null
) {
    Column(modifier = modifier) {
        if (label != null) {
            // Stylized brutalist label pin
            Box(
                modifier = Modifier
                    .background(NeoYellow, shape = RectangleShape)
                    .border(2.dp, NeoBlack, shape = RectangleShape)
                    .padding(horizontal = 10.dp, vertical = 2.dp)
            ) {
                Text(
                    text = label.uppercase(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = NeoBlack
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(NeoWhite, shape = RectangleShape)
                .border(3.dp, NeoBlack, shape = RectangleShape)
                .padding(14.dp)
        ) {
            if (value.isEmpty()) {
                Text(
                    text = placeholder,
                    color = Color.Gray,
                    fontSize = 14.sp,
                    fontFamily = FontFamily.SansSerif,
                    fontWeight = FontWeight.Medium
                )
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = TextStyle(
                    color = NeoBlack,
                    fontSize = 14.sp,
                    fontFamily = FontFamily.SansSerif,
                    fontWeight = FontWeight.Bold
                ),
                keyboardOptions = keyboardOptions,
                singleLine = singleLine,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
fun NeoBadge(
    text: String,
    backgroundColor: Color,
    modifier: Modifier = Modifier,
    textColor: Color = NeoBlack
) {
    Box(
        modifier = modifier
            .background(backgroundColor, shape = RectangleShape)
            .border(2.dp, NeoBlack, shape = RectangleShape)
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            text = text.uppercase(),
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace
        )
    }
}

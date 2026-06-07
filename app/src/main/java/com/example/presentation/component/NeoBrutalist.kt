package com.example.presentation.component

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CornerBasedShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.MyApplicationTheme
import com.example.ui.theme.NeoBlack
import com.example.ui.theme.NeoGreen
import com.example.ui.theme.NeoPink
import com.example.ui.theme.NeoWhite
import com.example.ui.theme.NeoYellow

@Composable
fun NeoCard(
    modifier: Modifier = Modifier,
    backgroundColor: Color = NeoWhite,
    shadowColor: Color = NeoBlack,
    shadowOffset: Dp = 6.dp,
    borderWidth: Dp = 3.dp,
    shape: CornerBasedShape = RoundedCornerShape(16.dp),
    content: @Composable BoxScope.() -> Unit
) {
    Box(modifier = modifier) {
        // Shadow (drawn underneath)
        Box(
            modifier = Modifier
                .matchParentSize()
                .offset(x = shadowOffset, y = shadowOffset)
                .background(shadowColor, shape = shape)
                .border(borderWidth, NeoBlack, shape = shape)
        )
        // Content card on top
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(backgroundColor, shape = shape)
                .border(borderWidth, NeoBlack, shape = shape)
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
    shadowOffset: Dp = 5.dp,
    borderWidth: Dp = 3.dp,
    shape: CornerBasedShape = RoundedCornerShape(12.dp),
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit
) {
    var isPressed by remember { mutableStateOf(false) }
    // Animate depth of depression on touch: surface sinks towards the shadow
    val offsetAnimation by animateDpAsState(
        targetValue = if (isPressed) shadowOffset else 0.dp,
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
                .offset(x = shadowOffset, y = shadowOffset)
                .background(shadowColor, shape = shape)
                .border(borderWidth, NeoBlack, shape = shape)
        )
        // Button Surface
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .offset(x = offsetAnimation, y = offsetAnimation)
                .background(if (enabled) backgroundColor else Color.LightGray, shape = shape)
                .border(borderWidth, NeoBlack, shape = shape)
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
    label: String? = null,
    shape: CornerBasedShape = RoundedCornerShape(12.dp)
) {
    var isFocused by remember { mutableStateOf(false) }
    val shadowOffset by animateDpAsState(
        targetValue = if (isFocused) 4.dp else 0.dp,
        label = "neoTextFieldFocus"
    )

    Column(modifier = modifier) {
        if (label != null) {
            // Stylized brutalist label pin with rounded corners
            Box(
                modifier = Modifier
                    .background(NeoYellow, shape = RoundedCornerShape(8.dp))
                    .border(2.dp, NeoBlack, shape = RoundedCornerShape(8.dp))
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

        Box {
            // Expressive Shadow visible only on Focus
            if (shadowOffset > 0.dp) {
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .offset(x = shadowOffset, y = shadowOffset)
                        .background(NeoBlack, shape = shape)
                        .border(3.dp, NeoBlack, shape = shape)
                )
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(NeoWhite, shape = shape)
                    .border(3.dp, NeoBlack, shape = shape)
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
                    modifier = Modifier
                        .fillMaxWidth()
                        .onFocusChanged { isFocused = it.isFocused }
                )
            }
        }
    }
}

@Composable
fun NeoBadge(
    text: String,
    backgroundColor: Color,
    modifier: Modifier = Modifier,
    textColor: Color = NeoBlack,
    shape: CornerBasedShape = RoundedCornerShape(8.dp)
) {
    Box(
        modifier = modifier
            .background(backgroundColor, shape = shape)
            .border(2.dp, NeoBlack, shape = shape)
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

// --- COMPOSE PREVIEWS ---

@Preview(showBackground = true)
@Composable
fun NeoCardPreview() {
    MyApplicationTheme {
        Box(modifier = Modifier.padding(20.dp)) {
            NeoCard {
                Column {
                    Text(
                        text = "Expressive Brutalism",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = NeoBlack
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Rounded corners look soft and modern, combined with sharp dark borders and distinct drop shadows.",
                        fontSize = 12.sp,
                        color = Color.DarkGray
                    )
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
fun NeoButtonPreview() {
    MyApplicationTheme {
        Row(
            modifier = Modifier.padding(20.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            NeoButton(onClick = {}) {
                Text("TAP ME NOW", fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
            }
            NeoButton(onClick = {}, backgroundColor = NeoPink) {
                Text("PINK BUTTON", fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
fun NeoTextFieldPreview() {
    MyApplicationTheme {
        var text by remember { mutableStateOf("") }
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            NeoTextField(
                value = text,
                onValueChange = { text = it },
                placeholder = "Type something expressive...",
                label = "Brutalist Input"
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
fun NeoBadgePreview() {
    MyApplicationTheme {
        Row(
            modifier = Modifier.padding(20.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            NeoBadge(text = "Easy", backgroundColor = NeoGreen)
            NeoBadge(text = "Nightmare", backgroundColor = NeoPink)
        }
    }
}

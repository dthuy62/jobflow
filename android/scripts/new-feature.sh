#!/usr/bin/env bash
# Usage: scripts/new-feature.sh <name> [--mvi]   (name: lowercase, e.g. profile)
# Default is MVVM-lite (level 0 in docs/decisions/0005). --mvi scaffolds MviViewModel with a Contract file.
set -euo pipefail
NAME="${1:?feature name required, e.g. profile}"
STYLE="${2:-}"
[[ "$NAME" =~ ^[a-z][a-z0-9]*$ ]] || { echo "name must be lowercase letters/digits"; exit 1; }
[[ -z "$STYLE" || "$STYLE" == "--mvi" ]] || { echo "unknown option: $STYLE (only --mvi is supported)"; exit 1; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GRADLE="$ROOT/app/build.gradle.kts"
BASE_PKG="$(sed -nE 's/^[[:space:]]*namespace[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' "$GRADLE" | head -n 1)"
[[ -n "$BASE_PKG" ]] || { echo "namespace not found in app/build.gradle.kts"; exit 1; }
SRC="$ROOT/app/src/main/kotlin/${BASE_PKG//.//}"
TEST="$ROOT/app/src/test/kotlin/${BASE_PKG//.//}"
DIR="$SRC/ui/$NAME"
TEST_DIR="$TEST/ui/$NAME"
[[ -e "$DIR" ]] && { echo "ui/$NAME already exists"; exit 1; }
CAP="$(tr '[:lower:]' '[:upper:]' <<< "${NAME:0:1}")${NAME:1}"
PKG="$BASE_PKG.ui.$NAME"
mkdir -p "$DIR" "$TEST_DIR"

cat > "$DIR/${CAP}Route.kt" <<KT
package $PKG

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

@Serializable
data object ${CAP}Route : NavKey
KT

if [[ "$STYLE" == "--mvi" ]]; then
cat > "$DIR/${CAP}Contract.kt" <<KT
package $PKG

import androidx.compose.runtime.Immutable
import $BASE_PKG.core.mvi.UiEffect
import $BASE_PKG.core.mvi.UiIntent
import $BASE_PKG.core.mvi.UiState

@Immutable
data class ${CAP}State(val title: String = "$CAP") : UiState

sealed interface ${CAP}Intent : UiIntent {
    data object Refresh : ${CAP}Intent
}

sealed interface ${CAP}Effect : UiEffect {
    data object Refreshed : ${CAP}Effect
}
KT

cat > "$DIR/${CAP}ViewModel.kt" <<KT
package $PKG

import $BASE_PKG.core.mvi.MviViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

/** MVI: use when state is interdependent, async work needs ordering, or one-shot effects are needed. */
@HiltViewModel
class ${CAP}ViewModel @Inject constructor() : MviViewModel<${CAP}State, ${CAP}Intent, ${CAP}Effect>(${CAP}State()) {
    override fun handleIntent(intent: ${CAP}Intent) {
        when (intent) {
            ${CAP}Intent.Refresh -> sendEffect(${CAP}Effect.Refreshed)
        }
    }
}
KT

cat > "$DIR/${CAP}Screen.kt" <<KT
package $PKG

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun ${CAP}Screen(viewModel: ${CAP}ViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ${CAP}Content(state, onIntent = viewModel::onIntent)
}

@Composable
fun ${CAP}Content(state: ${CAP}State, onIntent: (${CAP}Intent) -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier.fillMaxSize().clickable { onIntent(${CAP}Intent.Refresh) },
        contentAlignment = Alignment.Center,
    ) {
        Text(state.title)
    }
}
KT

cat > "$TEST_DIR/${CAP}ViewModelTest.kt" <<KT
package $PKG

import org.junit.Assert.assertEquals
import org.junit.Test

class ${CAP}ViewModelTest {
    @Test
    fun \`initial state shows the title\`() {
        assertEquals("$CAP", ${CAP}ViewModel().state.value.title)
    }
}
KT
else
cat > "$DIR/${CAP}ViewModel.kt" <<KT
package $PKG

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

@Immutable
data class ${CAP}UiState(val title: String = "$CAP")

/** MVVM-lite by default. Switch to MviViewModel only if the screen needs it (see AGENTS.md). */
@HiltViewModel
class ${CAP}ViewModel @Inject constructor() : ViewModel() {
    private val _uiState = MutableStateFlow(${CAP}UiState())
    val uiState: StateFlow<${CAP}UiState> = _uiState.asStateFlow()
}
KT

cat > "$DIR/${CAP}Screen.kt" <<KT
package $PKG

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun ${CAP}Screen(viewModel: ${CAP}ViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    ${CAP}Content(state)
}

@Composable
fun ${CAP}Content(state: ${CAP}UiState, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(state.title)
    }
}
KT

cat > "$TEST_DIR/${CAP}ViewModelTest.kt" <<KT
package $PKG

import org.junit.Assert.assertEquals
import org.junit.Test

class ${CAP}ViewModelTest {
    @Test
    fun \`initial state shows the title\`() {
        assertEquals("$CAP", ${CAP}ViewModel().uiState.value.title)
    }
}
KT
fi

echo "Created ui/$NAME (${STYLE:---mvvm-lite}) and its test. Next: add entry<${CAP}Route> { ${CAP}Screen() } in navigation/NavGraph.kt"
echo "Long names can wrap differently: run ./gradlew ktlintFormat if ktlintCheck complains."
echo "Need a repository or use case? Inject the domain interface in ${CAP}ViewModel; see docs/decisions/0005 for how much structure to add."

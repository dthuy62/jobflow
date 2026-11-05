package me.dthuy.jobflow.core.common

import androidx.annotation.StringRes

/** What the UI shows for an error: a message resource and the one action the user can take. */
data class UiError(@param:StringRes val message: Int, val action: ErrorAction)

enum class ErrorAction { Retry, SignIn, None }

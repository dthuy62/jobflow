# Add project specific ProGuard rules here.

# Credential Manager finds its Play services provider by name.
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** { *; }

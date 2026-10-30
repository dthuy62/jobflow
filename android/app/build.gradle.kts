plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.androidx.room3)
    alias(libs.plugins.hilt)
    alias(libs.plugins.detekt)
    alias(libs.plugins.ktlint)
}

android {
    namespace = "me.dthuy.jobflow"
    compileSdk = 37

    defaultConfig {
        applicationId = "me.dthuy.jobflow"
        minSdk = 26
        targetSdk = 37
        versionCode = providers.gradleProperty("versionCode").map(String::toInt).orElse(1).get()
        versionName = "0.1.0"
    }

    flavorDimensions += "environment"

    productFlavors {
        create("dev") {
            dimension = "environment"
            applicationIdSuffix = ".dev"
            buildConfigField("String", "CAREER_OPS_ENVIRONMENT", "\"dev\"")
            buildConfigField("String", "CAREER_OPS_DEFAULT_BASE_URL", "\"http://10.0.2.2:3000\"")
        }
        create("prod") {
            dimension = "environment"
            buildConfigField("String", "CAREER_OPS_ENVIRONMENT", "\"prod\"")
            buildConfigField("String", "CAREER_OPS_DEFAULT_BASE_URL", "\"http://10.0.2.2:3000\"")
        }
    }

    // Signing values only come from the environment (CI or a developer shell); without them release stays unsigned.
    val keystorePath = providers.environmentVariable("ANDROID_KEYSTORE_FILE").orNull
    signingConfigs {
        // Shared debug key (decoded from debug.keystore.base64) keeps debug installs updatable across machines.
        create("debugConfig") {
            storeFile = file("$rootDir/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = providers.environmentVariable("ANDROID_KEYSTORE_PASSWORD").get()
                keyAlias = providers.environmentVariable("ANDROID_KEY_ALIAS").get()
                keyPassword = providers.environmentVariable("ANDROID_KEY_PASSWORD").get()
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfigs.findByName("release")?.let { signingConfig = it }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
        debug {
            signingConfig = signingConfigs.getByName("debugConfig")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

room3 {
    schemaDirectory("$projectDir/schemas")
}

// DocsTest reads these files, so editing them must rerun the unit tests instead of reusing an up-to-date result.
tasks.withType<Test>().configureEach {
    inputs.files(
        rootProject.fileTree("docs"),
        rootProject.fileTree(".claude/skills"),
        rootProject.files("README.md", "AGENTS.md"),
    ).withPropertyName("docsInputs").withPathSensitivity(PathSensitivity.RELATIVE)
}

detekt {
    config.setFrom("$rootDir/config/detekt/detekt.yml")
    buildUponDefaultConfig = true
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.viewmodel.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.navigation3)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.core)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.androidx.navigation3.runtime)
    implementation(libs.androidx.navigation3.ui)
    implementation(libs.kotlinx.serialization.core)
    implementation(libs.kotlinx.collections.immutable)
    implementation(libs.kotlinx.coroutines.android)

    implementation(libs.hilt.android)
    implementation(libs.hilt.navigation.compose)
    ksp(libs.hilt.compiler)

    implementation(libs.androidx.room3.runtime)
    ksp(libs.androidx.room3.compiler)
    implementation(libs.androidx.datastore.preferences)

    implementation(libs.timber)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.konsist)
}

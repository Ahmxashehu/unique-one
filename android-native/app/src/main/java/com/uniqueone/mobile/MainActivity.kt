package com.uniqueone.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            notifyJs("mediaAccessResult", mediaAccessGranted().toString())
        }

    private val filePicker =
        registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
            val payload = uris.joinToString(prefix = "[", postfix = "]") { uri -> "\"$uri\"" }
            notifyJs("filesSelected", payload)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = true
            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
            addJavascriptInterface(NativeBridge(), "UniqueNativeStorage")
        }
        setContentView(webView)
        webView.loadUrl("https://unique-one-162s.onrender.com")
    }

    private fun mediaPermissions(): Array<String> =
        if (Build.VERSION.SDK_INT >= 33) arrayOf(
            Manifest.permission.READ_MEDIA_IMAGES,
            Manifest.permission.READ_MEDIA_VIDEO,
            Manifest.permission.READ_MEDIA_AUDIO
        ) else arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)

    private fun mediaAccessGranted(): Boolean =
        mediaPermissions().all { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }

    private fun notifyJs(event: String, value: String) {
        webView.post {
            webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('$event',{detail:$value}));", null)
        }
    }

    inner class NativeBridge {
        @JavascriptInterface fun requestMediaAccess() { permissionLauncher.launch(mediaPermissions()) }
        @JavascriptInterface fun hasMediaAccess(): Boolean = mediaAccessGranted()
        @JavascriptInterface fun openFilePicker() { filePicker.launch(arrayOf("*/*")) }
        @JavascriptInterface fun openStorageSettings() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                startActivity(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                    data = Uri.parse("package:$packageName")
                })
            }
        }
        @JavascriptInterface fun openExternalShare(uri: String) {
            startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                type = "*/*"
                putExtra(Intent.EXTRA_STREAM, Uri.parse(uri))
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }, "Share with"))
        }
    }
}

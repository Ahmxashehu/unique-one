package com.uniqueone.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private val nativeMedia = mutableMapOf<String, Pair<Uri, String>>()
    
    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            val granted = mediaAccessGranted()
            notifyJs("mediaAccessResult", JSONObject().apply {
                put("granted", granted)
                put("items", if (granted) scanMedia() else JSONArray())
            }.toString())
        }

    private val filePicker =
        registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
            notifyJs("filesSelected", JSONArray().apply { uris.forEach { put(it.toString()) } }.toString())
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = true
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    val key = request.url.toString().substringAfter("https://unique.native/media/", "")
                    val record = nativeMedia[key] ?: return super.shouldInterceptRequest(view, request)
                    return try {
                        val stream = contentResolver.openInputStream(record.first) ?: return null
                        WebResourceResponse(record.second, null, stream).apply {
                            responseHeaders = mapOf("Access-Control-Allow-Origin" to "*")
                        }
                    } catch (_: Exception) {
                        null
                    }
                }
            }
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

    private fun scanMedia(): JSONArray {
        nativeMedia.clear()
        val result = JSONArray()
        if (!mediaAccessGranted()) return result
        val sources = listOf(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        )
        val projection = arrayOf(
            MediaStore.MediaColumns._ID,
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.MIME_TYPE,
            MediaStore.MediaColumns.SIZE
        )
        for (source in sources) {
            try {
                contentResolver.query(source, projection, null, null, MediaStore.MediaColumns.DATE_ADDED + " DESC")?.use { cursor ->
                    val idIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
                    val nameIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
                    val mimeIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE)
                    val sizeIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE)
                    var skipped = 0\n                    var added = 0\n                    while (cursor.moveToNext()) {\n                        if (skipped < offset) { skipped++; continue }\n                        if (added >= limit) break\n                        added++
                        val id = cursor.getLong(idIndex)
                        val mime = cursor.getString(mimeIndex) ?: "application/octet-stream"
                        val uri = Uri.withAppendedPath(source, id.toString())
                        val key = source.toString().substringAfterLast("/") + ":" + id
                        nativeMedia[key] = uri to mime
                        result.put(JSONObject().apply {
                            put("id", key)
                            put("name", cursor.getString(nameIndex) ?: "Media")
                            put("mime", mime)
                            put("size", cursor.getLong(sizeIndex))
                            put("url", "https://unique.native/media/$key")
                        })
                    }
                }
            } catch (_: SecurityException) {}
        }
        return result
    }

    private fun notifyJs(event: String, value: String) {
        webView.post { webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('$event',{detail:$value}));", null) }
    }

    inner class NativeBridge {
        @JavascriptInterface fun requestMediaAccess() { permissionLauncher.launch(mediaPermissions()) }
        @JavascriptInterface fun hasMediaAccess(): Boolean = mediaAccessGranted()
        @JavascriptInterface fun listMedia(): String = scanMedia().toString()
        @JavascriptInterface fun refreshMediaIndex(): String { mediaCache = null; return scanMedia().toString() }
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

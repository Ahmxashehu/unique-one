package com.uniqueone.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.provider.OpenableColumns
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

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private val nativeMedia = mutableMapOf<String, Pair<Uri, String>>()
    private val pendingSharedUris = mutableListOf<Uri>()
    private lateinit var nearbyShare: NearbyShareManager

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            val granted = mediaAccessGranted()
            notifyJs("mediaAccessResult", JSONObject().apply {
                put("granted", granted)
                put("items", if (granted) scanMedia() else JSONArray())
            }.toString())
        }

    private val nearbyPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            notifyJs("localSharePermissionResult", JSONObject().apply { put("granted", nearbyShare.hasPermissions()) }.toString())
        }

    private val filePicker =
        registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
            notifyJs("filesSelected", JSONArray().apply { uris.forEach { put(it.toString()) } }.toString())
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        captureSharedIntent(intent)
        nearbyShare = NearbyShareManager(this, ::notifyJsObject, nativeMedia)
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
        webView.loadUrl(if (pendingSharedUris.isNotEmpty()) "https://unique-one-162s.onrender.com/unique-media" else "https://unique-one-162s.onrender.com")
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        pendingSharedUris.clear()
        captureSharedIntent(intent)
        if (pendingSharedUris.isNotEmpty()) {
            webView.post { webView.loadUrl("https://unique-one-162s.onrender.com/unique-media") }
        }
    }

    private fun captureSharedIntent(intent: Intent?) {
        if (intent == null) return
        when (intent.action) {
            Intent.ACTION_SEND -> intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)?.let { pendingSharedUris.add(it) }
            Intent.ACTION_SEND_MULTIPLE -> {
                val items = intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
                items?.let { pendingSharedUris.addAll(it) }
            }
        }
    }

    private fun mediaPermissions(): Array<String> =
        if (Build.VERSION.SDK_INT >= 34) arrayOf(
            Manifest.permission.READ_MEDIA_IMAGES,
            Manifest.permission.READ_MEDIA_VIDEO,
            Manifest.permission.READ_MEDIA_AUDIO,
            Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED
        ) else if (Build.VERSION.SDK_INT >= 33) arrayOf(
            Manifest.permission.READ_MEDIA_IMAGES,
            Manifest.permission.READ_MEDIA_VIDEO,
            Manifest.permission.READ_MEDIA_AUDIO
        ) else arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)

    private fun mediaAccessGranted(): Boolean {
        if (Build.VERSION.SDK_INT < 33) {
            return ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        }
        val image = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED
        val video = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_VIDEO) == PackageManager.PERMISSION_GRANTED
        val audio = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED
        val selected = Build.VERSION.SDK_INT >= 34 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) == PackageManager.PERMISSION_GRANTED
        return image || video || audio || selected
    }

    private fun scanMedia(limit: Int = 100, offset: Int = 0): JSONArray {
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
                    var skipped = 0
                    var added = 0
                    while (cursor.moveToNext()) {
                        if (skipped < offset) {
                            skipped++
                            continue
                        }
                        if (added >= limit) break
                        added++
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

    private fun sharedMediaJson(): JSONArray {
        val result = JSONArray()
        val uris = pendingSharedUris.toList()
        pendingSharedUris.clear()
        uris.forEachIndexed { index, uri ->
            val mime = contentResolver.getType(uri) ?: "application/octet-stream"
            val key = "shared:" + index + ":" + uri.hashCode()
            val name = queryDisplayName(uri) ?: "Shared file"
            val size = querySize(uri)
            nativeMedia[key] = uri to mime
            result.put(JSONObject().apply {
                put("id", key)
                put("name", name)
                put("mime", mime)
                put("size", size)
                put("url", "https://unique.native/media/$key")
            })
        }
        return result
    }

    private fun queryDisplayName(uri: Uri): String? {
        if (uri.scheme != "content") return uri.lastPathSegment
        return try {
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun querySize(uri: Uri): Long {
        if (uri.scheme != "content") return 0L
        return try {
            contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getLong(0) else 0L
            } ?: 0L
        } catch (_: Exception) {
            0L
        }
    }

    private fun notifyJsObject(event: String, value: JSONObject) = notifyJs(event, value.toString())

    private fun notifyJs(event: String, value: String) {
        webView.post {
            webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('$event',{detail:$value}));", null)
        }
    }

    inner class NativeBridge {
        @JavascriptInterface fun requestMediaAccess() { permissionLauncher.launch(mediaPermissions()) }
        @JavascriptInterface fun hasMediaAccess(): Boolean = mediaAccessGranted()
        @JavascriptInterface fun listMedia(): String = scanMedia().toString()
        @JavascriptInterface fun listMediaPage(offset: Int, limit: Int): String = scanMedia(limit, offset).toString()
        @JavascriptInterface fun refreshMediaIndex(): String = scanMedia().toString()
        @JavascriptInterface fun getSharedMedia(): String = sharedMediaJson().toString()
        @JavascriptInterface fun openFilePicker() { filePicker.launch(arrayOf("*/*")) }
        @JavascriptInterface fun openStorageSettings() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                startActivity(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                    data = Uri.parse("package:$packageName")
                })
            }
        }
        @JavascriptInterface fun shareNativeMedia(idsJson: String): Boolean {
            return try {
                val ids = JSONArray(idsJson)
                val uris = ArrayList<Uri>()
                var mime: String? = null
                for (index in 0 until ids.length()) {
                    val key = ids.optString(index)
                    val record = nativeMedia[key] ?: return false
                    uris.add(record.first)
                    val nextMime = record.second
                    mime = when {
                        mime == null -> nextMime
                        mime == nextMime -> mime
                        mime.substringBefore("/") == nextMime.substringBefore("/") -> mime
                        else -> "*/*"
                    }
                }
                if (uris.isEmpty()) return false
                val sendIntent = Intent().apply {
                    action = if (uris.size == 1) Intent.ACTION_SEND else Intent.ACTION_SEND_MULTIPLE
                    type = mime ?: "*/*"
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    if (uris.size == 1) putExtra(Intent.EXTRA_STREAM, uris.first())
                    else putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
                }
                startActivity(Intent.createChooser(sendIntent, "Share with"))
                true
            } catch (_: Exception) {
                false
            }
        }

        @JavascriptInterface fun requestLocalShareAccess() {
            if (nearbyShare.hasPermissions()) { notifyJs("localSharePermissionResult", JSONObject().put("granted", true).toString()); return }
            val permissions = mutableListOf<String>()
            if (Build.VERSION.SDK_INT >= 31) {
                permissions += Manifest.permission.BLUETOOTH_SCAN
                permissions += Manifest.permission.BLUETOOTH_CONNECT
                permissions += Manifest.permission.BLUETOOTH_ADVERTISE
            }
            if (Build.VERSION.SDK_INT >= 33) permissions += Manifest.permission.NEARBY_WIFI_DEVICES
            nearbyPermissionLauncher.launch(permissions.distinct().toTypedArray())
        }
        @JavascriptInterface fun hasLocalShareAccess(): Boolean = nearbyShare.hasPermissions()
        @JavascriptInterface fun startLocalShareAdvertising() = nearbyShare.startAdvertising()
        @JavascriptInterface fun startLocalShareDiscovery() = nearbyShare.startDiscovery()
        @JavascriptInterface fun connectLocalSharePeer(endpointId: String) = nearbyShare.requestConnection(endpointId)
        @JavascriptInterface fun acceptLocalShareConnection(endpointId: String) = nearbyShare.acceptConnection(endpointId)
        @JavascriptInterface fun rejectLocalShareConnection(endpointId: String) = nearbyShare.rejectConnection(endpointId)
        @JavascriptInterface fun stopLocalShare() = nearbyShare.stop()
        @JavascriptInterface fun sendLocalShareMedia(idsJson: String) = nearbyShare.sendMedia(idsJson)

        @JavascriptInterface fun openExternalShare(uri: String) {
            startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                type = "*/*"
                putExtra(Intent.EXTRA_STREAM, Uri.parse(uri))
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }, "Share with"))
        }
    }
}

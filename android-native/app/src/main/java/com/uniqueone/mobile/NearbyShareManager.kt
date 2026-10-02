package com.uniqueone.mobile

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.OpenableColumns
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.DataInputStream
import java.io.FilterInputStream
import java.io.File
import java.io.InputStream
import java.nio.charset.StandardCharsets
import java.util.UUID

class NearbyShareManager(private val context: Context, private val emit: (String, JSONObject) -> Unit, private val nativeMedia: MutableMap<String, Pair<Uri, String>>) {
    private val client = Nearby.getConnectionsClient(context)
    private val strategy = Strategy.P2P_POINT_TO_POINT
    private val serviceId = context.packageName + ".uniqueshare"
    private val discovered = linkedMapOf<String, String>()
    private val connected = linkedSetOf<String>()
    private val outgoing = mutableMapOf<Long, InputStream>()

    private class HeaderInputStream(private val source: InputStream, private val header: ByteArray) : FilterInputStream(source) {
        private var index = 0
        override fun read(): Int {
            if (index < header.size) return header[index++].toInt() and 0xFF
            return source.read()
        }
        override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
            if (index >= header.size) return source.read(buffer, offset, length)
            val count = minOf(length, header.size - index)
            System.arraycopy(header, index, buffer, offset, count)
            index += count
            return count
        }
    }

    private val lifecycle = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            emit("localShareConnectionRequest", JSONObject().apply { put("endpointId", endpointId); put("name", info.endpointName); put("authenticationDigits", info.authenticationDigits) })
        }
        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            if (result.status.isSuccess) {
                connected.add(endpointId)
                emit("localShareConnected", JSONObject().put("endpointId", endpointId))
            } else emit("localShareError", JSONObject().put("message", "Nearby connection failed."))
        }
        override fun onDisconnected(endpointId: String) {
            connected.remove(endpointId)
            emit("localShareDisconnected", JSONObject().put("endpointId", endpointId))
        }
    }

    private val discovery = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            discovered[endpointId] = info.endpointName
            emit("localSharePeerFound", JSONObject().apply { put("endpointId", endpointId); put("name", info.endpointName) })
        }
        override fun onEndpointLost(endpointId: String) {
            discovered.remove(endpointId)
            emit("localSharePeerLost", JSONObject().put("endpointId", endpointId))
        }
    }

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            if (payload.type != Payload.Type.STREAM) return
            val stream = payload.asStream()?.asInputStream() ?: return
            val fileId = UUID.randomUUID().toString()
            val dir = File(context.filesDir, "unique-media-received").apply { mkdirs() }
            try {
                val input = DataInputStream(stream)
                val headerLength = input.readInt()
                if (headerLength !in 1..8192) throw IllegalStateException("Invalid UniqueShare file header.")
                val header = ByteArray(headerLength)
                input.readFully(header)
                val metadata = JSONObject(String(header, StandardCharsets.UTF_8))
                val originalName = metadata.optString("name").ifBlank { "Received-$fileId" }
                val safeName = originalName.replace(Regex("[^A-Za-z0-9._ -]"), "_")
                val mime = metadata.optString("mime").ifBlank { "application/octet-stream" }
                val file = File(dir, fileId + "-" + safeName)
                input.use { source -> file.outputStream().use { output -> source.copyTo(output) } }
                val key = "received:" + file.name
                val contentUri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", file)
                nativeMedia[key] = contentUri to mime
                emit("localShareFileReceived", JSONObject().apply {
                    put("endpointId", endpointId)
                    put("id", key)
                    put("name", safeName)
                    put("size", file.length())
                    put("mime", mime)
                    put("url", "https://unique.native/media/$key")
                    put("isNew", true)
                })
            } catch (error: Exception) {
                emit("localShareError", JSONObject().put("message", error.message ?: "Could not save received file."))
            }
        }
        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
            if (update.status == PayloadTransferUpdate.Status.SUCCESS || update.status == PayloadTransferUpdate.Status.FAILURE || update.status == PayloadTransferUpdate.Status.CANCELED) {
                outgoing.remove(update.payloadId)?.close()
            }
            emit("localShareProgress", JSONObject().apply { put("endpointId", endpointId); put("payloadId", update.payloadId); put("status", update.status); put("bytesTransferred", update.bytesTransferred); put("totalBytes", update.totalBytes) })
        }
    }

    fun hasPermissions(): Boolean {
        if (Build.VERSION.SDK_INT >= 31) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_ADVERTISE) != PackageManager.PERMISSION_GRANTED) return false
        }
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.NEARBY_WIFI_DEVICES) != PackageManager.PERMISSION_GRANTED) return false
        return true
    }

    fun startAdvertising() {
        if (!hasPermissions()) throw SecurityException("Nearby permissions are required.")
        client.startAdvertising("UniquePlatform", serviceId, lifecycle, AdvertisingOptions.Builder().setStrategy(strategy).build())
            .addOnSuccessListener { emit("localShareAdvertising", JSONObject().put("active", true)) }
            .addOnFailureListener { emit("localShareError", JSONObject().put("message", it.message ?: "Could not start local sharing.")) }
    }
    fun startDiscovery() {
        if (!hasPermissions()) throw SecurityException("Nearby permissions are required.")
        client.startDiscovery(serviceId, discovery, DiscoveryOptions.Builder().setStrategy(strategy).build())
            .addOnSuccessListener { emit("localShareDiscovery", JSONObject().put("active", true)) }
            .addOnFailureListener { emit("localShareError", JSONObject().put("message", it.message ?: "Could not discover nearby devices.")) }
    }
    fun requestConnection(endpointId: String) {
        if (!hasPermissions()) throw SecurityException("Nearby permissions are required.")
        client.requestConnection("UniquePlatform", endpointId, lifecycle)
            .addOnFailureListener { emit("localShareError", JSONObject().put("message", it.message ?: "Could not request connection.")) }
    }
    fun acceptConnection(endpointId: String) {
        if (!hasPermissions()) throw SecurityException("Nearby permissions are required.")
        client.acceptConnection(endpointId, payloadCallback)
            .addOnFailureListener { emit("localShareError", JSONObject().put("message", it.message ?: "Could not accept connection.")) }
    }
    fun rejectConnection(endpointId: String) { client.rejectConnection(endpointId) }
    fun stop() {
        client.stopAdvertising(); client.stopDiscovery(); client.stopAllEndpoints()
        outgoing.values.forEach { runCatching { it.close() } }
        outgoing.clear(); connected.clear(); discovered.clear()
        emit("localShareStopped", JSONObject())
    }
    private fun displayName(uri: Uri, fallback: String): String {
        if (uri.scheme != "content") return uri.lastPathSegment ?: fallback
        return try {
            context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) ?: fallback else fallback
            } ?: fallback
        } catch (_: Exception) {
            fallback
        }
    }

    fun sendMedia(idsJson: String) {
        if (!hasPermissions()) throw SecurityException("Nearby permissions are required.")
        val ids = JSONArray(idsJson); val targets = connected.toList()
        if (targets.isEmpty()) throw IllegalStateException("No local UniqueShare peer is connected.")
        for (index in 0 until ids.length()) {
            val key = ids.optString(index); val record = nativeMedia[key] ?: continue
            val stream = context.contentResolver.openInputStream(record.first) ?: throw IllegalStateException("Could not open media.")
            val metadata = JSONObject().apply { put("name", displayName(record.first, key)); put("mime", record.second) }.toString().toByteArray(StandardCharsets.UTF_8)
            val header = java.nio.ByteBuffer.allocate(4).putInt(metadata.size).array()
            val payloadStream = HeaderInputStream(stream, header + metadata)
            val payload = Payload.fromStream(payloadStream)
            outgoing[payload.id] = payloadStream
            client.sendPayload(targets, payload).addOnFailureListener {
                outgoing.remove(payload.id)?.close()
                emit("localShareError", JSONObject().put("message", it.message ?: "Local transfer failed."))
            }
            emit("localShareSending", JSONObject().apply { put("id", key); put("name", key); put("payloadId", payload.id) })
        }
    }
}

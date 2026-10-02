package com.uniqueone.mobile

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.content.ContextCompat
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

class NearbyShareManager(private val context: Context, private val emit: (String, JSONObject) -> Unit, private val nativeMedia: MutableMap<String, Pair<Uri, String>>) {
    private val client = Nearby.getConnectionsClient(context)
    private val strategy = Strategy.P2P_POINT_TO_POINT
    private val serviceId = context.packageName + ".uniqueshare"
    private val discovered = linkedMapOf<String, String>()
    private val connected = linkedSetOf<String>()
    private val outgoing = mutableMapOf<Long, java.io.InputStream>()

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
            val dir = File(context.filesDir, "unique-share-inbox").apply { mkdirs() }
            val file = File(dir, "received-$fileId")
            try {
                stream.use { input -> file.outputStream().use { output -> input.copyTo(output) } }
                val key = "local:$fileId"
                nativeMedia[key] = Uri.fromFile(file) to "application/octet-stream"
                emit("localShareFileReceived", JSONObject().apply { put("endpointId", endpointId); put("id", key); put("name", file.name); put("size", file.length()); put("url", "https://unique.native/media/$key") })
            } catch (error: Exception) {
                file.delete()
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
        client.startAdvertising("Unique One", serviceId, lifecycle, AdvertisingOptions.Builder().setStrategy(strategy).build())
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
        client.requestConnection("Unique One", endpointId, lifecycle)
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
    fun sendMedia(idsJson: String) {
        if (!hasPermissions()) throw SecurityException("Nearby permissions are required.")
        val ids = JSONArray(idsJson); val targets = connected.toList()
        if (targets.isEmpty()) throw IllegalStateException("No local UniqueShare peer is connected.")
        for (index in 0 until ids.length()) {
            val key = ids.optString(index); val record = nativeMedia[key] ?: continue
            val stream = context.contentResolver.openInputStream(record.first) ?: throw IllegalStateException("Could not open media.")
            val payload = Payload.fromStream(stream)
            outgoing[payload.id] = stream
            client.sendPayload(targets, payload).addOnFailureListener {
                outgoing.remove(payload.id)?.close()
                emit("localShareError", JSONObject().put("message", it.message ?: "Local transfer failed."))
            }
            emit("localShareSending", JSONObject().apply { put("id", key); put("name", key); put("payloadId", payload.id) })
        }
    }
}

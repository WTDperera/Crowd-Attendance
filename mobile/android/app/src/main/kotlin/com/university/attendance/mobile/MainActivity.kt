package com.university.attendance.mobile

import android.media.MediaDrm
import android.os.Build
import androidx.annotation.NonNull
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.security.MessageDigest
import java.util.Base64
import java.util.UUID

class MainActivity: FlutterActivity() {
    private val CHANNEL = "com.university.attendance/identity"
    private val WIDEVINE_UUID = UUID.fromString("edef8ba9-79d6-4ace-a3c8-27dcd51d21ed")

    override fun configureFlutterEngine(@NonNull flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler {
            call, result ->
            if (call.method == "getSecureHardwareId") {
                try {
                    val deviceId = getMediaDrmId()
                    if (deviceId != null) {
                        result.success(deviceId)
                    } else {
                        result.error("UNAVAILABLE", "Could not generate Hardware ID", null)
                    }
                } catch (e: Exception) {
                    result.error("ERROR", e.message, null)
                }
            } else {
                result.notImplemented()
            }
        }
    }

    private fun getMediaDrmId(): String? {
        var mediaDrm: MediaDrm? = null
        try {
            mediaDrm = MediaDrm(WIDEVINE_UUID)
            val deviceUniqueId = mediaDrm.getPropertyByteArray(MediaDrm.PROPERTY_DEVICE_UNIQUE_ID)
            
            // Hash with SHA-256 to ensure uniform length and obscure raw ID
            val digest = MessageDigest.getInstance("SHA-256")
            val hash = digest.digest(deviceUniqueId)
            
            // Return as Base64
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Base64.getEncoder().encodeToString(hash)
            } else {
                android.util.Base64.encodeToString(hash, android.util.Base64.NO_WRAP)
            }
        } catch (e: Exception) {
            throw e
        } finally {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                mediaDrm?.close()
            } else {
                mediaDrm?.release()
            }
        }
    }
}

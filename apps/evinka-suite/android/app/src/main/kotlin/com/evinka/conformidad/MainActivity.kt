package com.evinka.conformidad

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "evinka/config"
        ).setMethodCallHandler { call, result ->
            if (call.method != "getConfig") {
                result.notImplemented()
                return@setMethodCallHandler
            }

            val countryCode = try {
                getString(R.string.evinka_country).trim().uppercase()
            } catch (_: Exception) {
                "PE"
            }
            val baseUrl = if (countryCode == "CO") {
                "https://co-suite.evinka.net"
            } else {
                "https://pe-suite.evinka.net"
            }
            val labelRes = applicationInfo.labelRes
            val appName = if (labelRes != 0) {
                getString(labelRes)
            } else {
                applicationInfo.loadLabel(packageManager).toString()
            }

            result.success(
                mapOf(
                    "countryCode" to countryCode,
                    "appName" to appName,
                    "baseUrl" to baseUrl,
                    "advisorInboxUrl" to "https://asesor.evinka.net",
                )
            )
        }
    }
}

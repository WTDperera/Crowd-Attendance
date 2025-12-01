import 'package:flutter/services.dart';

class IdentityService {
  static const platform = MethodChannel('com.university.attendance/identity');

  Future<String?> getSecureHardwareId() async {
    try {
      final String result = await platform.invokeMethod('getSecureHardwareId');
      return result;
    } on PlatformException catch (e) {
      print("Failed to get hardware ID: '${e.message}'.");
      return null;
    }
  }
}

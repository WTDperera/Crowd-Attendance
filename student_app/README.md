# BLE Attendance System - Student App

[![Flutter](https://img.shields.io/badge/Flutter-3.38.3-blue.svg)](https://flutter.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Integrated-orange.svg)](https://firebase.google.com/)
[![BLE](https://img.shields.io/badge/BLE-Peripheral%20Mode-green.svg)](https://www.bluetooth.com/)

## 🎯 Overview

Production-ready **Student Attendance Broadcasting App** using **BLE (Bluetooth Low Energy)** technology with **device-locked security** and **manufacturer data encryption**.

### Key Features

✅ **Secure Device Binding** - One device per student account (hardware-level locking)  
✅ **Manufacturer Data Broadcasting** - Encrypted RegNo transmission using Company ID 0xFFFF  
✅ **Real Firebase Integration** - NO mock data, production Firestore  
✅ **Professional Dark Theme** - Stunning UI with animations  
✅ **Admin-Only Accounts** - No sign-up, IT department manages credentials  

---

## 🔐 Security Architecture

### Device Binding System

Each student account is **permanently locked** to their first login device:

```dart
// First login on Device A
if (storedDeviceId == null) {
  await studentRef.update({
    'device_id': currentDeviceId,  // "cbdfbd4d"
    'device_locked_at': FieldValue.serverTimestamp(),
  });
}

// Attempting login on Device B
if (storedDeviceId != currentDeviceId) {
  throw Exception('Unauthorized Device');  // ❌ Login blocked
}
```

**Device ID Sources:**
- **Android**: `android_id` from hardware
- **iOS**: `identifierForVendor` from iOS APIs

### Manufacturer Data Broadcasting (NEW - SECURE)

**Previous Issue:** Broadcasting RegNo as device `localName` was:
- **Spoofable** - Any BLE app could fake the name
- **Packet overflow** - 31-byte limit reached with UUID + long names

**New Solution:** Manufacturer Data with Company ID 0xFFFF

```dart
// Student App: Encoding
final regNoBytes = utf8.encode("eg/2022/5289"); // [101, 103, 47, ...]
final manufacturerBytes = Uint8List.fromList([
  0xFF, 0xFF,      // Company ID 0xFFFF (unreserved)
  ...regNoBytes,   // UTF-8 encoded registration number
]);

AdvertiseData(
  serviceUuid: 'bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c',
  localName: "SJP",  // Short name saves packet space
  manufacturerData: manufacturerBytes,
);
```

**Why This Is Secure:**
- ❌ Cannot be changed via device settings (unlike local name)
- ✅ Requires programming knowledge to spoof
- ✅ Saves 9+ bytes of packet space
- ✅ Works within BLE advertising packet limits (31 bytes)

**Packet Budget:**
```
Service UUID:          16 bytes
Local Name "SJP":      3 bytes  
Manufacturer Header:    2 bytes (0xFF 0xFF)
RegNo "eg/2022/5289": 12 bytes
─────────────────────────────────
TOTAL:                 33 bytes ✅ (within limit)
```

---

## 📡 BLE Broadcasting

### Broadcast Configuration

```dart
const SERVICE_UUID = 'bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c';

final advertiseData = AdvertiseData(
  serviceUuid: SERVICE_UUID,
  localName: "SJP",
  manufacturerData: Uint8List.fromList([0xFF, 0xFF, ...regNoBytes]),
);

final advertiseSettings = AdvertiseSettings(
  advertiseMode: AdvertiseMode.advertiseModeBalanced,
  txPowerLevel: AdvertiseTxPower.advertiseTxPowerHigh,
  connectable: false,  // One-way broadcast only
  timeout: 0,          // Broadcast until stopped
);
```

### Broadcast Flow

1. **Login** → Device binding verification
2. **Fetch RegNo** → Query Firebase for student registration number
3. **Encode** → Convert RegNo to UTF-8 bytes
4. **Build Packet** → Prefix with 0xFFFF company ID
5. **Broadcast** → Start BLE peripheral advertising
6. **Continuous** → Broadcasts until user stops or logs out

---

## 🗄️ Firebase Firestore Schema

### `students` Collection

```javascript
students/{uid}:
  reg_no: "eg/2022/5289"
  email: "eg20225289@sjp.ac.lk"
  device_id: "cbdfbd4d"  // Locked on first login
  device_locked_at: Timestamp(2024-01-15 08:30:00)
  last_login: Timestamp(2024-01-15 09:00:00)
```

---

## 🎨 Dark Theme UI

- **Background**: `#0A0E21`
- **Cards**: `#1D1E33`
- **Accent**: `#00BCD4` (Cyan)
- **Text**: White with opacity variations

### Animation Features

- 🔵 Pulsing broadcast indicator (scale 1.0 → 1.1)
- 🎞️ Smooth button state transitions
- ✨ Ripple effects on interactions

---

## 📦 Dependencies

```yaml
dependencies:
  flutter: sdk: flutter
  firebase_core: ^3.0.0
  firebase_auth: ^5.0.0
  cloud_firestore: ^5.0.0
  flutter_ble_peripheral: ^2.0.1  # BLE Broadcasting
  permission_handler: ^11.3.0
  device_info_plus: ^10.0.0
```

---

## 🚀 Build Instructions

### Release APK (Production)

```bash
cd student_app
flutter build apk --release
```

**Output:** `build/app/outputs/flutter-apk/app-release.apk` (~46.2 MB)

### Development Build

```bash
flutter run
```

---

## ⚙️ AndroidManifest Permissions

```xml
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

---

## 🧪 Testing Workflow

1. **Create Firebase Account**
   ```javascript
   // Firebase Console → Add Student
   {
     email: "eg20225289@sjp.ac.lk",
     password: "SecurePass123",
     reg_no: "eg/2022/5289",
     device_id: null  // Will lock on first login
   }
   ```

2. **Install APK** on Android device (API 21+)

3. **Login** with credentials → Device gets locked

4. **Start Broadcasting** → Verify console logs:
   ```
   🔵 STUDENT APP: Starting Broadcast
   📋 RegNo: eg/2022/5289
   🔐 Service UUID: bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c
   🔒 Encoding RegNo as manufacturer data:
      Company ID: 0xFFFF (Unreserved)
      Data Bytes: 12 bytes
   ✅ Broadcasting Active!
   ```

5. **Scan with Lecturer App** → Should decrypt and mark attendance

---

## 🔧 Troubleshooting

### Issue: "Unauthorized Device"
**Cause:** Trying to login on a different device  
**Fix:** Contact IT admin to reset `device_id` in Firebase

### Issue: Broadcast fails to start
**Cause:** Missing Bluetooth permissions  
**Fix:** Go to App Settings → Permissions → Enable "Nearby devices"

### Issue: Lecturer app doesn't detect
**Cause:** Wrong Service UUID or no manufacturer data  
**Fix:** Verify UUID matches between apps, check console logs

---

## 📄 License

**Proprietary** - University Internal Use Only  
© 2024 Sri Jayewardenepura University

---

## 👨‍💻 Technical Contact

For Firebase configuration or device binding issues:  
**IT Department** - it@sjp.ac.lk

---

**Version:** 1.0.0 (Production-Ready with Manufacturer Data Security)  
**Build Date:** January 2024  
**Flutter:** 3.38.3 • **Dart:** 3.10.1

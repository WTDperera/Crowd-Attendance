<<<<<<< HEAD
# 📱 BLE Attendance System

A Flutter-based Bluetooth Low Energy (BLE) attendance tracking system with two apps: **Student App** (broadcasts) and **Lecturer App** (scans).

---

## 🎯 What Does This System Do?

This is an **automatic attendance marking system** where:
- Students open their app and it broadcasts their identity via Bluetooth
- Lecturers scan for nearby student devices and automatically mark attendance
- No need for manual roll call or QR code scanning
- Works within classroom Bluetooth range (~10-30 meters)

---

## 🏗️ System Architecture

```
┌─────────────────┐                    ┌─────────────────┐
│   STUDENT APP   │                    │  LECTURER APP   │
│                 │                    │                 │
│ 1. Login        │                    │ 1. Open app     │
│ 2. Broadcast    │──── BLE UUID ────>│ 2. Start Scan   │
│    UUID via BLE │    (over air)     │ 3. Detect UUID  │
│                 │                    │ 4. Decode Hash  │
└─────────────────┘                    └─────────────────┘
         │                                      │
         │ Store hash                           │ Query hash
         ↓                                      ↓
    ┌─────────────────────────────────────────────┐
    │           FIREBASE FIRESTORE                │
    │                                             │
    │  students/{uid}/                            │
    │    ├─ reg_no: "eg245331"                    │
    │    ├─ email: "eg245331@sjp.ac.lk"           │
    │    ├─ device_id: "TP1A.220624.014"          │
    │    └─ device_id_hash: "a1b2c3d4" ← NEW!    │
    └─────────────────────────────────────────────┘
```

---

## 📱 Student App

### Purpose
Broadcast student's unique device identifier via Bluetooth to allow automatic attendance marking.

### Tech Stack
- **Framework:** Flutter 3.10+
- **Language:** Dart
- **BLE Library:** `flutter_ble_peripheral: ^2.0.0` (Broadcaster/Peripheral mode)
- **Backend:** Firebase (Authentication + Firestore)
- **Device Info:** `device_info_plus: ^10.0.0` (Get Android device ID)
- **Permissions:** `permission_handler: ^11.0.1`

### Key Features
1. **Email/Password Authentication** via Firebase Auth
2. **Device Binding** - Each student can only use ONE registered device
3. **UUID Broadcasting** - Converts device ID to custom UUID and broadcasts via BLE
4. **Automatic Hash Generation** - Creates hash of device ID for Firebase lookup

### How It Works
```dart
1. Student logs in with email (e.g., eg245331@sjp.ac.lk)
2. App gets Android device ID (e.g., "TP1A.220624.014")
3. App calculates hash: deviceId.hashCode → "a1b2c3d4"
4. Stores in Firebase: { reg_no, email, device_id, device_id_hash }
5. Encodes hash into UUID: bf27730d-860a-4e09-a1b2-c3d4...
6. Broadcasts UUID via BLE service advertisement
```

### Files
- `lib/main.dart` - Main app code (login, BLE broadcasting, device binding)
- `android/app/google-services.json` - Firebase configuration
- `android/app/src/main/AndroidManifest.xml` - BLE permissions

---

## 👨‍🏫 Lecturer App

### Purpose
Scan for nearby student devices broadcasting BLE UUIDs and verify them against Firebase database.

### Tech Stack
- **Framework:** Flutter 3.10+
- **Language:** Dart
- **BLE Library:** `flutter_blue_plus: ^1.31.0` (Scanner/Central mode)
- **Backend:** Firebase (Firestore queries)
- **Permissions:** `permission_handler: ^11.0.1`

### Key Features
1. **BLE Scanning** - Detects all nearby Bluetooth devices
2. **UUID Filtering** - Only processes UUIDs matching student app format
3. **Hash Decoding** - Extracts device hash from UUID
4. **Firebase Verification** - Queries database by hash to get student details
5. **Duplicate Prevention** - Only queries each device once per scan session

### How It Works
```dart
1. Lecturer taps "Start Scan" button
2. App scans for BLE devices (15 second duration)
3. For each detected UUID:
   - Check if starts with "bf27730d-860a-4e09"
   - Extract hash from UUID (e.g., "a1b2c3d4")
   - Query Firebase: WHERE device_id_hash == "a1b2c3d4"
   - If found: Display student reg_no ✅
   - If not found: Show "Unknown Device" ❌
4. Display list of verified students with RSSI signal strength
```

### Files
- `lib/main.dart` - Main app code (BLE scanning, UUID decoding, Firebase queries)
- `android/app/google-services.json` - Firebase configuration
- `android/app/src/main/AndroidManifest.xml` - BLE permissions

---

## 🔐 Security Features

### Device Binding
- **One device per student** - A student can only register ONE phone
- **Device ID verification** - On every login, app checks if device matches registered one
- **Prevents device sharing** - Can't log in on friend's phone

### Hardware-Based Identity
- Uses Android Build ID (unchangeable without root)
- Hash-based lookup (8-character hex for fast queries)
- UUID transmission over BLE (short-range only)

### Firebase Rules (Recommended)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /students/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 🔧 Technical Details

### UUID Format
```
Base UUID: bf27730d-860a-4e09-XXXX-XXXXXXXXXXXX
                                └─── 16 hex chars (hash + device bytes)
                                     ├─ 8 chars: device_id hash
                                     └─ 8 chars: partial device_id bytes
```

### Hash Calculation
```dart
String deviceId = "TP1A.220624.014";
int hash = deviceId.hashCode;
String hashHex = hash.abs().toRadixString(16).padLeft(8, '0');
// Result: "a1b2c3d4" (example)
```

### Firebase Document Structure
```json
{
  "reg_no": "eg245331",
  "email": "eg245331@sjp.ac.lk",
  "device_id": "TP1A.220624.014",
  "device_id_hash": "a1b2c3d4"
}
```

---

## 📲 Current Status

### ✅ Working
- Student app successfully broadcasts BLE UUID
- Lecturer app successfully scans and detects UUID
- Device binding prevents multiple device usage
- BLE transmission confirmed (RSSI -50 dBm, good signal)

### ⚠️ Needs Attention
- **Firebase hash field missing** for existing students
- Students need to **log out and log back in** to generate hash
- Alternative: Run migration script to add hashes to all existing records

### 🔄 Next Steps
1. Have existing students log out and log back in
2. Or run `update_firebase_hashes.dart` to bulk update
3. Test end-to-end attendance marking
4. Add attendance record saving feature

---

## 🚀 How to Use

### For Students

1. **First Time Setup:**
   - Download and install Student App
   - Log in with your email (e.g., `eg245331@sjp.ac.lk`)
   - App will bind to your device automatically

2. **Daily Use:**
   - Open app (auto-login if already logged in)
   - Tap "Start Broadcasting" button
   - Keep app open during class
   - That's it! Attendance will be marked automatically

### For Lecturers

1. **Before Class:**
   - Open Lecturer App
   - Make sure Bluetooth is ON

2. **Mark Attendance:**
   - Tap "Start Scan" button
   - Wait 15 seconds for scan to complete
   - View list of present students
   - Verified students show ✅ with registration number
   - Unknown devices show ❌

---

## 🛠️ Installation & Setup

### Prerequisites
- Flutter SDK 3.10 or higher
- Android Studio / VS Code
- Firebase project with Firestore enabled
- Two Android phones for testing

### Setup Steps

1. **Clone/Open Project:**
   ```bash
   cd C:\Users\Tharindu\Desktop\MyAttendanceProject
   ```

2. **Install Dependencies:**
   ```bash
   # Student app
   cd student_app
   flutter pub get
   
   # Lecturer app
   cd ../lecturer_app
   flutter pub get
   ```

3. **Configure Firebase:**
   - Download `google-services.json` from Firebase Console
   - Place in `android/app/` for both apps

4. **Run Apps:**
   ```bash
   # Student app on device 1
   cd student_app
   flutter run -d RFCW71690SD
   
   # Lecturer app on device 2
   cd lecturer_app
   flutter run -d cbdfbd4d
   ```

---

## 📊 Testing Devices

- **Student Phone:** Samsung SM F946B (RFCW71690SD) - Android 13
- **Lecturer Phone:** Oppo CPH1937 (cbdfbd4d) - Android 11

---

## 🐛 Troubleshooting

### "Unknown Device" showing instead of student name
**Cause:** Firebase doesn't have `device_id_hash` field  
**Fix:** Student needs to log out and log back in

### Student can't broadcast
**Cause:** Bluetooth permissions not granted  
**Fix:** Go to Settings → Apps → Student App → Permissions → Enable Bluetooth

### Lecturer can't scan
**Cause:** Location permissions not granted (required for BLE scanning on Android)  
**Fix:** Go to Settings → Apps → Lecturer App → Permissions → Enable Location

### "Device already registered to another student"
**Cause:** This phone was previously registered to a different account  
**Fix:** Contact administrator to reset device binding in Firebase

---

## 📝 Future Enhancements

- [ ] Save attendance records to Firestore with timestamp
- [ ] Add date/time selection for attendance sessions
- [ ] Export attendance to CSV/Excel
- [ ] Add student dashboard showing attendance history
- [ ] Implement geofencing (only mark attendance in classroom)
- [ ] Add lecturer authentication
- [ ] Support iOS devices (requires different BLE approach)

---

## 📄 License

This project is for educational purposes.

---

## 👨‍💻 Developer Notes

- BLE advertising works on Android 5.0+ (API 21+)
- BLE scanning requires Location permission on Android 6.0+ (API 23+)
- `flutter_ble_peripheral` doesn't support `localName` broadcast (use `serviceUuid` instead)
- Hash collisions are extremely rare with Dart's `hashCode` for device IDs
- RSSI values: -30 to -60 dBm (good), -60 to -80 dBm (fair), below -80 dBm (weak)

---

**Last Updated:** January 21, 2026  
**Status:** Development - Hash implementation completed, testing in progress
=======
# lecture

A new Flutter project.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Lab: Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Cookbook: Useful Flutter samples](https://docs.flutter.dev/cookbook)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
>>>>>>> d9a000111db9c574c1c4915048a56b78fc3eebec

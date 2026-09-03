# 🚀 Production Lecturer App - Deployment Guide

## ✅ COMPLETED UPGRADE

Your Lecturer App has been completely rebuilt to **production-level standards** with enterprise security features.

---

## 🔐 KEY SECURITY FEATURES IMPLEMENTED

### 1. **Device Locking (UUID Binding)**
- ✅ On first login, the app captures and stores the device's unique ID
- ✅ All subsequent logins verify the device ID matches
- ✅ **Security Rule**: If device ID doesn't match → Login BLOCKED
- ✅ Error message: "Unauthorized Device"

### 2. **Admin-Only Account Creation**
- ✅ **NO SIGN-UP SCREEN** - Registration removed completely
- ✅ Accounts MUST be pre-created in Firebase by admin
- ✅ Login screen shows warning: "Accounts are admin-created"

### 3. **Session-Based Attendance**
- ✅ Dashboard screen after login (not direct scanning)
- ✅ Lecturer must create session first:
  - Module Code (e.g., SE3021)
  - Session Topic (e.g., "Lecture 05 - Design Patterns")
- ✅ Session data saved to Firebase `active_sessions` collection

### 4. **Real BLE Scanner (Zero Mock Data)**
- ✅ **100% Real BLE Scanning** using `flutter_blue_plus`
- ✅ No hardcoded student lists
- ✅ Filters devices by "EG/" prefix (student registration format)
- ✅ Verifies students exist in Firebase `students` collection
- ✅ Only marks verified students as present
- ✅ Real-time attendance updates with RSSI signal strength
- ✅ Prevents duplicate attendance marking

---

## 📁 NEW PROJECT STRUCTURE

```
lecturer_app/
├── lib/
│   ├── main.dart                   # App entry + Auth state management
│   ├── services/
│   │   ├── device_service.dart     # Device ID extraction (Android/iOS)
│   │   ├── auth_service.dart       # Login + Device verification
│   │   └── session_service.dart    # Session creation + Attendance marking
│   └── screens/
│       ├── login_screen.dart       # Secure login (NO sign-up)
│       ├── dashboard_screen.dart   # Session creation UI
│       └── scanner_screen.dart     # Real-time BLE scanner
```

---

## 🎨 PRODUCTION UI THEME

- **Dark Theme** (`#0A0E21` background, `#1D1E33` cards)
- **Cyan/Blue Gradient** accents (`#00BCD4`, `#2196F3`)
- **Modern Material Design 3**
- **Responsive Error Handling** (Snackbars with proper messaging)
- **Loading States** (CircularProgressIndicator during operations)

---

## 🔥 FIREBASE STRUCTURE

### Required Collections:

#### `lecturers/{uid}`
```json
{
  "name": "Dr. John Doe",
  "email": "lecturer@sjp.ac.lk",
  "department": "Computer Science",
  "device_id": "cbdfbd4d",           // ← LOCKED DEVICE ID
  "device_model": "Oppo CPH1937",
  "device_locked_at": Timestamp,
  "last_login": Timestamp
}
```

#### `active_sessions/{sessionId}`
```json
{
  "session_id": "auto-generated-id",
  "lecturer_id": "lecturerUid123",
  "module_code": "SE3021",
  "session_topic": "Lecture 05 - Design Patterns",
  "created_at": Timestamp,
  "started_at": Timestamp,
  "status": "active",                // or "completed"
  "student_count": 25,
  "students_present": ["studentId1", "studentId2", ...]
}
```

#### `attendance_records/{recordId}`
```json
{
  "record_id": "auto-generated-id",
  "session_id": "sessionId456",
  "student_id": "studentUid789",
  "reg_no": "eg2023001",
  "marked_at": Timestamp,
  "rssi": -67,                       // BLE signal strength
  "status": "present"
}
```

#### `students/{uid}` (Must have these fields)
```json
{
  "reg_no": "eg2023001",
  "name": "John Student",
  "email": "eg2023001@sjp.ac.lk"
}
```

---

## 📋 HOW TO CREATE LECTURER ACCOUNTS

### Step 1: Firebase Console
1. Go to **Firebase Console** → **Authentication**
2. Click **Add User**
3. Enter:
   - Email: `lecturer@sjp.ac.lk`
   - Password: `yourSecurePassword123`
4. Copy the **User UID**

### Step 2: Firestore Document
1. Go to **Firestore Database**
2. Create document in `lecturers` collection:
   - **Document ID**: Use the UID from Step 1
   - **Fields**:
     ```
     name: "Dr. Jane Smith"
     email: "lecturer@sjp.ac.lk"
     department: "Computer Science"
     ```
   - **Leave `device_id` empty** - App will fill on first login

### Step 3: First Login
- Lecturer logs in with email/password
- App automatically captures device ID
- Device is now **LOCKED** to that account
- Subsequent logins will only work from this device

---

## 🔧 HOW TO USE THE APP

### 1. Login
- Open app → Enter admin-created email/password
- **First login**: Device ID automatically locked
- **Subsequent logins**: Device verification happens automatically

### 2. Create Session
- Dashboard shows "Create New Session" button
- Fill in:
  - **Module Code**: SE3021
  - **Session Topic**: Lecture 05
- Click **Start Session**

### 3. Scan for Students
- Scanner screen opens automatically
- Real BLE scanning starts
- Students must be broadcasting with "EG/" prefix in device name
- App verifies each student in Firebase
- Real-time list updates showing:
  - Registration number
  - Timestamp of detection
  - RSSI signal strength

### 4. End Session
- Click **End Session** button
- Attendance is permanently saved to Firebase
- Session marked as "completed"

---

## 🛡️ SECURITY FLOW

```
User enters email/password
    ↓
Firebase Auth validates credentials
    ↓
Device Service extracts current device ID
    ↓
Check Firestore: lecturers/{uid}/device_id
    ↓
Is device_id NULL?
    YES → FIRST LOGIN
          ├─ Store current device ID
          ├─ Lock device to account
          └─ Allow login
    NO → SUBSEQUENT LOGIN
         ├─ Compare stored device ID with current
         ├─ Match? → Allow login
         └─ Mismatch? → BLOCK + Sign Out + Error
```

---

## 📱 BLE SCANNING LOGIC

```
Start BLE Scan
    ↓
Listen for advertising devices
    ↓
For each device:
    ├─ Extract device name
    ├─ Check if name starts with "EG/"
    ├─ If NO → Ignore
    └─ If YES:
        ├─ Extract registration number
        ├─ Query Firebase: students WHERE reg_no = extracted
        ├─ Student exists?
        │   ├─ YES:
        │   │   ├─ Check if already marked in this session
        │   │   ├─ If not marked:
        │   │   │   ├─ Create attendance_records document
        │   │   │   ├─ Increment session student_count
        │   │   │   └─ Show success notification
        │   │   └─ If already marked: Skip
        │   └─ NO: Skip (unknown student)
        └─ Continue scanning...
```

---

## ⚙️ REQUIRED PERMISSIONS

### Android (AndroidManifest.xml)
Already configured in your project:
```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

### Runtime Permission Handling
✅ App automatically requests permissions when starting scan
✅ Shows error if permissions denied

---

## 🐛 ERROR HANDLING

All errors are handled with **user-friendly messages**:

| Error Type | User Message |
|------------|-------------|
| Wrong password | "Incorrect password" |
| Account not found | "No account found with this email" |
| Device mismatch | "Unauthorized Device - This account is locked to another device. Contact admin if you need to change devices." |
| Bluetooth off | "Bluetooth not supported on this device" |
| Student not in DB | Student silently skipped (logged to console) |
| Permission denied | "Failed to start scanning: Permission denied" |

---

## 🎯 TESTING CHECKLIST

### ✅ Device Locking Test
1. Create test account: `test@sjp.ac.lk` / `test123`
2. Login on Device A → Should succeed + lock device
3. Try login on Device B → Should FAIL with "Unauthorized Device"

### ✅ Session Creation Test
1. Login successfully
2. Click "Create New Session"
3. Enter: `SE3021` / `Lecture 01`
4. Should navigate to scanner screen

### ✅ BLE Scanner Test
1. Ensure student app is broadcasting (device name: "EG/2023/001")
2. Scanner should detect and verify student
3. Check Firestore for new `attendance_records` document
4. Verify `student_count` incremented in session document

---

## 📦 DEPENDENCIES

```yaml
firebase_core: ^3.0.0
firebase_auth: ^5.0.0
cloud_firestore: ^5.0.0
flutter_blue_plus: ^1.31.0
permission_handler: ^11.3.0
device_info_plus: ^11.0.0  # ← NEW
intl: ^0.19.0
```

---

## 🚀 DEPLOYMENT

### Release Build (APK)
```bash
cd lecturer_app
flutter build apk --release
```
APK location: `build/app/outputs/flutter-apk/app-release.apk`

### Install on Device
```bash
flutter install
```

---

## 🔐 ADMIN TASKS

### Change Device for Lecturer
1. Firebase Console → Firestore
2. Navigate to `lecturers/{uid}`
3. Delete the `device_id` field
4. Lecturer can now login from new device
5. New device will be locked automatically

### View Attendance Data
1. Firebase Console → Firestore
2. `active_sessions` → Select session
3. Check `student_count` field
4. View `attendance_records` collection filtered by `session_id`

---

## 🎉 PRODUCTION-READY FEATURES

✅ Device-locked authentication
✅ Admin-only account creation
✅ Real BLE scanning (zero mock data)
✅ Session-based attendance system
✅ Real-time Firebase sync
✅ Professional dark theme UI
✅ Comprehensive error handling
✅ Loading states on all async operations
✅ Proper permission management
✅ Duplicate attendance prevention
✅ RSSI signal strength tracking
✅ Scalable Firebase structure
✅ Material Design 3 compliance

---

## 🆘 TROUBLESHOOTING

**Issue**: "Unauthorized Device" on first login
- **Solution**: Check if `device_id` field exists in Firestore. Delete it if present.

**Issue**: No students detected
- **Solution**: Verify student app is broadcasting with "EG/" prefix in device name.

**Issue**: Bluetooth permission denied
- **Solution**: Grant Bluetooth and Location permissions in device settings.

**Issue**: Student marked but not in Firebase
- **Solution**: Check `students` collection has documents with correct `reg_no` field.

---

## 📞 SUPPORT

For device unlocking or account issues, admin should:
1. Access Firebase Console
2. Modify/delete `device_id` field in `lecturers` collection
3. Notify lecturer to re-login

---

**App Version**: 2.0.0 (Production)  
**Security Level**: Enterprise  
**Last Updated**: February 10, 2026

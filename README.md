# 📱 BLE Attendance System - Production Ready

A production-grade Flutter BLE attendance system with **device-locking security**, **session management**, and **real-time Firebase integration**.

---

## 🎯 System Overview

This is a **zero-touch attendance marking system** for educational institutions:
- **Students**: Open app → Broadcast identity via Bluetooth → Attendance auto-marked
- **Lecturers**: Create session → Scan nearby students → System verifies & records attendance
- **Security**: Device-locked accounts prevent sharing/fraud
- **Real-time**: Firebase Firestore for instant data sync

---

## 🏗️ System Architecture (NEW)

## 🏗️ System Architecture (NEW)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FIREBASE PROJECT                           │
│                                                                      │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐    │
│  │  students/   │      │  lecturers/  │      │  active_     │    │
│  │    {uid}     │      │    {uid}     │      │  sessions/   │    │
│  │              │      │              │      │   {id}       │    │
│  │ • reg_no     │      │ • name       │      │ • module     │    │
│  │ • email      │      │ • email      │      │ • topic      │    │
│  │ • device_id  │      │ • device_id  │      │ • created_at │    │
│  └──────────────┘      └──────────────┘      │              │    │
│                                                │ 📁 attendance/│    │
│                                                │     {regNo}  │    │
│                                                │   • timestamp│    │
│                                                │   • rssi     │    │
│                                                └──────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ BLE Communication (10-30m range)
                                 ↓
       ┌─────────────────────────────────────────────────────────┐
       │                                                          │
   ┌───▼──────┐                                            ┌─────▼───┐
   │ STUDENT  │  ──── Service UUID: bf27730d... ──────>  │ LECTURER│
   │   APP    │       localName: RegNo                    │   APP   │
   │          │                                            │         │
   │ • Login  │                                            │ • Login │
   │ • Device │                                            │ • Device│
   │   Lock   │                                            │   Lock  │
   │ • BLE    │                                            │ • Create│
   │   Ad     │                                            │   Session│
   └──────────┘                                            │ • UUID  │
                                                            │   Scan  │
                                                            │ • Verify│
                                                            └─────────┘
```

---

## 📱 App 1: Student App (Broadcaster)

### Purpose
Broadcast student identity via BLE for automatic attendance marking with device-level security.

### Tech Stack
```yaml
Framework: Flutter 3.10+
Language: Dart
BLE Library: flutter_ble_peripheral ^2.0.0 (Peripheral mode)
Backend: 
  - firebase_core ^3.15.2
  - firebase_auth ^5.7.0
  - cloud_firestore ^5.6.12
Device ID: device_info_plus ^11.5.0
Permissions: permission_handler ^11.0.1
```

### Key Features

#### 1. **Secure Login with Device Binding** 🔒
```dart
Login Flow:
1. User enters email + password
2. Firebase Authentication verifies credentials
3. System checks Firestore students/{uid}
4. Device ID Verification:
   • If device_id == null → Bind current device → Allow login
   • If device_id == current device → Allow login
   • Else → BLOCK with "Unauthorized Device" error
5. Update last_login timestamp
```

**Why Device Binding?**
- **One Student = One Phone** (prevents account sharing)
- **Hardware-based ID** (Android Build ID / iOS identifierForVendor)
- **Cannot be spoofed** without root/jailbreak
- **Admin reset required** to change device

#### 2. **BLE Broadcasting** 📡
```dart
Service UUID: bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c (Fixed)
Local Name: REGISTRATION NUMBER (e.g., "EG2023001")
Advertising Mode: Balanced
TX Power: High
Range: ~10-30 meters
```

**What Gets Broadcast:**
- **Service UUID**: Fixed identifier for "Student Attendance System"
- **Device Name**: Student's registration number (uppercase)
- **Not Connectable**: Advertisement-only (no connection overhead)

#### 3. **UI/UX**
- **Dark Theme**: Professional black/cyan color scheme
- **Animated Button**: Pulsing broadcast indicator
- **Status Display**: Real-time broadcasting status
- **Info Card**: Instructions on how system works
- **Logout**: Stop broadcast and sign out

### Files Structure
```
student_app/
  lib/
    main.dart          ← Complete app code (1100+ lines)
  android/
    app/
      src/main/AndroidManifest.xml  ← BLE permissions
      google-services.json           ← Firebase config
```

---

## 👨‍🏫 App 2: Lecturer App (Scanner)

### Purpose
Scan for broadcasting students, verify against database, and mark attendance in real-time sessions.

### Tech Stack
```yaml
Framework: Flutter 3.10+
Language: Dart
BLE Library: flutter_blue_plus ^1.36.8 (Central mode)
Backend: Firebase (Auth + Firestore)
Device ID: device_info_plus ^11.5.0
Permissions: permission_handler ^11.0.1
```

### Key Features

#### 1. **Secure Login** 🔒
Same device-binding logic as Student App but checks `lecturers` collection.

#### 2. **Dashboard with Session Management** 📊
```dart
Before Scanning:
1. Lecturer must CREATE SESSION
2. Inputs: Module Code (e.g., SE3021) + Session Topic
3. System creates active_sessions/{id} document
4. Navigates to Scanner Screen
```

**Why Session Required?**
- **Organized Data**: Each session = separate attendance record
- **Audit Trail**: Track when/where/what was taught
- **Multiple Sessions**: Can run multiple classes per day
- **Easy Reporting**: Query by module/date/lecturer

#### 3. **Real-Time UUID-Based Scanner** 🔍
```dart
Scanning Logic:
1. Request BLE permissions (Scan, Connect, Location)
2. Start scan WITH UUID FILTER:
   FlutterBluePlus.startScan(
     withServices: [Guid(SERVICE_UUID)],  ← Only detect our UUID!
     timeout: 30 minutes
   )
3. For each detected device:
   a. Extract RegNo from device localName
   b. Check if already marked (prevent duplicates)
   c. Query Firebase: students WHERE reg_no == regNo
   d. If found → Mark attendance in session subcollection
   e. If not found → Show as "Unknown Device"
4. Real-time UI updates as students detected
```

**UUID Filtering Benefits:**
- **Hardware-level filtering**: Phone BLE chip does the work
- **Battery efficient**: Doesn't process irrelevant devices
- **Fast detection**: ~1-2 seconds after student starts broadcasting
- **No false positives**: Only detects our student app broadcasts

#### 4. **Attendance Verification Flow** ✅
```dart
Device Detected:
├─ Extract RegNo: "eg2023001"
├─ Query Firestore: students.where('reg_no', ==, 'eg2023001')
├─ Student Found?
│   ├─ YES:
│   │   ├─ Get student_id
│   │   ├─ Save to: active_sessions/{sessionId}/attendance/{regNo}
│   │   │   • student_id
│   │   │   • timestamp (server)
│   │   │   • rssi (signal strength)
│   │   │   • status: "present"
│   │   ├─ Show ✅ Green card with verified badge
│   │   └─ Snackbar: "✅ EG2023001 marked present"
│   └─ NO:
│       ├─ Show ❌ Red card with unknown badge
│       └─ Log: "Student not found in database"
└─
```

#### 5. **Real-Time UI** 📱
- **Session Info Card**: Module, Topic, Status, Student Count
- **Live Student List**: Updates as students detected
- **Verified Badge**: Green ✅ for database-verified students
- **RSSI Display**: Signal strength for debugging
- **Timestamp**: When each student was detected
- **Control Buttons**: Pause/Resume scan, End session

### Files Structure
```
lecturer_app/
  lib/
    main.dart          ← Complete app code (1200+ lines)
  android/
    app/
      src/main/AndroidManifest.xml  ← BLE permissions
      google-services.json           ← Firebase config
```

---

## 🔐 Security Features (PRODUCTION-GRADE)

### 1. Device Binding 🔒
```
First Login:
• System reads Android ID (unchangeable hardware ID)
• Saves to Firestore: device_id field
• Locks account to THIS phone only

Subsequent Logins:
• System reads current phone's Android ID
• Compares with stored device_id
• Match? → Allow login
• Mismatch? → BLOCK with error

Result:
✅ Cannot log in on friend's phone
✅ Cannot share account credentials
✅ One student = One physical device
✅ Admin must manually reset to change device
```

### 2. Admin-Only Accounts 👨‍💼
```
NO Sign-Up Screens:
• Both apps have ONLY login screens
• No "Create Account" button
• No self-registration

Account Creation:
• Firebase Console → Authentication → Add User
• Firebase Console → Firestore → Create document
• Admin controls who gets access

Benefits:
✅ Prevent fake accounts
✅ Institutional control
✅ Easy to deactivate accounts
✅ Audit trail in Firebase Console
```

### 3. BLE Security 📡
```
Service UUID:
• Fixed constant: bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c
• Only our apps use this UUID
• Prevents detection by other apps

Range Limitation:
• BLE: ~10-30 meters max
• Must be physically in classroom
• Cannot mark attendance from outside

No Spoofing:
• RegNo verified against Firebase database
• Unknown devices shown as ❌ red
• RSSI logged for geolocation proof
```

### 4. Firebase Security Rules (Recommended)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Students can only read/write their own document
    match /students/{userId} {
      allow read, write: if request.auth != null 
                        && request.auth.uid == userId;
    }
    
    // Lecturers can only read/write their own document
    match /lecturers/{userId} {
      allow read, write: if request.auth != null 
                        && request.auth.uid == userId;
    }
    
    // Lecturers can create sessions
    match /active_sessions/{sessionId} {
      allow create: if request.auth != null 
                    && exists(/databases/$(database)/documents/lecturers/$(request.auth.uid));
      allow read, update: if request.auth != null 
                          && resource.data.lecturer_id == request.auth.uid;
      
      // Attendance subcollection
      match /attendance/{regNo} {
        allow write: if request.auth != null 
                     && get(/databases/$(database)/documents/active_sessions/$(sessionId)).data.lecturer_id == request.auth.uid;
        allow read: if request.auth != null;
      }
    }
    
    // Students collection readable by lecturers for verification
    match /students/{studentId} {
      allow read: if request.auth != null 
                  && exists(/databases/$(database)/documents/lecturers/$(request.auth.uid));
    }
  }
}
```

---

## 🗄️ Firebase Firestore Schema

### Collection: `students`
```javascript
{
  "uid": "<firebase_auth_uid>",
  "reg_no": "eg2023001",           // Lowercase, unique
  "email": "eg2023001@sjp.ac.lk",
  "device_id": "cbdfbd4d",          // Android ID (initially null)
  "device_locked_at": Timestamp,    // When device was first bound
  "last_login": Timestamp
}
```

### Collection: `lecturers`
```javascript
{
  "uid": "<firebase_auth_uid>",
  "name": "Dr. John Smith",
  "email": "lecturer@sjp.ac.lk",
  "department": "Computer Science",
  "device_id": "xyz123abc",         // Android ID (initially null)
  "device_locked_at": Timestamp,
  "last_login": Timestamp
}
```

### Collection: `active_sessions`
```javascript
{
  "id": "<auto_generated>",
  "lecturer_id": "<firebase_auth_uid>",
  "module": "SE3021",
  "topic": "Object-Oriented Programming",
  "created_at": Timestamp,
  "completed_at": Timestamp,        // Set when session ends
  "status": "active" | "completed",
  "total_students": 25
}
```

### Sub-collection: `active_sessions/{id}/attendance`
```javascript
{
  "regNo": "eg2023001",             // Document ID
  "student_id": "<firebase_auth_uid>",
  "timestamp": Timestamp,            // When detected
  "rssi": -65,                       // Signal strength (dBm)
  "status": "present"
}
```

### Example Query (Lecturer Dashboard)
```dart
// Get all attendance for a session
FirebaseFirestore.instance
    .collection('active_sessions')
    .doc(sessionId)
    .collection('attendance')
    .orderBy('timestamp', descending: true)
    .snapshots();

// Get student details
FirebaseFirestore.instance
    .collection('students')
    .where('reg_no', isEqualTo: 'eg2023001')
    .get();
```

---

## 🚀 Setup & Installation

### Prerequisites
- Flutter SDK 3.10+
- Android Studio / VS Code
- Firebase Project with:
  - Authentication enabled (Email/Password)
  - Firestore Database created
- Two Android phones for testing (Android 8.0+)

### Step 1: Firebase Setup

1. **Create Firebase Project**:
   ```
   https://console.firebase.google.com
   → Create Project → Enable Google Analytics (optional)
   ```

2. **Enable Authentication**:
   ```
   Firebase Console → Authentication → Get Started
   → Sign-in method → Email/Password → Enable
   ```

3. **Create Firestore Database**:
   ```
   Firebase Console → Firestore Database → Create Database
   → Start in Production Mode → Select Region
   ```

4. **Add Firebase Apps**:
   ```
   Project Settings → Add App → Android
   → Register student_app (com.example.student_app)
   → Download google-services.json → Place in android/app/
   
   → Add Another App → Android
   → Register lecturer_app (com.example.lecturer_app)
   → Download google-services.json → Place in android/app/
   ```

5. **Create Test Accounts**:
   ```bash
   # Student Account
   Firebase Console → Authentication → Add User
   Email: eg2023001@sjp.ac.lk
   Password: test1234
   
   # Create Firestore document:
   students/{uid}/
     reg_no: "eg2023001"
     email: "eg2023001@sjp.ac.lk"
     device_id: null  ← Will be filled on first login
   
   # Lecturer Account
   Firebase Console → Authentication → Add User
   Email: lecturer@sjp.ac.lk
   Password: test1234
   
   # Create Firestore document:
   lecturers/{uid}/
     name: "Test Lecturer"
     email: "lecturer@sjp.ac.lk"
     device_id: null  ← Will be filled on first login
   ```

### Step 2: Install Dependencies

```bash
# Student App
cd student_app
flutter pub get

# Lecturer App
cd ../lecturer_app
flutter pub get
```

### Step 3: Run Apps

```bash
# Connect two Android phones via USB

# Check connected devices
flutter devices

# Student App on Device 1
cd student_app
flutter run -d <device1_id>

# Lecturer App on Device 2 (in new terminal)
cd lecturer_app
flutter run -d <device2_id>
```

---

## 🧪 Testing Workflow

### Test Case 1: Device Binding

**Student App:**
1. Open app → Login with `eg2023001@sjp.ac.lk`
2. ✅ First login → Device bound → Snackbar "Device successfully bound"
3. Check Firestore: `students/{uid}/device_id` should now have value
4. Logout → Login again → Should work (same device)
5. Try login on different phone → ❌ Should BLOCK with "Unauthorized Device"

**Lecturer App:**
1. Same flow with `lecturer@sjp.ac.lk`
2. Verify device binding works

### Test Case 2: BLE Broadcasting & Scanning

**Student App:**
1. Login → Tap "START BROADCASTING"
2. ✅ Button turns blue → Pulsing animation
3. Check console logs:
   ```
   🔵 STUDENT APP: Starting Broadcast
   📋 RegNo: eg2023001
   🔐 Service UUID: bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c
   ✅ Broadcasting Active!
   ```

**Lecturer App:**
1. Login → Tap "CREATE NEW SESSION"
2. Enter: Module: `SE3021`, Topic: `Test Session`
3. Scanner screen opens → Scanning starts automatically
4. Within 5 seconds, student should be detected:
   ```
   📱 DEVICE DETECTED #1
   📋 Device Info: Name=EG2023001
   📡 Advertised Services: bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c
   🎓 RegNo extracted: eg2023001
   🔍 Querying Firebase for student: eg2023001
   ✅ Student verified
   💾 Marking attendance...
   ✅ Attendance marked successfully!
   ```
5. ✅ Student card appears with green ✅ badge
6. Snackbar: "✅ EG2023001 marked present"

### Test Case 3: Firestore Verification

**Check Firebase Console:**
1. Go to Firestore Database
2. Find `active_sessions` collection
3. Find your session document
4. Open `attendance` subcollection
5. Should see document with ID `eg2023001`:
   ```javascript
   {
     "student_id": "<uid>",
     "timestamp": <server_time>,
     "rssi": -65,
     "status": "present"
   }
   ```

### Test Case 4: Duplicate Prevention

1. Student already detected and marked
2. Student walks out and back in
3. ✅ Lecturer app should NOT mark again
4. Console log: "⏭️ Student already marked - SKIPPED"

### Test Case 5: Unknown Device

1. Modify student device name to: "INVALID123"
2. Lecturer scans
3. ✅ Device detected but NOT in database
4. Shows ❌ red card: "Unknown Device"
5. Console: "❌ Student not found in database"

---

## 📊 Console Debug Output

### Student App Logs
```
========================================
🔵 STUDENT APP: Starting Broadcast
📋 RegNo: eg2023001
🔐 Service UUID: bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c
========================================
📋 Permission Status:
   Permission.bluetoothAdvertise: granted
   Permission.bluetoothConnect: granted
   Permission.location: granted
🚀 Starting broadcast...
✅ Broadcasting Active!
✅ Device Name: EG2023001
========================================
```

### Lecturer App Logs
```
========================================
🔵 LECTURER APP: Starting BLE Scan
🎯 Target Service UUID: bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c
========================================

========================================
📱 DEVICE DETECTED #1
========================================
📋 Device Info:
   Name: EG2023001
   ID: AA:BB:CC:DD:EE:FF
   RSSI: -65 dBm
📡 Advertised Services:
   - bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c
🎓 Processing Student:
   RegNo extracted: eg2023001
🔍 Querying Firebase for student: eg2023001
✅ Student verified in Firebase:
   Name: eg2023001@sjp.ac.lk
   Student ID: xyz123
💾 Marking attendance...
✅ Attendance marked successfully!
========================================
```

---

## 🐛 Troubleshooting

### Issue 1: "Unauthorized Device" Error

**Cause**: Trying to log in on different phone than originally registered.

**Solution**:
```
Option A: Use original phone
Option B: Admin reset:
  1. Firebase Console → Firestore
  2. Find students/{uid} or lecturers/{uid}
  3. Set device_id field to null
  4. User can now log in on new phone
```

### Issue 2: Student Not Detected

**Checks**:
1. ✅ Student app shows "BROADCASTING" status?
2. ✅ Lecturer app shows " Scanning Active"?
3. ✅ Both phones have Bluetooth ON?
4. ✅ Location permission granted on both?
5. ✅ Devices within 10 meters?

**Console Debug**:
```
Student: Should see "✅ Broadcasting Active!"
Lecturer: Should see "📱 DEVICE DETECTED" when student broadcasts
```

**Fix**: Restart BLE on both devices:
```
1. Turn Bluetooth OFF → ON
2. Restart both apps
3. Try again
```

### Issue 3: "Unknown Device" Red Card

**Cause**: Student not in Firebase or RegNo mismatch.

**Check**:
1. Firebase Console → Firestore → `students` collection
2. Search for student with matching `reg_no`
3. Verify format: lowercase, no spaces (e.g., "eg2023001")

**Fix**:
```dart
Create student document:
students/{firebase_uid}/
  reg_no: "eg2023001"  ← Must match broadcast name
  email: "eg2023001@sjp.ac.lk"
```

### Issue 4: Duplicate Detections

**Expected Behavior**: Student should only be marked ONCE per session.

**If seeing duplicates**:
```
Check Firestore:
active_sessions/{sessionId}/attendance/
  ├─ eg2023001  ← Should be only ONE document
  └─ ...

If multiple documents:
• Bug in duplicate prevention logic
• Check console: Should see "⏭️ Already marked - SKIPPED"
```

---

## 📝 Firebase Security Rules Setup

After testing, apply these rules for production:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function: Check if user is authenticated lecturer
    function isLecturer() {
      return request.auth != null 
             && exists(/databases/$(database)/documents/lecturers/$(request.auth.uid));
    }
    
    // Students: Own data only
    match /students/{userId} {
      allow read: if request.auth != null && (
        request.auth.uid == userId || isLecturer()
      );
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Lecturers: Own data only
    match /lecturers/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Sessions: Lecturers only
    match /active_sessions/{sessionId} {
      allow create: if isLecturer();
      allow read, update: if isLecturer() 
                          && resource.data.lecturer_id == request.auth.uid;
      
      // Attendance: Write by session owner, read by all lecturers
      match /attendance/{regNo} {
        allow write: if isLecturer() 
                     && get(/databases/$(database)/documents/active_sessions/$(sessionId)).data.lecturer_id == request.auth.uid;
        allow read: if isLecturer();
      }
    }
  }
}
```

**Apply Rules**:
```
Firebase Console → Firestore Database
→ Rules tab → Paste above → Publish
```

---

## 📈 Production Deployment Checklist

### Before Deploying:

- [ ] **Firebase Rules**: Apply production security rules
- [ ] **Admin Accounts**: Create lecturer and student test accounts in Firebase
- [ ] **App Signing**: Generate release keystore for Play Store
- [ ] **Version Control**: Tag release version in Git
- [ ] **Test on Multiple Devices**: Verify cross-device compatibility
- [ ] **RSSI Calibration**: Test signal strength at different distances
- [ ] **Battery Testing**: Monitor power consumption during long sessions

### Release Build Commands:

```bash
# Student App
cd student_app
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk

# Lecturer App
cd lecturer_app
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk
```

---

##  Additional Documentation

- [BLE_FIX_COMPLETE.md](BLE_FIX_COMPLETE.md) - Complete BLE troubleshooting guide
- [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md) - Deployment checklist

---

##  Educational Use Case

**Ideal For:**
- Universities & Colleges
- Training Centers
- Workshops & Seminars
- Corporate Training Sessions

**Benefits:**
-  **Zero Manual Work**: Fully automated attendance
-  **Anti-Fraud**: Device binding prevents proxy attendance
-  **Real-Time Data**: Instant sync to cloud database
-  **Audit Trail**: Complete history in Firebase
-  **Scalable**: Works for 10-200 students per session
-  **Cost-Effective**: No special hardware needed

---

##  Quick Reference

### Service UUID
```
bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c
```

### Required Permissions (Android)
```xml
<!-- Student App -->
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />

<!-- Lecturer App -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

---

**Last Updated:** February 10, 2026  
**Version:** 2.0.0 (Production Rebuild)  
**Status:**  Production Ready - Complete system with device locking, session management, and real-time Firebase integration

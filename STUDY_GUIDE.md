# 📚 BLE Attendance System — Study Guide for Evaluation
**Project Name:** Crowd Attendance System  
**Developer:** Tharindu  
**Date:** February 28, 2026  
**Tech Stack:** Flutter (Dart), Firebase, Bluetooth Low Energy (BLE)

---

## 🧠 WHAT IS THIS PROJECT? (The Big Picture)

This is an **automated attendance marking system** for universities.  
Instead of a lecturer calling out names or students signing a paper:

1. **Students** open the app → Their phone automatically broadcasts their identity via Bluetooth
2. **Lecturer** opens their app → Starts a session → Phone scans for nearby Bluetooth signals
3. **Attendance is marked automatically** in Firebase (the cloud database) in real-time
4. **Admin** can view everything from a web browser dashboard

> Think of it like this: every student's phone is broadcasting "Hey, I'm EG2023001 and I'm here!"  
> The lecturer's phone is listening, and when it hears that signal, it marks that student present.

---

## 🏗️ SYSTEM ARCHITECTURE (3 Parts)

```
┌─────────────────────────────────────────────────────┐
│               FIREBASE (Cloud Database)              │
│  Stores: Students, Lecturers, Sessions, Attendance   │
└────────────────┬────────────────────────────────────┘
                 │  Real-time sync (Internet)
       ┌─────────┴──────────┐──────────────┐
       │                    │              │
 ┌─────▼─────┐       ┌──────▼─────┐  ┌────▼──────┐
 │ STUDENT   │  BLE  │ LECTURER   │  │  WEB APP  │
 │   APP     │──────▶│   APP      │  │  (Admin)  │
 │ (Android) │       │ (Android)  │  │ (Browser) │
 └───────────┘       └────────────┘  └───────────┘
```

### Three Apps Built:
| App | Platform | Who Uses It | Purpose |
|-----|----------|-------------|---------|
| Student App | Android | Students | Broadcasts BLE signal with reg number |
| Lecturer App | Android | Lecturers | Scans BLE, creates sessions, marks attendance |
| Web App | Any Browser | Admin/Lecturer | Dashboard to view/manage all data |

---

## 📱 APP 1: STUDENT APP — Detailed Explanation

### What the student does:
1. Open app
2. Log in with their university email & password
3. Tap "START BROADCASTING"
4. That's it — stay in the room!

### What happens behind the scenes:

#### Step 1: Login with Device Binding (Security Feature!)
```
Student enters email + password
       ↓
Firebase Authentication checks credentials
       ↓
App fetches student's Firestore document
       ↓
Checks: Has this student used the app before?
  → First time? → Record this phone's Device ID → Allow login
  → Same phone? → Allow login
  → Different phone? → BLOCKED! "Unauthorized Device"
```

**Why device binding?**  
To prevent **proxy attendance** — a student can't give their login to a friend on another phone. The system physically locks the account to ONE phone.

**What is a Device ID?**  
A unique hardware identifier built into every Android phone (called "Android ID"). It's like a fingerprint for the phone.

#### Step 2: BLE Broadcasting
When student taps "START BROADCASTING":
```
App starts Bluetooth Low Energy advertisement:
  ├── Service UUID: bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c  (fixed identifier)
  └── Device Name: "EG2023001"  (student's reg number)
```

The phone is now constantly broadcasting this signal in all directions (up to 30 meters).  
It's like a radio station transmitting: "I am EG2023001, and I'm near you!"

**BLE Library used:** `flutter_ble_peripheral` — makes the phone act as a Bluetooth advertiser.

---

## 👨‍🏫 APP 2: LECTURER APP — Detailed Explanation

### What the lecturer does:
1. Log in (same device-binding security)
2. Tap "CREATE NEW SESSION"
3. Enter: Module Code (e.g., SE3021) + Topic (e.g., "Object Oriented Programming")
4. Session screen opens → Scanning starts automatically
5. Students appear on screen as they are detected!

### Behind the scenes:

#### Step 1: Creating a Session
When lecturer taps "Create Session":
```dart
// Creates this document in Firebase Firestore:
active_sessions/{auto-generated-id}/ {
  lecturer_id: "firebase-uid-of-lecturer",
  module_code: "SE3021",
  session_topic: "Object Oriented Programming",
  created_at: [current timestamp],
  status: "active",
  student_count: 0
}
```

#### Step 2: BLE Scanning with UUID Filter
```
Lecturer app starts BLE scan:
  └── Filter: Only detect devices broadcasting UUID bf27730d-...

Why filter by UUID?
  → Only picks up our student app broadcasts
  → Ignores your neighbor's earbuds, smartwatch, car, etc.
  → Battery efficient (phone hardware does the filtering)
```

#### Step 3: Processing Each Detected Student
```
Student device detected:
  ├── Extract reg number from device name: "EG2023001" → "eg2023001"
  ├── Validate format: must start with "eg"
  ├── Check: Was this student already marked? → If yes, SKIP
  ├── Query Firebase: Find student where reg_no == "eg2023001"
  │     ├── Found? → Mark attendance ✅
  │     └── Not found? → Show as unknown device ❌
  └── Update session: student_count + 1
```

#### Step 4: Attendance Record Saved
```dart
// Saved to Firebase attendance_records collection:
{
  session_id: "xyz123",
  student_id: "firebase-uid",
  reg_no: "eg2023001",
  marked_at: [timestamp],
  rssi: -65,        // Signal strength (how close they are)
  status: "present"
}
```

**BLE Library used:** `flutter_blue_plus` — makes the phone act as a Bluetooth scanner/central.

---

## 🌐 APP 3: WEB ADMIN DASHBOARD — Detailed Explanation

Built with **Flutter Web** — the same Flutter code runs in a browser!

### Who uses it:
Lecturers / Admins — to oversee the whole system from a computer.

### 4 Sections:

#### 1. Dashboard (Home Page)
Shows 4 stats cards:
- Total Students registered
- Total Lecturers registered  
- Total Sessions ever held
- Currently Active Sessions (live BLE sessions happening right now)

Also shows: Active sessions list + Recent sessions list (real-time, auto-updates!)

#### 2. Sessions Page
- View ALL sessions ever created
- Filter: All / Active / Completed
- Search by module code or topic
- Click any session → see full attendance list
- Admin can END a live session or DELETE a session

#### 3. Students Page
- View all registered students
- See if device is LOCKED or FREE for each student
- Admin can RESET a student's device lock (if they got a new phone)
- Add new student (with their Firebase UID + reg number + email)
- Delete student

#### 4. Lecturers Page
- Same as students but for lecturers
- View device lock status
- Reset device lock
- Add / Delete lecturers

---

## 🗄️ FIREBASE DATABASE STRUCTURE

Firebase Firestore is a NoSQL cloud database. Data is stored in Collections → Documents.

### Collection: `students`
```
students/
  {firebase-uid}/
    reg_no: "eg2023001"
    email: "eg2023001@sjp.ac.lk"
    device_id: "a3b4c5d6"         ← Android ID, null on first login
    device_model: "Samsung Galaxy"
    device_locked_at: [timestamp]
    last_login: [timestamp]
```

### Collection: `lecturers`
```
lecturers/
  {firebase-uid}/
    name: "Dr. Perera"
    email: "perera@sjp.ac.lk"
    department: "Computer Science"
    device_id: "x1y2z3w4"
    last_login: [timestamp]
```

### Collection: `active_sessions`
```
active_sessions/
  {auto-id}/
    lecturer_id: "firebase-uid"
    module_code: "SE3021"
    session_topic: "OOP Concepts"
    created_at: [timestamp]
    ended_at: [timestamp]          ← Set when session ends
    status: "active" or "completed"
    student_count: 25
```

### Collection: `attendance_records`
```
attendance_records/
  {auto-id}/
    session_id: "abc123"
    student_id: "firebase-uid"
    reg_no: "eg2023001"
    marked_at: [timestamp]
    rssi: -65                  ← Signal strength in dBm (closer = higher value)
    status: "present"
```

---

## 🔐 SECURITY FEATURES — Very Important!

### 1. Device Binding (Anti-Fraud)
```
Problem: Student A tells Student B their password → Student B logs in from home = fake attendance
Solution: Account locked to ONE specific phone hardware
Result: Even with the password, a different phone = BLOCKED
```

### 2. No Self-Registration
```
Problem: Anyone could create a fake account
Solution: Both apps have ONLY a Login screen (no Sign Up button)
Account creation: Only through Firebase Console by the admin
```

### 3. UUID Filtering
```
Problem: Lecturer's phone picks up random Bluetooth devices
Solution: Only devices broadcasting our specific Service UUID are processed
UUID: bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c
```

### 4. Physical Presence Required
```
Problem: Student sends BLE signal from outside the room
Solution: BLE range is only 10-30 meters → Must be physically in the classroom
RSSI logged → Can see approximate distance from signal strength
```

### 5. Duplicate Prevention
```
Problem: Same student marked twice in one session
Solution: Before marking, check if student already exists in attendance_records for this session
If exists → SKIP
```

---

## 💻 TECHNOLOGIES USED

### Flutter & Dart
- **Flutter**: Google's UI framework for building apps from one codebase
- **Dart**: Programming language used by Flutter
- One codebase → runs on Android (student, lecturer apps) and Web (admin dashboard)

### Firebase Services
| Service | What it does in this project |
|---------|------------------------------|
| Firebase Authentication | Login/logout with email & password |
| Cloud Firestore | Real-time database (students, sessions, attendance) |
| Firebase Core | Initializes the Firebase connection in the app |

### BLE Libraries
| Library | Used In | Role |
|---------|---------|------|
| `flutter_ble_peripheral` | Student App | Makes phone broadcast BLE advertisements |
| `flutter_blue_plus` | Lecturer App | Makes phone scan for BLE advertisements |

### Other Libraries
| Library | Purpose |
|---------|---------|
| `device_info_plus` | Read the phone's unique hardware ID (for device binding) |
| `permission_handler` | Request Bluetooth and Location permissions at runtime |
| `intl` | Format dates and times (e.g., "Feb 28, 2026 10:30 AM") |

---

## 🔄 FULL FLOW — From Start to Finish

```
1. Admin creates Firebase accounts for students & lecturers
   (Firebase Console → Authentication → Add User)

2. Admin creates Firestore documents for each student & lecturer
   (Or uses Web App → Students/Lecturers page → Add)

3. Student opens Student App → Logs in for first time
   → Device ID is recorded and locked to their phone

4. Lecturer opens Lecturer App → Logs in → Creates a Session
   → Enters "SE3021" + "OOP Week 3"
   → Scanner screen opens automatically

5. Students walk into the classroom
   → Each student taps "START BROADCASTING"
   → Their phones start advertising BLE signals

6. Lecturer's phone detects each student's signal
   → Verifies student exists in Firebase database
   → Records attendance: session_id + student_id + timestamp + RSSI

7. Lecturer can see real-time list of who is present
   → Green card = verified student
   → Red card = unknown device (not in database)

8. End of class → Lecturer taps "End Session"
   → Session status changes to "completed"

9. Lecturer/Admin views reports on Web App
   → Session detail page shows full list of attendees
   → RSSI values show signal strength history
```

---

## 📂 PROJECT FILE STRUCTURE

```
MyAttendanceProject/
├── student_app/           ← Flutter app for students
│   └── lib/
│       └── main.dart      ← Entire student app (login + BLE broadcast)
│
├── lecturer_app/          ← Flutter app for lecturers
│   └── lib/
│       ├── main.dart      ← App entry point
│       ├── screens/
│       │   ├── login_screen.dart      ← Login UI
│       │   ├── dashboard_screen.dart  ← Create session UI
│       │   ├── scanner_screen.dart    ← BLE scan + live attendance
│       │   ├── reports_screen.dart    ← View past sessions
│       │   └── ...
│       └── services/
│           ├── auth_service.dart    ← Firebase login + device check
│           ├── session_service.dart ← Create/end sessions
│           └── device_service.dart  ← Read phone hardware ID
│
└── web_app/               ← Flutter Web admin dashboard
    └── lib/
        ├── main.dart                    ← App entry + Firebase init
        ├── firebase_options.dart        ← Firebase config
        ├── models/                      ← Data classes
        │   ├── student_model.dart
        │   ├── lecturer_model.dart
        │   ├── session_model.dart
        │   └── attendance_model.dart
        ├── services/
        │   ├── auth_service.dart        ← Login/logout
        │   └── firestore_service.dart   ← All database operations
        └── screens/
            ├── login_screen.dart
            ├── main_shell.dart          ← Sidebar layout
            ├── dashboard_screen.dart
            ├── sessions_screen.dart
            ├── session_detail_screen.dart
            ├── students_screen.dart
            └── lecturers_screen.dart
```

---

## ❓ LIKELY EVALUATION QUESTIONS & ANSWERS

**Q: Why did you use BLE instead of WiFi or QR codes?**  
A: BLE requires physical proximity (10-30m), making it impossible to mark attendance remotely. WiFi doesn't prove location. QR codes can be photographed and shared. BLE is passive — students don't need to do anything except have the app open.

**Q: What is the Service UUID and why is it important?**  
A: `bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c` — It's a unique identifier we assigned to our system. The lecturer's app ONLY listens for devices advertising this specific UUID. This means it ignores all other Bluetooth devices (earbuds, mice, etc.) and only picks up our student app broadcasts.

**Q: How does device binding prevent proxy attendance?**  
A: When a student logs in for the first time, the app reads the phone's Android hardware ID and saves it to Firebase. Next time they log in, the app checks: does the current phone's ID match what's stored? If someone else's phone = different ID = login blocked. The account is tied to physical hardware.

**Q: What happens if a student gets a new phone?**  
A: An admin must manually reset their device lock. In the web dashboard, go to Students page → find the student → click the orange phone icon → confirm reset. Now the device_id field in Firebase becomes null, and the student can log in on their new phone.

**Q: How does real-time work in the web dashboard?**  
A: Flutter uses Firestore's `.snapshots()` method combined with `StreamBuilder` widget. Firestore pushes updates to the app instantly when data changes — no polling required. So when a student is marked present on a lecturer's phone, the web dashboard updates within 1-2 seconds automatically.

**Q: What is RSSI?**  
A: Received Signal Strength Indicator — measured in dBm (negative numbers). The closer the student is, the higher (less negative) the RSSI. Example: -50 dBm = very close (2-3 meters), -80 dBm = far (20+ meters). This gives a rough proximity estimate and is logged as proof of physical presence.

**Q: Why can't the web app access BLE?**  
A: Web browsers don't support BLE peripheral advertising (needed for student broadcast) and the Web Bluetooth API for scanning is limited. The web app serves a different purpose — admin management, not BLE operations.

**Q: What is Flutter Web and how does it work?**  
A: Flutter compiles Dart code to JavaScript that runs in the browser. The same widgets and UI components used in mobile apps work in the browser. Firebase libraries also have web implementations. So the web app shares the same architecture as the mobile apps.

**Q: How are attendance records prevented from duplicating?**  
A: Before marking a student, the system queries `attendance_records` where `session_id == currentSession AND student_id == detectedStudent`. If any record exists, it skips marking. A student can only appear once per session.

**Q: What if Bluetooth is off on a student's phone?**  
A: The student app requests Bluetooth and Location permissions at startup. If Bluetooth is off, the broadcast cannot start. The UI shows an error and the student must turn on Bluetooth to broadcast.

**Q: How is data organized in Firestore (NoSQL)?**  
A: Firestore uses Collections (like tables) containing Documents (like rows). Each document has fields (like columns). Unlike SQL, there's no fixed schema — documents in the same collection can have different fields. The app uses 4 main collections: students, lecturers, active_sessions, attendance_records.

**Q: How does the web app login work?**  
A: It uses Firebase Authentication. The web app checks if the logged-in user has a document in the `lecturers` collection. If not, they are signed out immediately with "Access denied." This means only lecturers (not students) can access the admin dashboard.

---

## 🎯 KEY CONCEPTS TO MEMORIZE

| Concept | One-Line Explanation |
|---------|----------------------|
| BLE Peripheral | A device that broadcasts BLE advertisements (Student App) |
| BLE Central | A device that scans for BLE advertisements (Lecturer App) |
| Service UUID | Unique identifier for our BLE service |
| Device Binding | Locking an account to one specific phone |
| Firebase Auth | Cloud service for email/password login |
| Firestore | Real-time NoSQL cloud database by Google |
| StreamBuilder | Flutter widget that rebuilds UI when data stream updates |
| RSSI | Signal strength in dBm — proxy for physical distance |
| Flutter Web | Flutter framework compiled to run in a browser |
| `flutter_blue_plus` | BLE scanning library (central/scanner role) |
| `flutter_ble_peripheral` | BLE advertising library (peripheral/broadcaster role) |

---

## 🚀 HOW TO RUN THE PROJECT

### Student App (Android):
```bash
cd student_app
flutter pub get
flutter run -d <device_id>
```

### Lecturer App (Android):
```bash
cd lecturer_app
flutter pub get
flutter run -d <device_id>
```

### Web App (Browser):
```bash
cd web_app
flutter pub get
flutter run -d chrome
```

### Build APKs:
```bash
# Student
cd student_app && flutter build apk --release

# Lecturer
cd lecturer_app && flutter build apk --release
```

---

## ✅ WHAT WAS COMPLETED IN THIS PROJECT

- [x] Student App — Login with device binding + BLE broadcast
- [x] Lecturer App — Login + Create session + Real-time BLE scanning + Mark attendance
- [x] Firebase Authentication integration (both apps)
- [x] Firestore database integration with real-time sync
- [x] Device-binding security across both apps
- [x] UUID-filtered BLE scanning (no false positives)
- [x] Duplicate attendance prevention
- [x] Web Admin Dashboard — Login, Dashboard, Sessions, Students, Lecturers
- [x] Session management from web (view, end, delete)
- [x] Device lock reset from web admin
- [x] Full Git version control on GitHub (branch: tharindu)

---

*Good luck with your evaluation today! You built this — you know it.* 💪

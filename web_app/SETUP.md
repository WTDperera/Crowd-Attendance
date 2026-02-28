# BLE Attendance System - Web Admin Dashboard

A Flutter Web admin dashboard for managing the BLE Attendance System.

## Features

- **Dashboard** - Real-time stats: total students, lecturers, sessions, active sessions
- **Sessions** - Browse all attendance sessions with filter (Active / Completed)
- **Session Detail** - Full attendance roster per session with RSSI data
- **Students** - Manage student accounts, view device lock status, reset devices
- **Lecturers** - Manage lecturer accounts, view device lock status, reset devices

## Setup Instructions

### Step 1: Register a Web App in Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (`crowed-attendence`)
3. Project Settings → Add App → **Web (</> icon)**
4. Register with name: `BLE Attendance Web`
5. Copy the **App ID** (format: `1:759737487813:web:XXXXXXXXXXXX`)

### Step 2: Update `firebase_options.dart`

Open `lib/firebase_options.dart` and replace the placeholder in the `appId` field:

```dart
static const FirebaseOptions web = FirebaseOptions(
  apiKey: 'AIzaSyAd_24B0qFIudKtgLAhxzCihkFZDowcY_k',
  appId: '1:759737487813:web:YOUR_ACTUAL_WEB_APP_ID',  // ← Replace this
  ...
);
```

### Step 3: Install Dependencies

```bash
cd web_app
flutter pub get
```

### Step 4: Run in Browser

```bash
flutter run -d chrome
```

### Step 5: Build for Production

```bash
flutter build web
# Output → build/web/
```

Deploy the `build/web/` folder to Firebase Hosting, Netlify, Vercel, or any static host.

## Login

Log in with any **lecturer** account from your Firebase Auth.  
> Only lecturer accounts can access the admin dashboard.

## Firebase Collections Used

| Collection | Description |
|---|---|
| `students` | Student profiles & device locks |
| `lecturers` | Lecturer profiles & device locks |
| `active_sessions` | Attendance sessions created by lecturers |
| `attendance_records` | Individual attendance records per session |

## Project ID

`crowed-attendence`

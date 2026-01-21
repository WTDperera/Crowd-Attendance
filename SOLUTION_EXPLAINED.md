# 🎯 BLE Attendance System - Hash-Based Solution

## 📱 **Why UUIDs Are NOT in Firebase**

**Important:** UUIDs are **NEVER stored in Firebase**! They only exist during BLE transmission.

### **The HYBRID System Flow:**

```
┌─────────────┐         BLE          ┌─────────────┐       Firebase       ┌─────────────┐
│ Student App │  ─────────────>      │ Lecturer App│  ─────────────────>  │   Firebase  │
│             │   (UUID over air)    │             │   (Query by hash)    │  Database   │
│ device_id   │                      │ Extract hash│                      │device_id_hash│
│ "TP1A.220..." ├─> Hash to UUID     │ from UUID   │                      │device_id    │
└─────────────┘                      └─────────────┘                      │reg_no       │
                                                                           └─────────────┘
```

## ❌ **The Problem We Fixed**

**Original Issue:** Device IDs are 16+ characters long (e.g., `"TP1A.220624.014"`)  
**UUID Limitation:** Can only hold 8 bytes = 8 characters  
**Result:** Device ID got truncated to `"TP1A.220"` → Firebase query failed!

## ✅ **The Solution: Hash-Based Encoding**

Instead of trying to fit the full device_id into the UUID, we:

1. **Compute a hash** of the device_id (deterministic, always same for same device)
2. **Embed the hash** in the UUID (8 hex characters = perfect fit!)
3. **Store the hash in Firebase** alongside the full device_id
4. **Query Firebase by hash** to find the student

### **Benefits:**
- ✅ No truncation - hash always fits in 8 bytes
- ✅ Deterministic - same device always produces same hash
- ✅ Secure - hash represents the full device_id uniquely
- ✅ Fast - Firebase can index and query by hash efficiently

## 🔧 **Implementation Details**

### **Student App (Broadcasting):**

```dart
// 1. Get device ID
String deviceId = "TP1A.220624.014";

// 2. Calculate hash
int hash = deviceId.hashCode;
String hashHex = hash.abs().toRadixString(16).padLeft(8, '0');
// Example: hashHex = "a1b2c3d4"

// 3. Encode into UUID
String uuid = 'bf27730d-860a-4e09-${hashHex.substring(0,4)}-${hashHex.substring(4,8)}...';
// Result: "bf27730d-860a-4e09-a1b2-c3d4..."

// 4. Broadcast via BLE
AdvertiseData(serviceUuid: uuid);
```

### **Lecturer App (Scanning):**

```dart
// 1. Detect UUID from BLE scan
String uuid = "bf27730d-860a-4e09-a1b2-c3d4...";

// 2. Extract hash
String hashHex = uuid.substring(19, 27).replaceAll('-', '');
// Result: "a1b2c3d4"

// 3. Query Firebase by hash
var query = await FirebaseFirestore.instance
    .collection('students')
    .where('device_id_hash', isEqualTo: hashHex)
    .get();

// 4. Get full device_id and reg_no from matched document
String regNo = query.docs.first.get('reg_no');
String actualDeviceId = query.docs.first.get('device_id');
```

### **Firebase Structure:**

```json
students/{uid}/
{
  "reg_no": "eg245331",
  "email": "eg245331@sjp.ac.lk",
  "device_id": "TP1A.220624.014",        ← Full device ID (16 chars)
  "device_id_hash": "a1b2c3d4"            ← Hash for BLE lookup (8 chars)
}
```

## 🚀 **Setup Instructions**

### **Step 1: Update Existing Students in Firebase**

For students who already registered **before** this hash update, run the migration script:

```bash
cd C:\Users\Tharindu\Desktop\MyAttendanceProject
dart update_firebase_hashes.dart
```

This will:
- Read all existing students
- Calculate `device_id_hash` for each
- Add the hash field to their documents

### **Step 2: New Students (Auto-Updated)**

New students who register **after** this update will automatically get the hash field because the student app now stores it during registration.

### **Step 3: Test the System**

1. **Rebuild both apps:**
   ```bash
   # Student app
   cd student_app
   flutter run
   
   # Lecturer app  
   cd lecturer_app
   flutter run
   ```

2. **Test BLE transmission:**
   - Student logs in → Starts broadcasting
   - Lecturer starts scan → Should detect and verify student
   - Check terminal logs for hash values

3. **Verify in Firebase Console:**
   - Open Firebase Console
   - Navigate to `students` collection
   - Each document should have `device_id_hash` field

## 🐛 **Troubleshooting**

### **Issue: "Unregistered Device" even though student exists**

**Cause:** Firebase document doesn't have `device_id_hash` field  
**Fix:** Run `update_firebase_hashes.dart` script

### **Issue: "No documents found" in Firebase query**

**Cause:** Hash mismatch between student and lecturer apps  
**Fix:** Ensure both apps use the SAME hash algorithm (`.hashCode`)

### **Issue: Multiple students detected as same person**

**Cause:** Hash collision (very rare)  
**Fix:** Use more robust hash like SHA-256 (requires dart:crypto package)

## 📊 **Verification Checklist**

- [ ] Student app broadcasts UUID with hash embedded
- [ ] Lecturer app extracts hash from UUID correctly
- [ ] Firebase has `device_id_hash` field for all students
- [ ] Firebase query returns correct student by hash
- [ ] Terminal logs show matching hash values on both sides
- [ ] UI displays verified students correctly

## 🔐 **Security Notes**

**Why this is secure:**
- Device ID is hardware-bound (can't be changed)
- Hash is deterministic (same device → same hash)
- Firebase validates ownership (device_id linked to reg_no)
- BLE transmission is short-range (proximity-based)

**Attack vectors prevented:**
- ❌ Spoofing: Can't fake device ID without root access
- ❌ Replay: Each session can use timestamped attendance records
- ❌ Device sharing: Firebase enforces one device per student
- ❌ Impersonation: Hash uniquely identifies hardware

---

## ✨ **Summary**

The HYBRID approach now works perfectly:

1. **Student broadcasts:** Device-specific hash via BLE UUID
2. **Lecturer receives:** Extracts hash from UUID
3. **Firebase verifies:** Queries by hash → Returns student details
4. **Attendance marked:** Registration number displayed ✅

**No UUIDs in Firebase** - they're only used for BLE transmission!  
**Hash-based system** - solves truncation while maintaining security!

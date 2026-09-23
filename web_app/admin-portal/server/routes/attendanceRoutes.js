const express = require('express');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const { requireLecturer } = verifyFirebaseToken;
const { db } = require('../firebaseAdmin');

const router = express.Router();

const mapTimestamp = (value) => {
  if (!value || typeof value.toDate !== 'function') {
    return null;
  }

  return value.toDate().toISOString();
};

const normalizeModule = (doc) => {
  const data = doc.data();

  return {
    id: doc.id,
    module_id: data.module_id || doc.id,
    module_code: data.code || data.module_code || data.module_id || doc.id || '',
    module_name: data.name || data.module_name || '',
    department: data.department || '',
    level: data.level || '',
    semester: data.semester || '',
    lecturer_id: data.lecturer_id || '',
    total_sessions: data.total_sessions || 0,
    session_dates: Array.isArray(data.session_dates)
      ? data.session_dates.map((v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v)).filter(Boolean)
      : [],
  };
};

const normalizeRecord = (doc, fallbackStatus) => {
  const data = doc.data();
  return {
    id: doc.id,
    date: data.date || null,
    session_id: data.session_id || null,
    status: data.status || fallbackStatus,
    timestamp: mapTimestamp(data.timestamp) || mapTimestamp(data.marked_at),
  };
};

const buildRecordKey = (record) => {
  return record.session_id || record.date || record.id;
};

const fetchStudentRecords = async (collectionName, moduleId, uid, studentFields, fallbackStatus) => {
  const records = [];

  for (const field of studentFields) {
    const snapshot = await db
      .collection(collectionName)
      .where('module_id', '==', moduleId)
      .where(field, '==', uid)
      .get();

    snapshot.docs.forEach((doc) => {
      records.push(normalizeRecord(doc, fallbackStatus));
    });
  }

  return records;
};

const ENROLL_FIELD = 'enrolled_module_ids';

// Simple test route to verify mounting
router.get('/test', (req, res) => {
  return res.json({ message: 'Attendance route working' });
});

// Export route - expects query params: moduleId, optional startDate, endDate
router.get('/export', verifyFirebaseToken,
  requireLecturer, async (req, res) => {
  const { moduleId, startDate, endDate } = req.query;

  try {
    if (!moduleId) {
      return res.status(400).json({ message: 'Module ID is required.' });
    }

    // Get module details
    let moduleDoc = await db.collection('modules').doc(moduleId).get();
    if (!moduleDoc.exists) {
      const moduleQuery = await db
        .collection('modules')
        .where('module_id', '==', moduleId)
        .limit(1)
        .get();
      moduleDoc = moduleQuery.docs[0];
    }

    if (!moduleDoc || !moduleDoc.exists) {
      return res.status(404).json({ message: 'Module not found.' });
    }

    const moduleData = normalizeModule(moduleDoc);

    // Get all enrolled students
    const studentSnapshot = await db
      .collection('students')
      .where(ENROLL_FIELD, 'array-contains', moduleId)
      .get();

    const students = studentSnapshot.docs.map((doc) => ({
      uid: doc.id,
      reg_no: doc.data().reg_no || '',
      name: doc.data().name || '',
      email: doc.data().email || '',
    }));

    // Fetch attendance records for all students
    const attendanceRecordsMap = new Map();

    for (const student of students) {
      const studentFields = ['student_uid', 'student_id'];

      const presentRecords = [
        ...(await fetchStudentRecords('attendance_records', moduleId, student.uid, studentFields, 'Present')),
        ...(await fetchStudentRecords('attendance_record', moduleId, student.uid, studentFields, 'Present')),
      ];

      const absentRecords = [
        ...(await fetchStudentRecords('absence_records', moduleId, student.uid, studentFields, 'Absent')),
        ...(await fetchStudentRecords('absence_record', moduleId, student.uid, studentFields, 'Absent')),
      ];

      const merged = new Map();

      presentRecords.forEach((record) => {
        merged.set(buildRecordKey(record), record);
      });

      absentRecords.forEach((record) => {
        const key = buildRecordKey(record);
        if (!merged.has(key)) {
          merged.set(key, record);
        }
      });

      const records = Array.from(merged.values());

      // Filter by date range if provided
      let filteredRecords = records;
      if (startDate || endDate) {
        filteredRecords = records.filter((record) => {
          const recordDate = record.timestamp ? new Date(record.timestamp) : new Date(record.date);
          if (startDate && recordDate < new Date(startDate)) return false;
          if (endDate && recordDate > new Date(endDate)) return false;
          return true;
        });
      }

      filteredRecords.forEach((record) => {
        attendanceRecordsMap.set(`${student.uid}_${buildRecordKey(record)}`, {
          student_uid: student.uid,
          student_reg_no: student.reg_no,
          student_name: student.name,
          ...record,
        });
      });
    }

    const attendanceRecords = Array.from(attendanceRecordsMap.values());

    return res.json({
      module: moduleData,
      students,
      attendance_records: attendanceRecords,
    });
  } catch (error) {
    console.error('Error exporting attendance:', error);
    return res
      .status(500)
      .json({ message: 'Unable to export attendance records right now.' });
  }
});

module.exports = router;
const express = require('express');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const { db } = require('../firebaseAdmin');

const router = express.Router();
const ENROLL_FIELD = 'enrolled_module_ids';

const mapSessionDate = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  return value;
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
      ? data.session_dates.map(mapSessionDate).filter(Boolean)
      : [],
  };
};

const mapTimestamp = (value) => {
  if (!value || typeof value.toDate !== 'function') {
    return null;
  }

  return value.toDate().toISOString();
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

const sortByTimestampDesc = (records) => {
  return records.sort((a, b) => {
    const aValue = a.timestamp ? Date.parse(a.timestamp) : Date.parse(a.date || '') || 0;
    const bValue = b.timestamp ? Date.parse(b.timestamp) : Date.parse(b.date || '') || 0;
    return bValue - aValue;
  });
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

router.get('/modules', verifyFirebaseToken, async (req, res) => {
  try {
    const snapshot = await db.collection('modules').get();
    const modules = snapshot.docs.map((doc) => normalizeModule(doc));

    return res.json({ modules });
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Unable to fetch modules right now.' });
  }
});

router.get(
  '/modules/:moduleId/attendance-summary',
  verifyFirebaseToken,
  async (req, res) => {
    const { moduleId } = req.params;

    try {
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
      const studentSnapshot = await db
        .collection('students')
        .where(ENROLL_FIELD, 'array-contains', moduleId)
        .get();

      const students = studentSnapshot.docs.map((doc) => {
        const data = doc.data();
        const attendanceCounts = data.attendance_counts || {};
        const presentCount = Number(attendanceCounts[moduleId] || 0);

        return {
          uid: doc.id,
          reg_no: data.reg_no || '',
          email: data.email || '',
          present_count: presentCount,
        };
      });

      const activeSessionSnapshot = await db
        .collection('active_sessions')
        .where('module_id', '==', moduleId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      const activeSessionDoc = activeSessionSnapshot.docs[0];
      const activeSession = activeSessionDoc
        ? {
            id: activeSessionDoc.id,
            topic:
              activeSessionDoc.data().topic ||
              activeSessionDoc.data().session_topic ||
              '',
            started_at: mapTimestamp(activeSessionDoc.data().started_at),
            student_count: activeSessionDoc.data().student_count || 0,
            students_present: activeSessionDoc.data().students_present || [],
          }
        : null;

      return res.json({
        module: moduleData,
        activeSession,
        students,
      });
    } catch (error) {
      return res
        .status(500)
        .json({ message: 'Unable to fetch attendance summary right now.' });
    }
  }
);

router.get(
  '/modules/:moduleId/students/:uid/attendance-details',
  verifyFirebaseToken,
  async (req, res) => {
    const { moduleId, uid } = req.params;

    try {
      const studentFields = ['student_uid', 'student_id'];

      const presentRecords = [
        ...(await fetchStudentRecords('attendance_records', moduleId, uid, studentFields, 'present')),
        ...(await fetchStudentRecords('attendance_record', moduleId, uid, studentFields, 'present')),
      ];

      const absentRecords = [
        ...(await fetchStudentRecords('absence_records', moduleId, uid, studentFields, 'Absent')),
        ...(await fetchStudentRecords('absence_record', moduleId, uid, studentFields, 'Absent')),
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

      const records = sortByTimestampDesc(Array.from(merged.values()));

      return res.json({ records });
    } catch (error) {
      return res
        .status(500)
        .json({ message: 'Unable to fetch attendance details right now.' });
    }
  }
);

// Note: attendance export moved to routes/attendanceRoutes.js

module.exports = router;

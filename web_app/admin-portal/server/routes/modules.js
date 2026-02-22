const express = require('express');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const { db } = require('../firebaseAdmin');

const router = express.Router();
const ENROLL_FIELD = 'modules';

const normalizeModule = (doc) => {
  const data = doc.data();

  return {
    id: doc.id,
    module_id: data.module_id || doc.id,
    module_code: data.module_code || data.code || '',
    module_name: data.module_name || data.name || '',
    department: data.department || '',
    level: data.level || '',
    semester: data.semester || '',
  };
};

const isWithinRange = (value, from, to) => {
  if (!value) {
    return false;
  }

  if (from && value < from) {
    return false;
  }

  if (to && value > to) {
    return false;
  }

  return true;
};

const matchesEnrollment = (fieldValue, moduleId, moduleCode) => {
  if (!fieldValue) {
    return false;
  }

  if (Array.isArray(fieldValue)) {
    return fieldValue.some((entry) => {
      if (typeof entry === 'string') {
        return entry === moduleId || (moduleCode && entry === moduleCode);
      }

      if (entry && typeof entry === 'object') {
        return (
          entry.module_id === moduleId ||
          (moduleCode && entry.module_code === moduleCode)
        );
      }

      return false;
    });
  }

  if (typeof fieldValue === 'object') {
    return Boolean(fieldValue[moduleId] || (moduleCode && fieldValue[moduleCode]));
  }

  return false;
};

const mapTimestamp = (value) => {
  if (!value || typeof value.toDate !== 'function') {
    return null;
  }

  return value.toDate().toISOString();
};

const buildCountMap = (docs, from, to) => {
  const counts = new Map();

  docs.forEach((doc) => {
    const data = doc.data();
    const dateValue = data.date;

    if (!isWithinRange(dateValue, from, to)) {
      return;
    }

    const uid = data.student_uid;
    if (!uid) {
      return;
    }

    counts.set(uid, (counts.get(uid) || 0) + 1);
  });

  return counts;
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
    const { from, to } = req.query;

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
      const moduleCode = moduleData.module_code || moduleId;

      let studentDocs = [];
      const queryById = await db
        .collection('students')
        .where(ENROLL_FIELD, 'array-contains', moduleId)
        .get();

      if (queryById.size > 0) {
        studentDocs = queryById.docs;
      } else if (moduleCode && moduleCode !== moduleId) {
        const queryByCode = await db
          .collection('students')
          .where(ENROLL_FIELD, 'array-contains', moduleCode)
          .get();
        studentDocs = queryByCode.docs;
      }

      if (studentDocs.length === 0) {
        const allStudentsSnapshot = await db.collection('students').get();
        studentDocs = allStudentsSnapshot.docs.filter((doc) =>
          matchesEnrollment(doc.data()[ENROLL_FIELD], moduleId, moduleCode)
        );
      }

      const enrolledStudents = studentDocs.map((doc) => ({
        uid: doc.id,
        reg_no: doc.data().reg_no || '',
        email: doc.data().email || '',
      }));

      const attendanceSnapshot = await db
        .collection('attendance_record')
        .where('module_id', '==', moduleId)
        .get();
      const absenceSnapshot = await db
        .collection('absence_record')
        .where('module_id', '==', moduleId)
        .get();

      const presentCounts = buildCountMap(attendanceSnapshot.docs, from, to);
      const absentCounts = buildCountMap(absenceSnapshot.docs, from, to);

      const students = enrolledStudents.map((student) => {
        const presentCount = presentCounts.get(student.uid) || 0;
        const absentCount = absentCounts.get(student.uid) || 0;
        const total = presentCount + absentCount;
        const percentage = total === 0 ? 0 : Math.round((presentCount / total) * 1000) / 10;

        return {
          ...student,
          presentCount,
          absentCount,
          total,
          percentage,
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
      const attendanceSnapshot = await db
        .collection('attendance_record')
        .where('module_id', '==', moduleId)
        .where('student_uid', '==', uid)
        .get();
      const absenceSnapshot = await db
        .collection('absence_record')
        .where('module_id', '==', moduleId)
        .where('student_uid', '==', uid)
        .get();

      const presentRecords = attendanceSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          date: data.date || null,
          session_id: data.session_id || null,
          status: data.status || 'present',
          timestamp: mapTimestamp(data.timestamp),
        };
      });

      const absentRecords = absenceSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          date: data.date || null,
          session_id: data.session_id || null,
          status: data.status || 'Absent',
          timestamp: mapTimestamp(data.timestamp),
        };
      });

      const records = [...presentRecords, ...absentRecords].sort((a, b) => {
        const dateCompare = (b.date || '').localeCompare(a.date || '');
        if (dateCompare !== 0) {
          return dateCompare;
        }

        return (b.timestamp || '').localeCompare(a.timestamp || '');
      });

      return res.json({ records });
    } catch (error) {
      return res
        .status(500)
        .json({ message: 'Unable to fetch attendance details right now.' });
    }
  }
);

module.exports = router;

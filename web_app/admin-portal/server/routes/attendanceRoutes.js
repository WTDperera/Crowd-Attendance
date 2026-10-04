const express = require('express');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const { requireLecturer } = verifyFirebaseToken;
const { admin, db } = require('../firebaseAdmin');
const { requireModuleOwner, requireSessionOwner } = require('../services/moduleAccess');
const { historicalStudentsForModule } = require('../services/studentManagement');

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
    batch: data.batch || '',
    lecturer_id: data.lecturer_id || '',
    total_sessions: data.total_sessions || 0,
    session_dates: Array.isArray(data.session_dates)
      ? data.session_dates.map((v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v)).filter(Boolean)
      : [],
  };
};

const formatStudentName = (data) => {
  if (!data) return '';
  if (data.name_with_initials && typeof data.name_with_initials === 'string' && data.name_with_initials.trim()) {
    return data.name_with_initials.trim();
  }
  if (data.full_name && typeof data.full_name === 'string' && data.full_name.trim()) {
    return data.full_name.trim();
  }
  if (data.name && typeof data.name === 'string' && data.name.trim()) {
    return data.name.trim();
  }
  if (data.email && typeof data.email === 'string') {
    return data.email.split('@')[0];
  }
  return data.reg_no || '';
};

const formatDateDDMMYYYY = (dateVal) => {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatTimeStr = (dateVal) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const ENROLL_FIELD = 'enrolled_module_ids';

// Simple test route to verify mounting
router.get('/test', (req, res) => {
  return res.json({ message: 'Attendance route working' });
});

// GET /api/attendance/sessions?moduleId=... - Fetch sessions for a module owned by caller
router.get('/sessions', verifyFirebaseToken, requireLecturer, requireModuleOwner(req => req.query.moduleId), async (req, res) => {
  const { moduleId } = req.query;

  if (!moduleId) {
    return res.status(400).json({ message: 'moduleId query parameter is required.' });
  }

  const normalizedModuleId = moduleId.trim().toUpperCase();

  try {
    const [snapshotById, snapshotByCode] = await Promise.all([
      db.collection('active_sessions').where('module_id', '==', normalizedModuleId).get(),
      db.collection('active_sessions').where('module_code', '==', normalizedModuleId).get(),
    ]);

    const sessionMap = new Map();
    [...snapshotById.docs, ...snapshotByCode.docs].forEach((doc) => {
      const data = doc.data();
      if (data.lecturer_id === req.user.uid) {
        sessionMap.set(doc.id, {
          id: doc.id,
          topic: data.topic || data.session_topic || 'Session',
          status: data.status || 'active',
          started_at: mapTimestamp(data.started_at || data.start_time),
          ended_at: mapTimestamp(data.ended_at || data.end_time),
          student_count: data.student_count || (Array.isArray(data.students_present) ? data.students_present.length : 0),
          students_present: Array.isArray(data.students_present) ? data.students_present : [],
        });
      }
    });

    const sessions = Array.from(sessionMap.values()).sort((a, b) => {
      const aTime = a.started_at ? new Date(a.started_at).getTime() : 0;
      const bTime = b.started_at ? new Date(b.started_at).getTime() : 0;
      return bTime - aTime; // newest first
    });

    return res.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return res.status(500).json({ message: 'Unable to fetch sessions right now.' });
  }
});

// GET /api/attendance/session/:sessionId/report - Per-session report data
router.get('/session/:sessionId/report', verifyFirebaseToken, requireLecturer, requireSessionOwner, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const sessionDoc = await db.collection('active_sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      return res.status(404).json({ message: 'Session not found.' });
    }

    const sessionData = sessionDoc.data();
    if (sessionData.lecturer_id !== req.user.uid) {
      return res.status(403).json({ message: 'You do not have permission to view this session.' });
    }

    const moduleId = (sessionData.module_id || sessionData.module_code || '').trim().toUpperCase();

    // Fetch module details
    let moduleDoc = await db.collection('modules').doc(moduleId).get();
    if (!moduleDoc.exists) {
      const mq = await db.collection('modules').where('module_id', '==', moduleId).limit(1).get();
      moduleDoc = mq.docs[0];
    }
    const moduleData = moduleDoc && moduleDoc.exists
      ? normalizeModule(moduleDoc)
      : { id: moduleId, module_id: moduleId, module_code: moduleId, module_name: moduleId };

    // Fetch enrolled students
    const studentSnapshot = await historicalStudentsForModule(moduleId);

    const students = studentSnapshot.docs
      .map((doc) => ({
        uid: doc.id,
        reg_no: doc.data().reg_no || '',
        name: formatStudentName(doc.data()),
        email: doc.data().email || '',
      }))
      .sort((a, b) => (a.reg_no || '').localeCompare(b.reg_no || ''));

    // Fetch attendance and absence records for this session in parallel
    const [attendanceSnap, absenceSnap] = await Promise.all([
      db.collection('attendance_records').where('session_id', '==', sessionId).get(),
      db.collection('absence_records').where('session_id', '==', sessionId).get(),
    ]);

    const attMap = new Map();
    attendanceSnap.docs.forEach((doc) => {
      const data = doc.data();
      const uid = data.student_uid || data.student_id;
      if (uid) attMap.set(uid, data);
    });

    const absMap = new Map();
    absenceSnap.docs.forEach((doc) => {
      const data = doc.data();
      const uid = data.student_uid || data.student_id;
      if (uid) absMap.set(uid, data);
    });

    let presentCount = 0;
    let absentCount = 0;
    let excusedCount = 0;

    const records = students.map((st, idx) => {
      const att = attMap.get(st.uid);
      let status = 0;
      let timeMarked = '—';
      let savedStatus = 'Absent';
      let markedLate = false;
      let excused = false;

      if (att && att.status === 'present') {
        if (att.excused === true) {
          status = 'ex';
          savedStatus = 'Excused';
          excused = true;
          excusedCount += 1;
        } else {
          status = 1;
          markedLate = Boolean(att.marked_late);
          savedStatus = markedLate ? 'Late' : 'Present';
          presentCount += 1;
          const ts = att.marked_at || att.timestamp;
          if (ts) {
            const dateObj = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
            timeMarked = formatTimeStr(dateObj);
          }
        }
      } else {
        status = 0;
        savedStatus = 'Absent';
        absentCount += 1;
      }

      return {
        no: idx + 1,
        student_uid: st.uid,
        reg_no: st.reg_no,
        name: st.name,
        status, // 1, 0, or 'ex'
        saved_status: savedStatus, // 'Present', 'Late', 'Excused', 'Absent'
        marked_late: markedLate,
        excused,
        time_marked: timeMarked,
      };
    });

    const totalStudents = students.length;
    const totals = {
      total_students: totalStudents,
      total_present: presentCount,
      total_absent: absentCount,
      total_excused: excusedCount,
      // Excused counts as present in calculations
      attendance_percentage: totalStudents > 0
        ? Math.round(((presentCount + excusedCount) / totalStudents) * 10000) / 100
        : 0,
    };

    const sessionStartRaw = sessionData.start_time || sessionData.started_at;
    const sessionDateFormatted = formatDateDDMMYYYY(
      sessionStartRaw && typeof sessionStartRaw.toDate === 'function'
        ? sessionStartRaw.toDate()
        : sessionStartRaw
    );

    return res.json({
      session: {
        id: sessionId,
        topic: sessionData.topic || sessionData.session_topic || 'Session',
        date: sessionDateFormatted,
        started_at: mapTimestamp(sessionStartRaw),
        status: sessionData.status || 'completed',
      },
      module: moduleData,
      students,
      records,
      totals,
    });
  } catch (error) {
    console.error('Error generating session report:', error);
    return res.status(500).json({ message: 'Unable to generate session report right now.' });
  }
});

// Trusted completion and correction share atomic persistence.
const { finalizeSession, correctAttendance } = require('../services/sessionFinalization');
router.post('/session/:sessionId/complete', verifyFirebaseToken, requireLecturer, requireSessionOwner, async (req,res) => {
  try { return res.json(await finalizeSession({sessionId:req.params.sessionId,actor:req.user.uid})); }
  catch(error) { return res.status(error.status || 500).json({message:error.message}); }
});
router.post('/session/:sessionId/mark', verifyFirebaseToken, requireLecturer, requireSessionOwner, async (req,res) => {
  try { return res.json(await correctAttendance({sessionId:req.params.sessionId,actor:req.user.uid,
    correction:{uid:req.body.student_uid,status:req.body.status,reason:req.body.reason}})); }
  catch(error) { return res.status(error.status || 500).json({message:error.message}); }
});

// Collections holding attendance & absence records
const RECORD_COLLECTIONS = [
  'attendance_records',
  'attendance_record',
  'absence_records',
  'absence_record',
];

// Helper to determine if an attendance record qualifies as 'present'
// Rule: completed sessions; present, late and excused count as present; left_early and pending count as absent
const isPresentRecord = (record) => {
  if (!record) return false;
  const statusLower = String(record.status || '').trim().toLowerCase();
  if (statusLower === 'left_early' || statusLower === 'pending') {
    return false;
  }
  return (
    statusLower === 'present' ||
    statusLower === 'late' ||
    record.excused === true ||
    record.marked_late === true
  );
};

// Helper to register attendance records into map prioritizing present/excused status
const addRecordToMap = (map, data, validSessionIds) => {
  if (!data) return;
  const uid = data.student_uid || data.student_id;
  const sId = data.session_id;
  if (!uid || !sId) return;
  if (validSessionIds && !validSessionIds.has(sId)) return;

  const key = `${sId}_${uid}`;
  const existing = map.get(key);
  if (!existing || isPresentRecord(data)) {
    map.set(key, data);
  }
};

// GET /api/attendance/dashboard-summary - Attendance performance per module for the logged-in lecturer
router.get('/dashboard-summary', verifyFirebaseToken, requireLecturer, async (req, res) => {
  try {
    // 1. Fetch all modules owned by this lecturer
    const modulesSnapshot = await db
      .collection('modules')
      .where('lecturer_id', '==', req.user.uid)
      .get();

    if (modulesSnapshot.empty) {
      if (req.query.format === 'object') {
        return res.json({ modules: [] });
      }
      return res.json([]);
    }

    const modulesList = modulesSnapshot.docs.map((doc) => {
      const data = doc.data() || {};
      const code = (data.code || data.module_code || data.module_id || doc.id || '').trim().toUpperCase();
      const name = data.name || data.module_name || '';
      const id = doc.id;
      const keys = new Set(
        [
          id.trim().toUpperCase(),
          (data.module_id || '').trim().toUpperCase(),
          (data.code || '').trim().toUpperCase(),
          (data.module_code || '').trim().toUpperCase(),
        ].filter(Boolean)
      );

      return {
        id,
        code,
        name,
        keys,
        completedSessions: [],
        enrolledStudentUids: new Set(),
      };
    });

    const allKeys = Array.from(new Set(modulesList.flatMap((m) => Array.from(m.keys))));

    // 2. Fetch completed sessions owned by this lecturer in bulk
    const sessionsSnapshot = await db
      .collection('active_sessions')
      .where('lecturer_id', '==', req.user.uid)
      .get();

    const completedSessionIds = new Set();
    sessionsSnapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      if (data.status === 'completed') {
        const rawModuleId = (data.module_id || data.module_code || '').trim().toUpperCase();
        const matchedModule = modulesList.find((m) => m.keys.has(rawModuleId));
        if (matchedModule) {
          const sessionObj = {
            id: doc.id,
            topic: data.topic || data.session_topic || 'Session',
            status: data.status,
          };
          matchedModule.completedSessions.push(sessionObj);
          completedSessionIds.add(doc.id);
        }
      }
    });

    // 3. Fetch all students in bulk to compute enrolled counts per module
    const studentsSnapshot = await db.collection('students').get();
    studentsSnapshot.docs.forEach((studentDoc) => {
      const data = studentDoc.data() || {};
      const enrolledModuleIds = Array.isArray(data.enrolled_module_ids)
        ? data.enrolled_module_ids.map((id) => String(id).trim().toUpperCase())
        : [];

      modulesList.forEach((mod) => {
        if (enrolledModuleIds.some((id) => mod.keys.has(id))) {
          mod.enrolledStudentUids.add(studentDoc.id);
        }
      });
    });

    // 4. Fetch attendance records in bulk if there are completed sessions
    const attendanceRecordsMap = new Map();
    if (completedSessionIds.size > 0 && allKeys.length > 0) {
      const chunks = [];
      for (let i = 0; i < allKeys.length; i += 30) {
        chunks.push(allKeys.slice(i, i + 30));
      }

      const recordQueries = [];
      RECORD_COLLECTIONS.forEach((coll) => {
        chunks.forEach((chunk) => {
          recordQueries.push(db.collection(coll).where('module_id', 'in', chunk).get());
          recordQueries.push(db.collection(coll).where('module_code', 'in', chunk).get());
        });
      });

      const recordSnapshots = await Promise.all(recordQueries);
      recordSnapshots.forEach((snap) => {
        snap.docs.forEach((doc) => {
          addRecordToMap(attendanceRecordsMap, doc.data(), completedSessionIds);
        });
      });
    }

    // 5. Compute metrics for each module
    const result = modulesList
      .map((mod) => {
        const enrolledCount = mod.enrolledStudentUids.size;
        const completedSessionsCount = mod.completedSessions.length;
        let presentMarks = 0;

        if (completedSessionsCount > 0 && enrolledCount > 0) {
          for (const uid of mod.enrolledStudentUids) {
            for (const session of mod.completedSessions) {
              const key = `${session.id}_${uid}`;
              const att = attendanceRecordsMap.get(key);
              if (isPresentRecord(att)) {
                presentMarks += 1;
              }
            }
          }
        }

        const totalPossible = enrolledCount * completedSessionsCount;
        const absentMarks = totalPossible > 0 ? totalPossible - presentMarks : 0;
        const percentage =
          totalPossible > 0
            ? Math.round((presentMarks / totalPossible) * 10000) / 100
            : 0;

        return {
          code: mod.code,
          name: mod.name,
          enrolledCount,
          completedSessions: completedSessionsCount,
          presentMarks,
          absentMarks,
          percentage,
          moduleId: mod.code,
          moduleName: mod.name,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    if (req.query.format === 'object') {
      return res.json({ modules: result });
    }

    return res.json(result);
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    return res.status(500).json({ message: 'Unable to fetch dashboard summary right now.' });
  }
});

// GET /api/attendance/module/:moduleId/summary - Module attendance summary computed from completed sessions
router.get('/module/:moduleId/summary', verifyFirebaseToken, requireLecturer, requireModuleOwner(req => req.params.moduleId), async (req, res) => {
  const { moduleId } = req.params;

  try {
    if (!moduleId) {
      return res.status(400).json({ message: 'Module ID is required.' });
    }

    const normalizedModuleId = moduleId.trim().toUpperCase();

    // Get module details
    let moduleDoc = await db.collection('modules').doc(normalizedModuleId).get();
    if (!moduleDoc.exists) {
      const moduleQuery = await db
        .collection('modules')
        .where('module_id', '==', normalizedModuleId)
        .limit(1)
        .get();
      moduleDoc = moduleQuery.docs[0];
    }

    if (!moduleDoc || !moduleDoc.exists) {
      return res.status(404).json({ message: 'Module not found.' });
    }

    const moduleData = normalizeModule(moduleDoc);
    if (moduleData.lecturer_id !== req.user.uid) {
      return res.status(403).json({ message: 'You do not have permission to view this module.' });
    }

    // 1. Fetch completed sessions for this module owned by caller
    const moduleKeys = Array.from(
      new Set([normalizedModuleId, moduleData.module_id, moduleData.module_code].filter(Boolean))
    );

    const sessionQueries = [];
    moduleKeys.forEach((key) => {
      sessionQueries.push(
        db.collection('active_sessions').where('module_id', '==', key).where('status', '==', 'completed').get()
      );
      sessionQueries.push(
        db.collection('active_sessions').where('module_code', '==', key).where('status', '==', 'completed').get()
      );
    });

    const sessionSnapshots = await Promise.all(sessionQueries);
    const sessionMap = new Map();
    sessionSnapshots.forEach((snap) => {
      snap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.lecturer_id === req.user.uid) {
          sessionMap.set(doc.id, {
            id: doc.id,
            topic: data.topic || data.session_topic || 'Session',
            status: data.status || 'completed',
          });
        }
      });
    });

    const completedSessions = Array.from(sessionMap.values());
    const completedSessionIds = new Set(sessionMap.keys());
    const totalSessions = completedSessions.length;

    // 2. Fetch all enrolled students
    const studentSnapshots = await Promise.all(
      moduleKeys.map((key) =>
        historicalStudentsForModule(key)
      )
    );

    const studentMap = new Map();
    studentSnapshots.forEach((snap) => {
      snap.docs.forEach((doc) => {
        if (!studentMap.has(doc.id)) {
          const data = doc.data();
          studentMap.set(doc.id, {
            uid: doc.id,
            reg_no: data.reg_no || '',
            name: formatStudentName(data),
            email: data.email || '',
          });
        }
      });
    });

    const students = Array.from(studentMap.values()).sort((a, b) =>
      (a.reg_no || '').localeCompare(b.reg_no || '', undefined, { numeric: true, sensitivity: 'base' })
    );

    // 3. Bulk fetch attendance and absence records (including legacy singular collections)
    const recordQueries = [];
    RECORD_COLLECTIONS.forEach((coll) => {
      moduleKeys.forEach((key) => {
        recordQueries.push(db.collection(coll).where('module_id', '==', key).get());
        recordQueries.push(db.collection(coll).where('module_code', '==', key).get());
      });
    });

    const recordSnapshots = await Promise.all(recordQueries);
    const attendanceRecordsMap = new Map();

    recordSnapshots.forEach((snap) => {
      snap.docs.forEach((doc) => {
        addRecordToMap(attendanceRecordsMap, doc.data(), completedSessionIds);
      });
    });

    // 4. Calculate attendance per enrolled student
    // Rules matching Excel export:
    // status 'present' (including late and excused) = present
    // left_early and pending count as 0
    // absent = totalSessions - present
    // percentage = totalSessions > 0 ? (present / totalSessions) * 100 : 0
    const summaryByUid = {};
    const studentSummaries = students.map((st) => {
      let presentCount = 0;

      completedSessions.forEach((session) => {
        const key = `${session.id}_${st.uid}`;
        const att = attendanceRecordsMap.get(key);

        if (isPresentRecord(att)) {
          presentCount += 1;
        }
      });

      const absentCount = totalSessions - presentCount;
      const percentage = totalSessions > 0
        ? Math.round((presentCount / totalSessions) * 10000) / 100
        : 0;

      const summary = {
        student_uid: st.uid,
        reg_no: st.reg_no,
        name: st.name,
        email: st.email,
        present: presentCount,
        absent: absentCount,
        total: totalSessions,
        percentage,
      };

      summaryByUid[st.uid] = summary;
      return summary;
    });

    return res.json({
      total_sessions: totalSessions,
      students: studentSummaries,
      summary_by_uid: summaryByUid,
    });
  } catch (error) {
    console.error('Error generating module attendance summary:', error);
    return res.status(500).json({ message: 'Unable to fetch module attendance summary right now.' });
  }
});

// GET /api/attendance/export - Overall module export matrix (Fixed bulk fetch, no N+1 loop)
router.get('/export', verifyFirebaseToken, requireLecturer, requireModuleOwner(req => req.query.moduleId), async (req, res) => {
  const { moduleId, startDate, endDate } = req.query;

  try {
    if (!moduleId) {
      return res.status(400).json({ message: 'Module ID is required.' });
    }

    const normalizedModuleId = moduleId.trim().toUpperCase();

    // Get module details
    let moduleDoc = await db.collection('modules').doc(normalizedModuleId).get();
    if (!moduleDoc.exists) {
      const moduleQuery = await db
        .collection('modules')
        .where('module_id', '==', normalizedModuleId)
        .limit(1)
        .get();
      moduleDoc = moduleQuery.docs[0];
    }

    if (!moduleDoc || !moduleDoc.exists) {
      return res.status(404).json({ message: 'Module not found.' });
    }

    const moduleData = normalizeModule(moduleDoc);

    // 1. Fetch completed sessions for this module owned by caller
    const [sessionsSnap1, sessionsSnap2] = await Promise.all([
      db
        .collection('active_sessions')
        .where('module_id', '==', normalizedModuleId)
        .where('status', '==', 'completed')
        .get(),
      db
        .collection('active_sessions')
        .where('module_code', '==', normalizedModuleId)
        .where('status', '==', 'completed')
        .get(),
    ]);

    const sessionMap = new Map();
    [...sessionsSnap1.docs, ...sessionsSnap2.docs].forEach((doc) => {
      const data = doc.data();
      if (data.lecturer_id === req.user.uid) {
        const rawTime = data.start_time || data.started_at || data.created_at;
        const timeObj = rawTime && typeof rawTime.toDate === 'function' ? rawTime.toDate() : new Date(rawTime || Date.now());
        sessionMap.set(doc.id, {
          id: doc.id,
          topic: data.topic || data.session_topic || 'Session',
          start_time: timeObj.toISOString(),
          timeMillis: timeObj.getTime(),
        });
      }
    });

    let completedSessions = Array.from(sessionMap.values()).sort(
      (a, b) => a.timeMillis - b.timeMillis // sorted by start time ascending
    );

    // Apply optional date filtering to sessions
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      completedSessions = completedSessions.filter((s) => s.timeMillis >= startMs);
    }
    if (endDate) {
      // Include full end day
      const endMs = new Date(endDate).getTime() + 24 * 60 * 60 * 1000;
      completedSessions = completedSessions.filter((s) => s.timeMillis <= endMs);
    }

    // Format session headers with date collision resolution
    const dateCounts = {};
    const formattedSessions = completedSessions.map((s) => {
      const baseDate = formatDateDDMMYYYY(s.start_time);
      dateCounts[baseDate] = (dateCounts[baseDate] || 0) + 1;
      return {
        id: s.id,
        topic: s.topic,
        start_time: s.start_time,
        baseDate,
        occurrence: dateCounts[baseDate],
      };
    });

    formattedSessions.forEach((s) => {
      if (dateCounts[s.baseDate] > 1) {
        if (s.occurrence === 1) {
          s.headerDate = s.baseDate;
        } else {
          s.headerDate = `${s.baseDate} (${s.occurrence})`;
        }
      } else {
        s.headerDate = s.baseDate;
      }
    });

    // 2. Fetch all enrolled students
    const studentSnapshot = await historicalStudentsForModule(normalizedModuleId);

    const students = studentSnapshot.docs
      .map((doc) => ({
        uid: doc.id,
        reg_no: doc.data().reg_no || '',
        name: formatStudentName(doc.data()),
        email: doc.data().email || '',
      }))
      .sort((a, b) => (a.reg_no || '').localeCompare(b.reg_no || ''));

    // 3. BULK fetch attendance and absence records for module (resolves N+1 query bottleneck)
    const [attSnap1, attSnap2, absSnap1, absSnap2] = await Promise.all([
      db.collection('attendance_records').where('module_id', '==', normalizedModuleId).get(),
      db.collection('attendance_records').where('module_code', '==', normalizedModuleId).get(),
      db.collection('absence_records').where('module_id', '==', normalizedModuleId).get(),
      db.collection('absence_records').where('module_code', '==', normalizedModuleId).get(),
    ]);

    const attendanceRecordsMap = new Map();
    [...attSnap1.docs, ...attSnap2.docs].forEach((doc) => {
      const data = doc.data();
      const uid = data.student_uid || data.student_id;
      const sId = data.session_id;
      if (uid && sId) {
        attendanceRecordsMap.set(`${sId}_${uid}`, data);
      }
    });

    const absenceRecordsMap = new Map();
    [...absSnap1.docs, ...absSnap2.docs].forEach((doc) => {
      const data = doc.data();
      const uid = data.student_uid || data.student_id;
      const sId = data.session_id;
      if (uid && sId) {
        absenceRecordsMap.set(`${sId}_${uid}`, data);
      }
    });

    // 4. Construct matrix rows: 1 = present, 0 = absent, ex = excused
    const matrix = students.map((student, idx) => {
      const sessionValues = formattedSessions.map((session) => {
        const key = `${session.id}_${student.uid}`;
        const att = attendanceRecordsMap.get(key);

        if (att && att.status === 'present') {
          if (att.excused === true) {
            return 'ex';
          }
          return 1;
        }

        // left_early and pending are treated as 0
        return 0;
      });

      return {
        no: idx + 1,
        student_uid: student.uid,
        reg_no: student.reg_no,
        name: student.name,
        session_values: sessionValues,
      };
    });

    // Backward-compatibility: flatten array of records
    const flatRecords = [];
    matrix.forEach((row) => {
      row.session_values.forEach((val, sIdx) => {
        flatRecords.push({
          student_uid: row.student_uid,
          student_reg_no: row.reg_no,
          student_name: row.name,
          session_id: formattedSessions[sIdx].id,
          date: formattedSessions[sIdx].headerDate,
          status: val === 1 ? 'Present' : val === 'ex' ? 'Excused' : 'Absent',
          status_value: val,
        });
      });
    });

    return res.json({
      module: moduleData,
      sessions: formattedSessions,
      students,
      matrix,
      attendance_records: flatRecords,
    });
  } catch (error) {
    console.error('Error exporting attendance:', error);
    return res.status(500).json({ message: 'Unable to export attendance records right now.' });
  }
});

module.exports = router;

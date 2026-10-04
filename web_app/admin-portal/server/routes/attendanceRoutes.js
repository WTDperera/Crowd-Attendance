const express = require('express');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const {
  requireLecturer
} = verifyFirebaseToken;
const {
  db
} = require('../firebaseAdmin');
const {
  requireModuleOwner,
  requireSessionOwner,
  respondError
} = require('../services/moduleAccess');
const {
  loadReport,
  exportReport,
  summaryReport,
  sessionReport
} = require('../services/attendanceReports');
const {
  metrics
} = require('../services/reportPolicy');
const router = express.Router();
const mapTimestamp = value => value && typeof value.toDate === 'function' ? value.toDate().toISOString() : null;
router.get('/test', (req, res) => res.json({
  message: 'Attendance route working'
}));
router.get('/sessions', verifyFirebaseToken, requireLecturer, requireModuleOwner(req => req.query.moduleId), async (req, res) => {
  const {
    moduleId
  } = req.query;
  if (!moduleId) {
    return res.status(400).json({
      message: 'moduleId query parameter is required.'
    });
  }
  const normalizedModuleId = moduleId.trim().toUpperCase();
  try {
    const [snapshotById, snapshotByCode] = await Promise.all([db.collection('active_sessions').where('module_id', '==', normalizedModuleId).get(), db.collection('active_sessions').where('module_code', '==', normalizedModuleId).get()]);
    const sessionMap = new Map();
    [...snapshotById.docs, ...snapshotByCode.docs].forEach(doc => {
      const data = doc.data();
      if (data.lecturer_id === req.user.uid) {
        sessionMap.set(doc.id, {
          id: doc.id,
          topic: data.topic || data.session_topic || 'Session',
          status: data.status || 'active',
          started_at: mapTimestamp(data.started_at || data.start_time),
          ended_at: mapTimestamp(data.ended_at || data.end_time),
          student_count: data.student_count || (Array.isArray(data.students_present) ? data.students_present.length : 0),
          students_present: Array.isArray(data.students_present) ? data.students_present : []
        });
      }
    });
    const sessions = Array.from(sessionMap.values()).sort((a, b) => {
      const aTime = a.started_at ? new Date(a.started_at).getTime() : 0;
      const bTime = b.started_at ? new Date(b.started_at).getTime() : 0;
      return bTime - aTime; // newest first
    });
    return res.json({
      sessions
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return res.status(500).json({
      message: 'Unable to fetch sessions right now.'
    });
  }
});

// Trusted completion and correction share atomic persistence.
const {
  finalizeSession,
  correctAttendance
} = require('../services/sessionFinalization');
router.post('/session/:sessionId/complete', verifyFirebaseToken, requireLecturer, requireSessionOwner, async (req, res) => {
  try {
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length) {
      return res.status(400).json({ message: 'Completion accepts an empty JSON object only.' });
    }
    return res.json(await finalizeSession({
      sessionId: req.params.sessionId,
      actor: req.user.uid
    }));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.status ? error.message : 'Unable to complete this operation right now.'
    });
  }
});
router.post('/session/:sessionId/mark', verifyFirebaseToken, requireLecturer, requireSessionOwner, async (req, res) => {
  try {
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).some(key => !['student_uid', 'status', 'reason'].includes(key))) {
      return res.status(400).json({ message: 'Unsupported correction fields.' });
    }
    return res.json(await correctAttendance({
      sessionId: req.params.sessionId,
      actor: req.user.uid,
      correction: {
        uid: req.body.student_uid,
        status: req.body.status,
        reason: req.body.reason
      }
    }));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.status ? error.message : 'Unable to complete this operation right now.'
    });
  }
});
router.get('/session/:sessionId/report', verifyFirebaseToken, requireLecturer, requireSessionOwner, async (req, res) => {
  try {
    res.json(sessionReport(await loadReport(req.moduleDoc), req.params.sessionId));
  } catch (e) {
    respondError(res, e);
  }
});
router.get('/module/:moduleId/summary', verifyFirebaseToken, requireLecturer, requireModuleOwner(req => req.params.moduleId), async (req, res) => {
  try {
    res.json(summaryReport(await loadReport(req.moduleDoc)));
  } catch (e) {
    respondError(res, e);
  }
});
router.get('/export', verifyFirebaseToken, requireLecturer, requireModuleOwner(req => req.query.moduleId), async (req, res) => {
  try {
    res.json(exportReport(await loadReport(req.moduleDoc, req.query)));
  } catch (e) {
    respondError(res, e);
  }
});
router.get('/dashboard-summary', verifyFirebaseToken, requireLecturer, async (req, res) => {
  try {
    const docs = await db.collection('modules').where('lecturer_id', '==', req.user.uid).get();
    const modules = [];
    for (const doc of docs.docs) {
      const report = await loadReport(doc),
        presentMarks = report.matrix.reduce((n, r) => n + r.present, 0),
        total = report.matrix.reduce((n, r) => n + r.total, 0);
      modules.push({
        code: report.module.module_code,
        name: report.module.module_name,
        moduleId: report.module.module_code,
        moduleName: report.module.module_name,
        enrolledCount: report.students.length,
        completedSessions: report.sessions.length,
        presentMarks,
        absentMarks: total - presentMarks,
        percentage: metrics(presentMarks, total).percentage,
        conflicts: report.matrix.flatMap(r => r.conflicts)
      });
    }
    modules.sort((a, b) => a.code.localeCompare(b.code, undefined, {
      numeric: true
    }));
    res.json(req.query.format === 'object' ? {
      modules
    } : modules);
  } catch (e) {
    respondError(res, e);
  }
});
module.exports = router;

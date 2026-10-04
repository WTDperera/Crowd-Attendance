const express = require('express');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const {
  requireLecturer
} = verifyFirebaseToken;
const {
  db
} = require('../firebaseAdmin');
const {
  requireModuleOwner
} = require('../services/moduleAccess');
const router = express.Router();
const mapSessionDate = value => {
  if (!value) {
    return null;
  }
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return value;
};
const normalizeModule = doc => {
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
    session_dates: Array.isArray(data.session_dates) ? data.session_dates.map(mapSessionDate).filter(Boolean) : []
  };
};
const mapTimestamp = value => {
  if (!value || typeof value.toDate !== 'function') {
    return null;
  }
  return value.toDate().toISOString();
};
router.get('/modules', verifyFirebaseToken, requireLecturer, async (req, res) => {
  try {
    const snapshot = await db.collection('modules').where('lecturer_id', '==', req.user.uid).get();
    const modules = snapshot.docs.map(doc => normalizeModule(doc));
    return res.json({
      modules
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to fetch modules right now.'
    });
  }
});
const {
  loadReport
} = require('../services/attendanceReports');
const {
  respondError
} = require('../services/moduleAccess');
router.get('/modules/:moduleId/attendance-summary', verifyFirebaseToken, requireLecturer, requireModuleOwner(req => req.params.moduleId), async (req, res) => {
  try {
    const report = await loadReport(req.moduleDoc);
    const active = await db.collection('active_sessions').where('module_id', '==', req.moduleDoc.id).where('status', '==', 'active').limit(1).get();
    const doc = active.docs[0],
      d = doc?.data();
    res.json({
      module: report.module,
      activeSession: doc ? {
        id: doc.id,
        topic: d.topic || d.session_topic || '',
        started_at: mapTimestamp(d.started_at),
        student_count: d.student_count || 0,
        students_present: d.students_present || []
      } : null,
      students: report.matrix.map(r => ({
        uid: r.student_uid,
        reg_no: r.reg_no,
        email: r.email,
        present_count: r.present,
        total: r.total,
        percentage: r.percentage,
        eligible: r.eligible,
        conflicts: r.conflicts
      }))
    });
  } catch (e) {
    respondError(res, e);
  }
});
router.get('/modules/:moduleId/students/:uid/attendance-details', verifyFirebaseToken, requireLecturer, requireModuleOwner(req => req.params.moduleId), async (req, res) => {
  try {
    const report = await loadReport(req.moduleDoc),
      row = report.matrix.find(r => r.student_uid === req.params.uid);
    res.json({
      records: row ? row.outcomes.flatMap((o, i) => o.value === null ? [] : [{
        id: report.sessions[i].id + '_' + row.student_uid,
        session_id: report.sessions[i].id,
        date: report.sessions[i].baseDate,
        status: o.status,
        timestamp: report.sessions[i].start_time,
        conflict: o.conflict
      }]).reverse() : []
    });
  } catch (e) {
    respondError(res, e);
  }
});
module.exports = router;

const express = require('express');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const {
  requireStudent
} = require('../services/studentManagement');
const {
  findModule,
  respondError
} = require('../services/moduleAccess');
const {
  loadReport
} = require('../services/attendanceReports');
const {
  db
} = require('../firebaseAdmin');
const router = express.Router();
router.get('/student/attendance-summary', verifyFirebaseToken, async (req, res) => {
  try {
    const profile = await requireStudent(req.user.uid);
    const modules = [];
    const ids = new Set(profile.get('enrolled_module_ids') || []);
    const evidence = await Promise.all(['attendance_records', 'attendance_record', 'absence_records', 'absence_record'].flatMap(c => ['student_uid', 'student_id'].map(field => db.collection(c).where(field, '==', req.user.uid).get())));
    for (const snapshot of evidence) for (const doc of snapshot.docs) {
      const d = doc.data();
      let id = d.module_id || d.module_code || d.module;
      if (!id && d.session_id) {
        const session = await db.doc(`active_sessions/${d.session_id}`).get();
        id = session.get('module_id') || session.get('module_code') || session.get('module');
      }
      if (id) ids.add(id);
    }
    for (const id of ids) {
      const report = await loadReport(await findModule(id));
      const row = report.matrix.find(r => r.student_uid === req.user.uid);
      if (!row) continue;
      // Never serialize the other students, roster or raw records to a student.
      modules.push({
        module: report.module,
        stats: {
          present: row.present,
          absent: row.absent,
          total: row.total,
          percentage: row.percentage,
          raw_percentage: row.raw_percentage,
          eligible: row.eligible,
          conflicts: row.conflicts
        },
        records: row.outcomes.flatMap((o, i) => o.value === null ? [] : [{
          session_id: report.sessions[i].id,
          date: report.sessions[i].start_time,
          status: o.status,
          status_value: o.value
        }])
      });
    }
    res.json({
      modules
    });
  } catch (e) {
    respondError(res, e);
  }
});
module.exports = router;

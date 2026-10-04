const {
  db
} = require('../firebaseAdmin');
const {
  historicalStudentsForModule
} = require('./studentManagement');
const {
  metrics,
  dateMillis,
  localDate,
  dateRange,
  resolve
} = require('./reportPolicy');
const fields = ['module_id', 'module_code', 'module'];
const collections = ['attendance_records', 'attendance_record', 'absence_records', 'absence_record'];
const iso = value => dateMillis(value) === null ? null : new Date(dateMillis(value)).toISOString();
function normalizeModule(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    module_id: d.module_id || doc.id,
    module_code: d.code || d.module_code || d.module_id || doc.id,
    module_name: d.name || d.module_name || '',
    department: d.department || '',
    level: d.level || '',
    semester: d.semester || '',
    batch: d.batch || '',
    lecturer_id: d.lecturer_id
  };
}
async function loadReport(moduleDoc, {
  startDate,
  endDate
} = {}) {
  const module = normalizeModule(moduleDoc);
  const keys = [...new Set([module.id, module.module_id, module.module_code])];
  const {
    from,
    until
  } = dateRange(startDate, endDate);
  const snapshots = await Promise.all(keys.flatMap(key => fields.map(field => db.collection('active_sessions').where(field, '==', key).get())));
  const sessionMap = new Map();
  for (const snap of snapshots) for (const doc of snap.docs) {
    const d = doc.data(),
      ms = dateMillis(d.start_time || d.started_at || d.created_at);
    if (d.status === 'completed' && d.lecturer_id === module.lecturer_id && (from === undefined || ms !== null && ms >= from) && (until === undefined || ms !== null && ms < until)) sessionMap.set(doc.id, {
      id: doc.id,
      topic: d.topic || d.session_topic || 'Session',
      status: 'completed',
      start_time: iso(d.start_time || d.started_at || d.created_at),
      timeMillis: ms,
      _data: d
    });
  }
  const sessions = [...sessionMap.values()].sort((a, b) => (a.timeMillis || 0) - (b.timeMillis || 0) || a.id.localeCompare(b.id));
  const counts = {};
  for (const s of sessions) {
    s.baseDate = localDate(s.start_time);
    s.occurrence = (counts[s.baseDate] || 0) + 1;
    counts[s.baseDate] = s.occurrence;
    s.headerDate = s.baseDate + (s.occurrence > 1 ? ` (${s.occurrence})` : '');
  }
  const studentsMap = new Map();
  const profiles = await Promise.all(keys.map(historicalStudentsForModule));
  for (const snap of profiles) for (const doc of snap.docs) {
    const d = doc.data();
    studentsMap.set(doc.id, {
      uid: doc.id,
      reg_no: d.reg_no || '',
      name: d.name_with_initials || d.full_name || d.name || '',
      email: d.email || ''
    });
  }
  const records = new Map();
  for (const session of sessions) {
    const snapshots = await Promise.all([...collections.map(c => db.collection(c).where('session_id', '==', session.id).get()), db.collection(`active_sessions/${session.id}/attendance`).get()]);
    for (const snap of snapshots) for (const doc of snap.docs) {
      const d = doc.data(),
        uid = d.student_uid || d.student_id;
      if (!uid) continue;
      const key = session.id + '|' + uid;
      if (!records.has(key)) records.set(key, []);
      records.get(key).push({
        ...d,
        _path: doc.ref.path
      });
    }
    // New classes have a frozen roster. Legacy classes use historical enrollment;
    // the response explicitly identifies that fallback, without inventing a roster.
    const roster = session._data.eligible_roster;
    session.roster_source = roster && typeof roster === 'object' ? 'fixed' : 'legacy_enrollment';
    session._uids = new Set(session.roster_source === 'fixed' ? Object.keys(roster) : studentsMap.keys());
    for (const uid of session._uids) if (!studentsMap.has(uid)) {
      const [current, history] = await Promise.all([db.doc(`students/${uid}`).get(), db.doc(`student_history/${uid}`).get()]);
      const d = current.exists ? current.data() : history.exists ? history.data() : {};
      studentsMap.set(uid, {
        uid,
        reg_no: d.reg_no || roster[uid] || '',
        name: d.name_with_initials || d.full_name || d.name || '',
        email: d.email || ''
      });
    }
  }
  const students = [...studentsMap.values()].sort((a, b) => a.reg_no.localeCompare(b.reg_no, undefined, {
    numeric: true
  }) || a.uid.localeCompare(b.uid));
  const matrix = students.map((student, index) => {
    const outcomes = sessions.map(s => s._uids.has(student.uid) ? resolve(records.get(s.id + '|' + student.uid) || []) : {
      status: 'not_eligible',
      value: null,
      conflict: false,
      record: {}
    });
    const values = outcomes.map(o => o.value),
      total = values.filter(v => v !== null).length,
      present = values.filter(v => v === 1 || v === 'ex').length;
    return {
      no: index + 1,
      student_uid: student.uid,
      reg_no: student.reg_no,
      name: student.name,
      email: student.email,
      session_values: values,
      outcomes,
      ...metrics(present, total),
      excused: values.filter(v => v === 'ex').length,
      conflicts: outcomes.flatMap((o, i) => o.conflict ? [sessions[i].id] : [])
    };
  });
  module.total_sessions = sessions.length;
  module.session_dates = sessions.map(s => s.start_time).filter(Boolean);
  return {
    module,
    sessions,
    students,
    matrix
  };
}
function exportReport(report) {
  const {
    module,
    students,
    matrix
  } = report;
  const sessions = report.sessions.map(({
    _data,
    _uids,
    ...s
  }) => s);
  return {
    module,
    sessions,
    students,
    matrix: matrix.map(({
      outcomes,
      ...row
    }) => row),
    attendance_records: matrix.flatMap(row => row.outcomes.map((o, i) => ({
      student_uid: row.student_uid,
      student_reg_no: row.reg_no,
      student_name: row.name,
      session_id: sessions[i].id,
      date: sessions[i].headerDate,
      status: o.status,
      status_value: o.value,
      conflict: o.conflict
    })))
  };
}
function summaryReport(report) {
  const students = report.matrix.map(({
    session_values,
    outcomes,
    ...s
  }) => s);
  return {
    total_sessions: report.sessions.length,
    students,
    summary_by_uid: Object.fromEntries(students.map(s => [s.student_uid, s]))
  };
}
function sessionReport(report, id) {
  const index = report.sessions.findIndex(s => s.id === id);
  if (index < 0) throw Object.assign(Error('Only completed sessions have final reports.'), {
    status: 409
  });
  const s = report.sessions[index];
  const rows = report.matrix.filter(row => row.session_values[index] !== null);
  const records = rows.map((row, i) => {
    const o = row.outcomes[index];
    return {
      no: i + 1,
      student_uid: row.student_uid,
      reg_no: row.reg_no,
      name: row.name,
      status: o.value,
      saved_status: {present:'Present',late:'Late',excused:'Excused',absent:'Absent',left_early:'Left Early',conflict:'Conflict'}[o.status],
      final_status: o.status,
      conflict: o.conflict,
      excused: o.status === 'excused',
      marked_late: o.status === 'late',
      time_marked: iso(o.record.marked_at || o.record.timestamp) ? new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Colombo',
        hour: '2-digit',
        minute: '2-digit'
      }).format(dateMillis(o.record.marked_at || o.record.timestamp)) : '—'
    };
  });
  const total_present = records.filter(r => r.status === 1).length,
    total_excused = records.filter(r => r.status === 'ex').length;
  return {
    module: report.module,
    session: {
      id,
      topic: s.topic,
      status: 'completed',
      date: s.baseDate,
      started_at: s.start_time,
      roster_source: s.roster_source
    },
    students: rows.map(row => ({
      uid: row.student_uid,
      reg_no: row.reg_no,
      name: row.name,
      email: row.email
    })),
    records,
    totals: {
      total_students: records.length,
      total_present,
      total_excused,
      total_absent: records.length - total_present - total_excused,
      attendance_percentage: metrics(total_present + total_excused, records.length).percentage
    }
  };
}
module.exports = {
  loadReport,
  exportReport,
  summaryReport,
  sessionReport
};

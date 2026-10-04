const { db, admin } = require('../firebaseAdmin');
const fail = message => { const error = new Error(message); error.status = 409; throw error; };
const idFor = (session, uid) => `${session}.${Buffer.from(uid, 'utf8').toString('base64').replaceAll('+','-').replaceAll('/','_')}`;
const credited = record => record?.credited === true || (record?.credited !== false &&
  ['pending','present','excused','late'].includes(String(record?.status || '').toLowerCase()));
const outcome = (seen, completed) => {
  if (!completed.size) fail('Complete at least one round first.');
  const count = new Set(seen.filter(id => completed.has(id))).size;
  return !count ? 'absent' : count === completed.size ? 'present' : 'left_early';
};
const effective = data => data?.excused ? 'excused' : data?.final_status || (data?.marked_late ? 'late' : String(data?.status || 'absent').toLowerCase());

// One atomic operation for the bounded demo. No status/counter stage commits
// independently. Hooks are injected by tests only; HTTP cannot select them.
async function mutate({sessionId, actor, correction, beforeCommit, afterCommit}) {
  if (typeof sessionId !== 'string' || !sessionId || sessionId.includes('/')) fail('Invalid session ID.');
  const sessionRef = db.doc(`active_sessions/${sessionId}`);
  const result = await db.runTransaction(async tx => {
    const sessionDoc = await tx.get(sessionRef), session = sessionDoc.data();
    if (!session) fail('Session not found.');
    const moduleId = session.module_id || session.module_code;
    const moduleRef = db.doc(`modules/${moduleId}`), catalogRef = db.doc(`module_catalog/${moduleId}`);
    const [moduleDoc, lecturerDoc, catalogDoc] = await Promise.all([
      tx.get(moduleRef), tx.get(db.doc(`lecturers/${actor}`)), tx.get(catalogRef)]);
    if (!lecturerDoc.exists || session.lecturer_id !== actor || moduleDoc.data()?.lecturer_id !== actor) {
      const error = new Error('Session owner required.'); error.status = 403; throw error;
    }
    if (!correction && session.status === 'completed') {
      if (session.finalization_version !== 1) fail('Legacy completion requires explicit reconciliation.');
      return {success:true,status:'completed',repeated:true};
    }
    if (correction && session.status !== 'completed') fail('Corrections require a completed session.');
    if (!correction && (session.round_schema !== 2 || session.status !== 'active' || session.active_round_id != null)) {
      fail('An active version 2 session with no open round is required.');
    }
    const [att, abs, nested] = await Promise.all([
      tx.get(db.collection('attendance_records').where('session_id','==',sessionId)),
      tx.get(db.collection('absence_records').where('session_id','==',sessionId)),
      tx.get(sessionRef.collection('attendance'))]);
    let roster = session.eligible_roster;
    if (!roster || typeof roster !== 'object' || Array.isArray(roster)) {
      if (!correction) fail('Saved roster required.');
      // Legacy correction is limited to students with existing session evidence.
      roster = Object.fromEntries([...att.docs,...abs.docs].map(d=>[d.get('student_uid') || d.data().student_id,d.data().reg_no || '']));
    }
    const uids = Object.keys(roster);
    if (uids.some(uid=>!uid || uid.includes('/') || uid==='undefined')) fail('Invalid saved roster identity.');
    if (uids.length > 50 || att.size + abs.size + nested.size > 200) fail('Session exceeds the atomic demo limit; no changes committed.');
    if (correction && !uids.includes(correction.uid)) fail('Student is outside the saved session roster/evidence.');
    const completed = new Set(), observations = new Map(uids.map(uid=>[uid,[]]));
    if (!correction) {
      const rounds = await tx.get(sessionRef.collection('rounds'));
      if (rounds.size > 50) fail('Too many rounds for atomic finalization.');
      for (const round of rounds.docs) {
        if (round.get('status') === 'open') fail('An open round remains.');
        if (round.get('status') !== 'completed') continue;
        completed.add(round.id);
        const obs = await tx.get(round.ref.collection('observations'));
        for (const detection of obs.docs) {
          if (!observations.has(detection.id)) fail('Observation is outside saved roster.');
          observations.get(detection.id).push(round.id);
        }
      }
      if (!completed.size) fail('Complete at least one round first.');
      const proofs = await tx.get(sessionRef.collection('roster'));
      if (proofs.size !== uids.length || proofs.docs.some(d=>d.data().reg_no !== roster[d.id])) fail('Roster proof mismatch.');
    }
    const profiles = new Map();
    for (const uid of uids) profiles.set(uid,await tx.get(db.doc(`students/${uid}`)));
    const absenceBaseline=new Map();
    if ([...profiles.values()].some(p=>p.exists && p.data().absence_counts?.[moduleId] == null)) {
      const history=new Map();
      for (const field of ['module_id','module_code']) {
        const snapshot=await tx.get(db.collection('absence_records').where(field,'==',moduleId).limit(251));
        snapshot.docs.forEach(d=>history.set(d.id,d.data()));
      }
      if(history.size>250) fail('Historical absence counter requires bounded reconciliation.');
      const historicalSessions=new Map();
      for(const row of history.values()) {
        if(typeof row.session_id!=='string' || row.session_id.includes('/')) fail('Invalid historical absence identity.');
        if(!historicalSessions.has(row.session_id)) historicalSessions.set(row.session_id,await tx.get(db.doc(`active_sessions/${row.session_id}`)));
      }
      for(const uid of uids) absenceBaseline.set(uid,new Set([...history.values()].filter(row=>
        (row.student_uid || row.student_id)===uid && historicalSessions.get(row.session_id).data()?.status==='completed').map(row=>row.session_id)).size);
    }
    const records = new Map(), statuses = new Map();
    for (const uid of uids) {
      const matches = att.docs.filter(d=>(d.data().student_uid || d.data().student_id) === uid);
      if (new Set(matches.map(d=>effective(d.data()))).size > 1) fail('Conflicting legacy attendance requires reconciliation.');
      const saved = matches.find(d=>d.id===idFor(sessionId,uid)) || matches[0];
      if (correction && saved && effective(saved.data()) === 'pending') fail('Pending legacy result requires completion reconciliation.');
      records.set(uid,{matches,saved});
      statuses.set(uid,correction ? (uid===correction.uid ? correction.status : effective(saved?.data())) : outcome(observations.get(uid),completed));
    }
    const now = admin.firestore.Timestamp.now();
    if (correction) {
      const uid=correction.uid, old=records.get(uid).saved?.data();
      const projection=nested.docs.find(d=>d.id===uid)?.data();
      const absences=abs.docs.filter(d=>(d.data().student_uid || d.data().student_id)===uid);
      const credit=['present','excused','late'].includes(correction.status);
      // Exact status retry is a no-op after a coherent version 1 projection.
      // Legacy/missing/contradictory projections still require reconciliation.
      if (old?.finalization_version===1 && effective(old)===correction.status &&
          projection?.finalization_version===1 && effective(projection)===correction.status &&
          records.get(uid).matches.length===1 && absences.length===(credit?0:1) &&
          (session.students_present || []).includes(uid)===credit) {
        return {success:true,status:correction.status,repeated:true};
      }
    }
    const date = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit'}).format((session.started_at || now).toDate());
    // Every read and validation is above this point. Hook failures roll back all
    // queued summary/absence/counter/status changes in the same transaction.
    const targets = correction ? [correction.uid] : uids;
    for (const uid of targets) {
      const {matches,saved} = records.get(uid), old = saved?.data(), status = statuses.get(uid);
      const credit = ['present','excused','late'].includes(status);
      const oldCredit = credited(old) ? 1 : 0;
      const existingAbs = abs.docs.filter(d=>(d.data().student_uid || d.data().student_id)===uid);
      const oldAbsent = old?.finalization_version === 1 ? (!credited(old)?1:0) : existingAbs.length ? 1 : 0;
      const ref = saved?.ref || db.doc(`attendance_records/${idFor(sessionId,uid)}`);
      const summary = { ...(old || {}), session_id:sessionId,student_uid:uid,student_id:uid,reg_no:roster[uid] || profiles.get(uid).data()?.reg_no || '',
        module_id:moduleId,module_code:moduleId,record_id:ref.id,finalization_version:1,
        final_status:status,status:credit?'present':status,credited:credit,excused:status==='excused',marked_late:status==='late',
        marked_at:old?.marked_at || now,timestamp:old?.timestamp || now,date,
        ...(!correction ? {observed_round_ids:observations.get(uid),scan_count:observations.get(uid).length} :
          {manual:true,marked_by:actor,correction_reason:correction.reason,corrected_at:now}) };
      tx.set(ref,summary);
      tx.set(sessionRef.collection('attendance').doc(uid),summary);
      for (const duplicate of matches) if (duplicate.id !== ref.id) tx.delete(duplicate.ref);
      for (const duplicate of nested.docs) if ((duplicate.data().student_uid || duplicate.data().student_id)===uid && duplicate.id!==uid) tx.delete(duplicate.ref);
      for (const absence of existingAbs) tx.delete(absence.ref);
      if (!credit) tx.set(db.doc(`absence_records/${sessionId}_${uid}`),{student_uid:uid,student_id:uid,reg_no:summary.reg_no,module_id:moduleId,
        session_id:sessionId,status:'Absent',final_status:status,timestamp:now,date,finalization_version:1});
      const profile = profiles.get(uid);
      if (profile.exists) {
        const attendance = Number(profile.data().attendance_counts?.[moduleId] || 0) + Number(credit) - oldCredit;
        const absence = Number(profile.data().absence_counts?.[moduleId] ?? absenceBaseline.get(uid) ?? oldAbsent) + Number(!credit) - oldAbsent;
        if (!Number.isInteger(attendance) || attendance<0 || !Number.isInteger(absence) || absence<0) fail('Counter conflict requires reconciliation.');
        tx.update(profile.ref,{[`attendance_counts.${moduleId}`]:attendance,[`absence_counts.${moduleId}`]:absence});
      }
      if (correction && effective(old)!==status) tx.set(sessionRef.collection('corrections').doc(),{
        student_uid:uid,actor,before:effective(old),after:status,reason:correction.reason,timestamp:now});
    }
    const present = uids.filter(uid=>['present','excused','late'].includes(statuses.get(uid)));
    tx.update(sessionRef,{students_present:present,student_count:present.length,total_students:uids.length,
      ...(!correction?{status:'completed',finalization_version:1,ended_at:now,completed_at:now}: {})});
    if (!correction) {
      const update = {total_sessions:admin.firestore.FieldValue.increment(1),session_dates:admin.firestore.FieldValue.arrayUnion(now)};
      tx.update(moduleRef,update); if(catalogDoc.exists) tx.update(catalogRef,update);
    }
    await beforeCommit?.(tx);
    return {success:true,status:correction?.status || 'completed',repeated:false};
  });
  await afterCommit?.(result);
  return result;
}
const finalizeSession = options => mutate(options);
const correctAttendance = options => {
  const {uid,status,reason='Owner correction'} = options.correction || {};
  if (typeof uid !== 'string' || !uid || uid.includes('/') || typeof status !== 'string' ||
      !['present','absent','excused','late'].includes(status.toLowerCase()) || typeof reason !== 'string' || !reason.trim() || reason.length>500) {
    const error = new Error('Invalid correction: student_uid, status and reason required.');error.status=400;throw error;
  }
  return mutate({...options,correction:{uid,status:status.toLowerCase(),reason:reason.trim()}});
};
module.exports = {finalizeSession,correctAttendance,outcome,idFor};

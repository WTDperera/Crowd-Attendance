// Counts are class outcomes, never packet/round counts or profile counters.
function metrics(present, total) {
  const raw_percentage = total ? present / total * 100 : 0;
  return {
    present,
    absent: total - present,
    total,
    raw_percentage,
    percentage: Math.round(raw_percentage * 100) / 100,
    eligible: total > 0 && present * 100 >= total * 80
  };
}
function dateMillis(value) {
  if (!value) return null;
  const ms = new Date(typeof value.toDate === 'function' ? value.toDate() : value).getTime();
  return Number.isFinite(ms) ? ms : null;
}
function localDate(value) {
  const ms = dateMillis(value);
  return ms === null ? 'N/A' : new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(ms);
}
function dateRange(start, end) {
  function midnight(value) {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Object.assign(Error('Dates must be YYYY-MM-DD.'), {
      status: 400
    });
    const utc = Date.parse(value + 'T00:00:00Z');
    if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== value) throw Object.assign(Error('Invalid date.'), {
      status: 400
    });
    return utc - 330 * 60000;
  }
  const from = midnight(start),
    last = midnight(end),
    until = last === undefined ? undefined : last + 86400000;
  if (from !== undefined && until !== undefined && from >= until) throw Object.assign(Error('Start date must not follow end date.'), {
    status: 400
  });
  return {
    from,
    until
  };
}
function outcome(record) {
  const status = String(record.final_status || record.status || '').toLowerCase().replaceAll(' ', '_');
  if (['pending', 'active', 'cancelled'].includes(status)) return null;
  if (record.excused === true || status === 'excused') return 'excused';
  if (status === 'present' || status === 'late' || record.marked_late === true && status !== 'left_early' && status !== 'absent') return status === 'late' || record.marked_late ? 'late' : 'present';
  if (status === 'left_early') return 'left_early';
  if (status === 'absent') return 'absent';
  return null;
}
function resolve(records) {
  const candidates = records.map(r => ({
    record: r,
    status: outcome(r),
    rank: r.corrected_at || r.manual ? 3 : r.final_status ? 2 : 1
  })).filter(r => r.status);
  if (!candidates.length) return {
    status: records.length ? 'conflict' : 'absent',
    value: 0,
    conflict: records.length > 0,
    record: {}
  };
  const rank = Math.max(...candidates.map(r => r.rank));
  let top = candidates.filter(r => r.rank === rank);
  if (rank === 3) {
    const latest = Math.max(...top.map(r => dateMillis(r.record.corrected_at) || 0));
    top = top.filter(r => (dateMillis(r.record.corrected_at) || 0) === latest);
  }
  const credit = s => ['present', 'late', 'excused'].includes(s);
  const signatures = new Set(top.map(r => credit(r.status) ? r.status === 'excused' ? 'excused' : 'present' : 'absent'));
  // Disagreement at the same authority must be surfaced, not hidden by read order.
  if (signatures.size > 1) return {
    status: 'conflict',
    value: 0,
    conflict: true,
    record: {}
  };
  top.sort((a, b) => (dateMillis(b.record.corrected_at) || 0) - (dateMillis(a.record.corrected_at) || 0) || String(a.record._path || '').localeCompare(String(b.record._path || '')));
  const chosen = top.find(r => r.status === 'left_early') || top[0];
  return {
    status: chosen.status,
    value: chosen.status === 'excused' ? 'ex' : credit(chosen.status) ? 1 : 0,
    conflict: false,
    record: chosen.record
  };
}
module.exports = {
  metrics,
  dateMillis,
  localDate,
  dateRange,
  resolve
};

const {
  test
} = require('node:test');
const assert = require('node:assert/strict');
const {
  metrics,
  resolve,
  dateRange,
  localDate
} = require('../../web_app/admin-portal/server/services/reportPolicy');
test('P07 independent raw threshold oracle distinguishes rounded 80 from eligibility', async () => {
  const {
    attendanceMetrics
  } = await import('../../web_app/admin-portal/frontend/src/services/attendanceWorkbook.js');
  for (const [present, total, pct, eligible] of [[4, 5, 80, true], [7999, 10000, 79.99, false], [8001, 10000, 80.01, true], [79999, 100000, 80, false], [0, 0, 0, false]]) {
    assert.equal(metrics(present, total).percentage, pct);
    assert.equal(metrics(present, total).eligible, eligible);
    assert.deepEqual(attendanceMetrics(present, total), {
      percentage: pct,
      eligible
    });
  }
});
test('P07 correction precedence, finalization authority and ambiguous legacy evidence', () => {
  assert.equal(resolve([{
    status: 'Absent'
  }, {
    status: 'present',
    excused: true,
    manual: true
  }]).value, 'ex');
  assert.equal(resolve([{
    status: 'present'
  }, {
    status: 'absent',
    final_status: 'absent'
  }]).value, 0);
  assert.equal(resolve([{
    status: 'present'
  }, {
    status: 'absent'
  }]).conflict, true);
  assert.equal(resolve([{
    status: 'left_early'
  }, {
    status: 'absent'
  }]).status, 'left_early');
  assert.equal(resolve([{
    status: 'pending',
    scan_count: 3
  }]).value, 0);
  assert.equal(resolve([{
    status: 'present',
    corrected_at: '2026-10-01T00:00Z'
  }, {
    status: 'absent',
    corrected_at: '2026-10-02T00:00Z'
  }]).status, 'absent');
});
test('P07 day boundaries use Asia/Colombo independently of machine timezone', () => {
  assert.deepEqual(dateRange('2026-10-02', '2026-10-02'), {
    from: Date.parse('2026-10-01T18:30Z'),
    until: Date.parse('2026-10-02T18:30Z')
  });
  assert.equal(localDate('2026-10-01T18:30Z'), '02/10/2026');
  assert.equal(localDate('2026-10-01T18:29:59Z'), '01/10/2026');
});

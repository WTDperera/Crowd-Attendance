const {
  test
} = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('../../web_app/admin-portal/frontend/node_modules/xlsx-js-style');
const builders = () => import('../../web_app/admin-portal/frontend/src/services/attendanceWorkbook.js');
function roundTrip(workbook) {
  return XLSX.read(XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx'
  }), {
    type: 'buffer',
    cellFormula: true,
    cellStyles: true
  });
}
function labeled(sheet, label, column = 'C') {
  const key = Object.keys(sheet).find(k => /^A\d+$/.test(k) && sheet[k].v === label);
  assert(key, `Missing ${label}`);
  return sheet[column + key.slice(1)];
}
test('P07 session caches and formulas derive from rows, not stale API totals', async () => {
  const {
    buildSessionWorkbook
  } = await builders();
  const {
    workbook
  } = buildSessionWorkbook({
    records: [{
      reg_no: 'QA001',
      status: 1
    }, {
      reg_no: 'QA002',
      status: 0
    }, {
      reg_no: 'QA003',
      status: 'ex'
    }],
    totals: {
      total_students: 999,
      total_present: 999,
      total_absent: 999,
      total_excused: 999,
      attendance_percentage: 999
    }
  });
  const sheet = roundTrip(workbook).Sheets['Session Attendance'];
  assert.equal(labeled(sheet, 'Total Students').v, 3);
  assert.equal(labeled(sheet, 'Total Present').v, 1);
  assert.equal(labeled(sheet, 'Total Absent').v, 1);
  assert.equal(labeled(sheet, 'Total Excused').v, 1);
  assert.equal(labeled(sheet, 'Attendance %').v, 66.67);
  assert.match(labeled(sheet, 'Total Present').f, /COUNTIF\(C6:C8, 1\)/);
});
test('P07 conflicts remain visible in serialized workbook cell comments', async () => {
  const {buildAttendanceWorkbook,buildSessionWorkbook}=await builders();
  for(const [builder,data,name] of [[buildAttendanceWorkbook,{sessions:[{id:'conflict'}],matrix:[{reg_no:'QA001',session_values:[0],conflicts:['conflict']}]},'Attendance Matrix'],
    [buildSessionWorkbook,{records:[{reg_no:'QA001',status:0,conflict:true}]},'Session Attendance']]) {
    const sheet=roundTrip(builder(data).workbook).Sheets[name];assert.equal(sheet.C6.v,0);assert.match(sheet.C6.c[0].t,/require lecturer review/);
  }
});
// Independent evaluator for the generated COUNTIF / IF / ROUND subset.
// It computes from cell values and formula references, ignoring formula caches.
function evaluate(sheet, address) {
  const cell = sheet[address];
  if (!cell?.f) return cell?.v ?? 0;
  let f = cell.f.replace(/COUNTIF\(([A-Z]+\d+):([A-Z]+\d+),\s*(1|0|"ex")\)/g, (_, first, last, criterion) => {
    const range = XLSX.utils.decode_range(first + ':' + last),
      expected = criterion === '"ex"' ? 'ex' : Number(criterion);
    let n = 0;
    for (let r = range.s.r; r <= range.e.r; r++) for (let c = range.s.c; c <= range.e.c; c++) if (sheet[XLSX.utils.encode_cell({
      r,
      c
    })]?.v === expected) n++;
    return String(n);
  }).replace(/[A-Z]+\d+/g, ref => String(evaluate(sheet, ref)));
  assert(/^[\d\s.,()+*/><=-]*(?:(?:IF|ROUND)[\d\s.,()+*/><=-]*)*$/.test(f), 'Unexpected formula ' + f);
  return Function('IF', 'ROUND', `return ${f}`)((condition, yes, no) => condition ? yes : no, (value, places) => Math.round(value * 10 ** places) / 10 ** places);
}
test('P07 formula results and caches agree after XLSX serialization including columns beyond Z', async () => {
  const {
    buildAttendanceWorkbook
  } = await builders();
  const sessions = Array.from({
    length: 30
  }, (_, i) => ({
    headerDate: `02/10/2026${i ? ' (' + (i + 1) + ')' : ''}`
  }));
  const matrix = [{
    reg_no: 'QA010',
    session_values: Array(30).fill(0)
  }, {
    reg_no: 'QA002',
    session_values: [...Array(23).fill(1), 'ex', ...Array(6).fill(0)]
  }];
  const sheet = roundTrip(buildAttendanceWorkbook({
    sessions,
    matrix
  }).workbook).Sheets['Attendance Matrix'];
  assert.equal(sheet.B6.v, 'QA002');
  assert.equal(sheet.AG6.v, 24);
  assert.equal(sheet.AH6.v, 6);
  assert.equal(sheet.AI6.v, 80);
  assert.equal(sheet.AF5.v, '02/10/2026 (30)');
  assert.match(sheet.AG6.f, /C6:AF6/);
  for (const cell of ['AG6', 'AH6', 'AI6', 'AG7', 'AH7', 'AI7']) assert.equal(evaluate(sheet, cell), sheet[cell].v);
});
test('P07 N/A does not create absence; zero-session and empty workbooks remain valid', async () => {
  const {
    buildAttendanceWorkbook,
    buildSessionWorkbook
  } = await builders();
  const sheet = roundTrip(buildAttendanceWorkbook({
    sessions: [{
      headerDate: '02/10/2026'
    }, {
      headerDate: '03/10/2026'
    }],
    matrix: [{
      reg_no: 'QA001',
      session_values: [null, 'ex']
    }]
  }).workbook).Sheets['Attendance Matrix'];
  assert.equal(sheet.C6.v, 'N/A');
  assert.equal(sheet.E6.v, 1);
  assert.equal(sheet.F6.v, 0);
  assert.equal(sheet.G6.v, 100);
  assert.equal(evaluate(sheet, 'G6'), 100);
  const zero = roundTrip(buildAttendanceWorkbook({
    sessions: [],
    matrix: [{
      reg_no: 'QA001',
      session_values: []
    }]
  }).workbook).Sheets['Attendance Matrix'];
  assert.equal(zero.C6.v, 0);
  assert.equal(zero.D6.v, 0);
  assert.equal(zero.E6.v, 0);
  assert.equal(zero.E6.f, undefined);
  assert.equal(roundTrip(buildAttendanceWorkbook({
    matrix: [],
    sessions: []
  }).workbook).SheetNames.length, 1);
  const session = roundTrip(buildSessionWorkbook({
    records: []
  }).workbook).Sheets['Session Attendance'];
  assert.equal(labeled(session, 'Attendance %').v, 0);
  assert.equal(labeled(session, 'Total Students').v, 0);
});
test('P07 formula-like identifiers stay literal strings after XLSX serialization', async () => {
  const {
    buildAttendanceWorkbook,
    buildSessionWorkbook
  } = await builders();
  for (const value of ['=1+1', '+SUM(A1:A2)', '-1+2', '@SUM(A1:A2)']) {
    for (const [builder, data, name] of [[buildAttendanceWorkbook, {
      matrix: [{
        reg_no: value,
        session_values: [1]
      }],
      sessions: [{
        headerDate: '02/10/2026'
      }]
    }, 'Attendance Matrix'], [buildSessionWorkbook, {
      records: [{
        reg_no: value,
        status: 1
      }]
    }, 'Session Attendance']]) {
      const sheet = roundTrip(builder(data).workbook).Sheets[name];
      assert.equal(sheet.B6.t, 's');
      assert.equal(sheet.B6.v, value);
      assert.equal(sheet.B6.f, undefined);
    }
  }
});
test('P07 malformed matrices and provisional reports refuse export; timezone and styles persist', async () => {
  const {
    buildAttendanceWorkbook,
    buildSessionWorkbook
  } = await builders();
  assert.throws(() => buildAttendanceWorkbook({
    sessions: [{}],
    matrix: [{
      session_values: []
    }]
  }), /match/);
  assert.throws(() => buildAttendanceWorkbook({
    sessions: [{}],
    matrix: [{
      session_values: [{
        f: 'BAD'
      }]
    }]
  }), /match/);
  assert.throws(() => buildSessionWorkbook({
    session: {
      status: 'active'
    },
    records: []
  }), /completed/);
  assert.throws(() => buildAttendanceWorkbook({
    sessions: Array(16380).fill({}),
    matrix: []
  }), /column limit/);
  const {
    workbook
  } = buildAttendanceWorkbook({
    sessions: [{
      start_time: '2026-10-01T18:30Z'
    }],
    matrix: [{
      reg_no: 'A',
      session_values: [0]
    }]
  });
  const sheet = roundTrip(workbook).Sheets['Attendance Matrix'];
  assert.equal(sheet.C5.v, '02/10/2026');
  assert.equal(sheet.F6.v, 0);
  assert.equal(sheet.F6.s.fgColor.rgb, 'FEE2E2');
});

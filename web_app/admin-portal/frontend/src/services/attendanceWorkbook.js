import XLSX from 'xlsx-js-style'
export const FACULTY_HEADER = 'Faculty of Engineering - University of Ruhuna'

export const attendanceMetrics = (present, total) => ({
  percentage: total > 0 ? Math.round(present / total * 10000) / 100 : 0,
  eligible: total > 0 && present * 100 >= total * 80,
})
const literal = (value) => ({ t: 's', v: String(value ?? '') })

/**
 * Converts a 0-indexed column number to an Excel column letter (0 -> A, 27 -> AB)
 */
const getExcelColumnLetter = (colIndex) => {
  let letter = ''
  let temp = colIndex
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter
    temp = Math.floor(temp / 26) - 1
  }
  return letter
}

/**
 * Sort comparator for sorting by Student Number (reg_no)
 */
const sortByStudentNumber = (a, b) => {
  const regA = (a.reg_no || '').trim()
  const regB = (b.reg_no || '').trim()
  return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * Common thin border style for table cells
 */
const thinBorder = {
  top: { style: 'thin', color: { rgb: 'D1D5DB' } },
  bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
  left: { style: 'thin', color: { rgb: 'D1D5DB' } },
  right: { style: 'thin', color: { rgb: 'D1D5DB' } },
}

/**
 * Formats session date to dd/mm/yyyy
 */
const formatSessionDate = (session) => {
  if (session.headerDate && /^\d{2}\/\d{2}\/\d{4}( \(\d+\))?$/.test(session.headerDate)) {
    return session.headerDate
  }
  const rawDate = session.start_time || session.started_at || session.date || session.headerDate
  if (!rawDate) return 'Session'

  try {
    const dt = new Date(rawDate)
    if (isNaN(dt.getTime())) {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) return rawDate
      if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
        const [y, m, d] = rawDate.split('T')[0].split('-')
        return `${d}/${m}/${y}`
      }
      return rawDate
    }
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(dt)
  } catch {
    return session.date || 'Session'
  }
}

export const buildSessionWorkbook = (data) => {
  const { session = {}, module = {}, records = [] } = data
  if (session.status && session.status !== 'completed') throw new Error('Only completed sessions have final reports.')
  if (records.some(r => ![1, 0, 'ex'].includes(r.status))) throw new Error('Invalid final attendance value.')
  const totals = {
    total_students: records.length,
    total_present: records.filter(r => r.status === 1).length,
    total_absent: records.filter(r => r.status === 0).length,
    total_excused: records.filter(r => r.status === 'ex').length,
  }
  const result = attendanceMetrics(totals.total_present + totals.total_excused, totals.total_students)
  totals.attendance_percentage = result.percentage

  const moduleCode = module.module_code || module.code || ''
  const moduleName = module.module_name || module.name || ''

  // Sort rows by Student Number
  const sortedRecords = [...records].sort(sortByStudentNumber)

  // Title rows merged across all columns, centered, bold
  const semesterPart = module.semester ? `Semester ${module.semester}` : ''
  const batchPart = module.batch ? `Batch ${module.batch}` : ''
  const semesterBatchText = [semesterPart, batchPart].filter(Boolean).join(' | ')

  const sessionDateText = session.date || '—'
  const sessionTopicText = session.topic || 'Session'
  const sessionInfoText = `Total Sessions: 1 | Date: ${sessionDateText} | Topic: ${sessionTopicText}`

  const titleRows = [
    FACULTY_HEADER,
    `${moduleCode} - ${moduleName}`,
  ]

  if (semesterBatchText) {
    titleRows.push(semesterBatchText)
  }

  titleRows.push(sessionInfoText)

  const rows = []
  titleRows.forEach((title) => {
    rows.push([title])
  })

  // Blank row before table header
  rows.push([])

  // Table header row: No | Student Number | Status (1/0/ex) | Time Marked
  const headerRowIndex = rows.length // 0-indexed
  const headerRowNumber = headerRowIndex + 1 // 1-indexed
  rows.push(['No', 'Student Number', 'Status', 'Time Marked'])

  // Data rows
  const recordsStartRow = rows.length + 1 // 1-indexed
  sortedRecords.forEach((rec, idx) => {
    rows.push([
      idx + 1,
      literal(rec.reg_no),
      rec.status, // 1, 0, or 'ex'
      literal(rec.time_marked || '—'),
    ])
  })
  const recordsEndRow = recordsStartRow + Math.max(0, sortedRecords.length - 1)

  // Bottom totals section
  rows.push([]) // Blank row
  const totalRowIndex = rows.length + 1
  rows.push(['Total Students', '', totals.total_students || sortedRecords.length])

  const presentRowIndex = rows.length + 1
  rows.push([
    'Total Present',
    '',
    sortedRecords.length > 0
      ? { t: 'n', f: `COUNTIF(C${recordsStartRow}:C${recordsEndRow}, 1)`, v: totals.total_present }
      : 0,
  ])

  rows.push([
    'Total Absent',
    '',
    sortedRecords.length > 0
      ? { t: 'n', f: `COUNTIF(C${recordsStartRow}:C${recordsEndRow}, 0)`, v: totals.total_absent }
      : 0,
  ])

  const excusedRowIndex = rows.length + 1
  rows.push([
    'Total Excused',
    '',
    sortedRecords.length > 0
      ? { t: 'n', f: `COUNTIF(C${recordsStartRow}:C${recordsEndRow}, "ex")`, v: totals.total_excused }
      : 0,
  ])

  const pctRowIndex = rows.length + 1
  rows.push([
    'Attendance %',
    '',
    sortedRecords.length > 0
      ? {
          t: 'n',
          f: `IF(C${totalRowIndex}>0, ROUND((C${presentRowIndex}+C${excusedRowIndex})/C${totalRowIndex}*100, 2), 0)`,
          v: totals.attendance_percentage,
          z: '0.00',
        }
      : 0,
  ])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  const totalCols = 4
  sortedRecords.forEach((record, index) => {
    if (record.conflict) ws[`C${recordsStartRow + index}`].c = [{ a: 'Attendance report', t: 'Conflicting records require lecturer review. No attendance credit is assigned.' }]
  })

  // Title merges & styles
  ws['!merges'] = []
  for (let r = 0; r < titleRows.length; r++) {
    ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: totalCols - 1 } })
    const cellAddr = `A${r + 1}`
    if (ws[cellAddr]) {
      ws[cellAddr].s = {
        font: { bold: true, sz: r === 0 ? 13 : 11, name: 'Calibri' },
        alignment: { horizontal: 'center', vertical: 'center' },
      }
    }
  }

  // Merge columns A:B for each totals label cell
  for (let r = totalRowIndex; r <= pctRowIndex; r++) {
    ws['!merges'].push({ s: { r: r - 1, c: 0 }, e: { r: r - 1, c: 1 } })
  }

  // Row heights
  ws['!rows'] = []
  for (let r = 0; r < titleRows.length; r++) {
    ws['!rows'][r] = { hpt: 22 }
  }
  ws['!rows'][titleRows.length] = { hpt: 10 } // blank row
  ws['!rows'][headerRowIndex] = { hpt: 26 } // table header row

  // Table header styling: bold, grey fill, centered, thin borders
  for (let c = 0; c < totalCols; c++) {
    const colLetter = getExcelColumnLetter(c)
    const cellAddr = `${colLetter}${headerRowNumber}`
    if (ws[cellAddr]) {
      ws[cellAddr].s = {
        font: { bold: true, sz: 10, name: 'Calibri' },
        fill: { fgColor: { rgb: 'E5E7EB' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder,
      }
    }
  }

  // Data rows styling: thin borders on every cell, values centered, light blue fill on 'ex'
  for (let r = recordsStartRow; r <= recordsEndRow; r++) {
    ws['!rows'][r - 1] = { hpt: 20 }
    for (let c = 0; c < totalCols; c++) {
      const colLetter = getExcelColumnLetter(c)
      const cellAddr = `${colLetter}${r}`
      if (ws[cellAddr]) {
        const isEx = ws[cellAddr].v === 'ex'
        ws[cellAddr].s = {
          font: { sz: 10, name: 'Calibri' },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: thinBorder,
          fill: isEx ? { fgColor: { rgb: 'DBEAFE' } } : undefined,
        }
      }
    }
  }

  // Bottom totals styling: merged label in A:B, value in C, thin borders
  for (let r = totalRowIndex; r <= pctRowIndex; r++) {
    ws['!rows'][r - 1] = { hpt: 20 }
    const cellA = `A${r}`
    const cellB = `B${r}`
    const cellC = `C${r}`

    // Merged label cell across A:B: bold, left-aligned, thin border
    if (ws[cellA]) {
      ws[cellA].s = {
        font: { bold: true, sz: 10, name: 'Calibri' },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: thinBorder,
      }
    }
    if (!ws[cellB]) {
      ws[cellB] = { t: 's', v: '' }
    }
    ws[cellB].s = {
      font: { sz: 10, name: 'Calibri' },
      border: thinBorder,
    }

    // Value cell in C: centered, thin border
    if (!ws[cellC]) {
      ws[cellC] = { t: 'n', v: 0 }
    }
    const isPct = r === pctRowIndex
    const isBelow80 = isPct && !result.eligible

    ws[cellC].s = {
      font: { sz: 10, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder,
      fill: isBelow80 ? { fgColor: { rgb: 'FEE2E2' } } : undefined,
    }
    if (isPct) {
      ws[cellC].z = '0.00'
    }
  }

  // Column widths: No 6, Student Number 16, session columns 6-8 (Status 8), Time Marked 14
  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 16 }, // Student Number
    { wch: 8 },  // Status
    { wch: 14 }, // Time Marked
  ]

  // Freeze panes below the header row and after the Student Number column
  ws['!freeze'] = { xSplit: 2, ySplit: headerRowNumber }
  ws['!views'] = [
    {
      state: 'frozen',
      xSplit: 2,
      ySplit: headerRowNumber,
      topLeftCell: `C${headerRowNumber + 1}`,
      activePane: 'bottomRight',
    },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Session Attendance')

  const dateClean = (session.date || 'Report').replace(/[/\\]/g, '-')
  const filename = `Session_Attendance_${moduleCode || 'Module'}_${dateClean}.xlsx`

  return { workbook: wb, filename }
}

/**
 * Generates an Excel file with the overall attendance matrix
 * @param {Object} data - Data object containing module, sessions, students, and matrix
 * @returns {void}
 */
export const buildAttendanceWorkbook = (data) => {
  if (!data || !Array.isArray(data.matrix)) {
    throw new Error('An attendance matrix is required.')
  }

  const { module = {}, sessions = [], matrix = [] } = data

  const moduleCode = module.module_code || module.code || ''
  const moduleName = module.module_name || module.name || ''

  // Sort rows by Student Number
  const sortedMatrix = [...matrix].sort(sortByStudentNumber)

  const numSessions = sessions.length
  if (numSessions + 5 > 16384) throw new Error('Workbook exceeds the XLSX column limit.')
  const sessionHeaderLabels = sessions.map((s) => formatSessionDate(s))

  // Title rows
  const semesterPart = module.semester ? `Semester ${module.semester}` : ''
  const batchPart = module.batch ? `Batch ${module.batch}` : ''
  const semesterBatchText = [semesterPart, batchPart].filter(Boolean).join(' | ')

  const titleRows = [
    FACULTY_HEADER,
    `${moduleCode} - ${moduleName}`,
  ]

  if (semesterBatchText) {
    titleRows.push(semesterBatchText)
  }

  titleRows.push(`Total Sessions: ${numSessions}`)

  const rows = []
  titleRows.forEach((title) => {
    rows.push([title])
  })

  // Blank row before table header
  rows.push([])

  // Table header row:
  // No | Student Number | one column per session (dd/mm/yyyy) | No. of Presents | No. of Absents | Attendance %
  const headerRowIndex = rows.length // 0-indexed
  const headerRowNumber = headerRowIndex + 1 // 1-indexed

  rows.push([
    'No',
    'Student Number',
    ...sessionHeaderLabels,
    'No. of Presents',
    'No. of Absents',
    'Attendance %',
  ])

  const totalCols = numSessions + 5

  // Formula column letters (Col 0 = A, Col 1 = B, Col 2 = C...)
  const firstSessionColLetter = getExcelColumnLetter(2) // Col C
  const lastSessionColLetter = numSessions > 0 ? getExcelColumnLetter(2 + numSessions - 1) : null
  const presentsColLetter = getExcelColumnLetter(2 + numSessions)
  const absentsColLetter = getExcelColumnLetter(2 + numSessions + 1)

  const dataStartRow = rows.length + 1 // 1-indexed

  sortedMatrix.forEach((row, idx) => {
    const rowNum = dataStartRow + idx
    const sessionVals = row.session_values || []
    if (sessionVals.length !== numSessions || sessionVals.some(v => ![1, 0, 'ex', null].includes(v))) {
      throw new Error('Matrix values must match the session columns.')
    }

    let presentsCount = 0
    let absentsCount = 0
    sessionVals.forEach((v) => {
      if (v === 1 || v === 'ex') presentsCount++
      else if (v === 0) absentsCount++
    })
    const pctValue = attendanceMetrics(presentsCount, presentsCount + absentsCount).percentage

    const rowData = [
      idx + 1,
      literal(row.reg_no),
      ...sessionVals.map(v => v === null ? literal('N/A') : v),
    ]

    if (numSessions > 0 && lastSessionColLetter) {
      // Presents formula: 1s + 'ex'
      rowData.push({
        t: 'n',
        f: `COUNTIF(${firstSessionColLetter}${rowNum}:${lastSessionColLetter}${rowNum}, 1)+COUNTIF(${firstSessionColLetter}${rowNum}:${lastSessionColLetter}${rowNum}, "ex")`,
        v: presentsCount,
      })
      // Absents formula: 0s
      rowData.push({
        t: 'n',
        f: `COUNTIF(${firstSessionColLetter}${rowNum}:${lastSessionColLetter}${rowNum}, 0)`,
        v: absentsCount,
      })
      // Attendance % formula: Presents / Total Sessions * 100
      rowData.push({
        t: 'n',
        f: `IF((${presentsColLetter}${rowNum}+${absentsColLetter}${rowNum})>0, ROUND(${presentsColLetter}${rowNum}/(${presentsColLetter}${rowNum}+${absentsColLetter}${rowNum})*100, 2), 0)`,
        v: pctValue,
        z: '0.00',
      })
    } else {
      rowData.push(
        presentsCount,
        absentsCount,
        { t: 'n', v: pctValue, z: '0.00' }
      )
    }

    rows.push(rowData)
  })

  const dataEndRow = dataStartRow + Math.max(0, sortedMatrix.length - 1)

  const ws = XLSX.utils.aoa_to_sheet(rows)

  sortedMatrix.forEach((row, index) => {
    sessions.forEach((session, column) => {
      if (row.conflicts?.includes(session.id)) {
        ws[`${getExcelColumnLetter(column + 2)}${dataStartRow + index}`].c = [{ a: 'Attendance report', t: 'Conflicting records require lecturer review. No attendance credit is assigned.' }]
      }
    })
  })

  // Title merges & styles
  ws['!merges'] = []
  for (let r = 0; r < titleRows.length; r++) {
    ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: totalCols - 1 } })
    const cellAddr = `A${r + 1}`
    if (ws[cellAddr]) {
      ws[cellAddr].s = {
        font: { bold: true, sz: r === 0 ? 13 : 11, name: 'Calibri' },
        alignment: { horizontal: 'center', vertical: 'center' },
      }
    }
  }

  // Row heights: set header row height so rotated headers are readable
  ws['!rows'] = []
  for (let r = 0; r < titleRows.length; r++) {
    ws['!rows'][r] = { hpt: 22 }
  }
  ws['!rows'][titleRows.length] = { hpt: 10 } // blank row
  ws['!rows'][headerRowIndex] = { hpt: 65, hpx: 85 } // readable rotated headers

  // Table header styling:
  // bold, grey fill, centered, thin borders.
  // Session date headers rotated 90 degrees.
  // "No. of Presents", "No. of Absents", and "Attendance %" headers use light pink fill.
  for (let c = 0; c < totalCols; c++) {
    const colLetter = getExcelColumnLetter(c)
    const cellAddr = `${colLetter}${headerRowNumber}`
    if (ws[cellAddr]) {
      const isDateCol = c >= 2 && c < 2 + numSessions
      const isSummaryCol = c >= 2 + numSessions

      ws[cellAddr].s = {
        font: { bold: true, sz: 10, name: 'Calibri' },
        fill: { fgColor: { rgb: isSummaryCol ? 'FCE7F3' : 'E5E7EB' } },
        alignment: isDateCol
          ? { textRotation: 90, horizontal: 'center', vertical: 'center' }
          : { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder,
      }
    }
  }

  // Data rows styling:
  // thin borders on every cell, values centered.
  // Attendance % with 2 decimals.
  // Light blue fill on "ex" cells, light red fill on Attendance % cell when below 80.
  for (let r = dataStartRow; r <= dataEndRow; r++) {
    ws['!rows'][r - 1] = { hpt: 20 }
    for (let c = 0; c < totalCols; c++) {
      const colLetter = getExcelColumnLetter(c)
      const cellAddr = `${colLetter}${r}`
      if (ws[cellAddr]) {
        const isEx = ws[cellAddr].v === 'ex'
        const isPctCol = c === 2 + numSessions + 2
        const values = isPctCol ? sortedMatrix[r - dataStartRow]?.session_values || [] : []
        const isBelow80 = isPctCol && !attendanceMetrics(values.filter(v => v === 1 || v === 'ex').length, values.filter(v => v !== null).length).eligible

        ws[cellAddr].s = {
          font: { sz: 10, name: 'Calibri' },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: thinBorder,
          fill: isEx
            ? { fgColor: { rgb: 'DBEAFE' } }
            : isBelow80
            ? { fgColor: { rgb: 'FEE2E2' } }
            : undefined,
        }

        if (isPctCol) {
          ws[cellAddr].z = '0.00'
        }
      }
    }
  }

  // Column widths: No 6, Student Number 16, session columns 6-8 (7), summary columns 10
  const columnWidths = [
    { wch: 6 },  // No
    { wch: 16 }, // Student Number
  ]
  for (let i = 0; i < numSessions; i++) {
    columnWidths.push({ wch: 7 }) // session columns (6-8)
  }
  columnWidths.push({ wch: 10 }) // No. of Presents
  columnWidths.push({ wch: 10 }) // No. of Absents
  columnWidths.push({ wch: 10 }) // Attendance %

  ws['!cols'] = columnWidths

  // Freeze panes below the header row and after the Student Number column
  ws['!freeze'] = { xSplit: 2, ySplit: headerRowNumber }
  ws['!views'] = [
    {
      state: 'frozen',
      xSplit: 2,
      ySplit: headerRowNumber,
      topLeftCell: `C${headerRowNumber + 1}`,
      activePane: 'bottomRight',
    },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance Matrix')

  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]
  const filename = `Attendance_Matrix_${moduleCode || 'Module'}_${dateStr}.xlsx`

  return { workbook: wb, filename }
}


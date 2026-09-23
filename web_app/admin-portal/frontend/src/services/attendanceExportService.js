import axios from 'axios'
import * as XLSX from 'xlsx'
import { auth } from '../firebase/firebase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
})

const getIdToken = async () => {
  const currentUser = auth.currentUser
  if (!currentUser) {
    throw new Error('You must be logged in to download attendance records.')
  }

  return currentUser.getIdToken()
}

/**
 * Fetches attendance records for a module
 * @param {string} moduleId - The module ID
 * @param {string} startDate - Optional start date (ISO format)
 * @param {string} endDate - Optional end date (ISO format)
 * @returns {Promise<Object>} Module and attendance data
 */
export const fetchAttendanceData = async (moduleId, startDate, endDate) => {
  const token = await getIdToken()

  try {
    const params = new URLSearchParams({ moduleId })
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)

    const response = await api.get(`/api/attendance/export?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return response.data
  } catch (error) {
    const message = error?.response?.data?.message
    throw new Error(message || 'Unable to fetch attendance records.')
  }
}

/**
 * Formats a date to DD/MM/YYYY format
 * @param {string} dateString - ISO format date string
 * @returns {string} Formatted date
 */
const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return dateString
  }
}

/**
 * Formats a time to HH:MM format
 * @param {string} dateString - ISO format date string
 * @returns {string} Formatted time
 */
const formatTime = (dateString) => {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return dateString
  }
}

/**
 * Generates an Excel file with attendance records
 * @param {Object} data - Data object containing module and attendance_records
 * @returns {void} Triggers the download
 */
export const generateAndDownloadExcel = (data) => {
  if (!data || !data.attendance_records || data.attendance_records.length === 0) {
    throw new Error('No attendance records found to export.')
  }

  const { module, attendance_records } = data

  // Prepare data for Excel
  const excelData = attendance_records.map((record) => ({
    'Module Name': module.module_name || module.name || '',
    'Module Code': module.module_code || module.code || '',
    'Student Reg No': record.student_reg_no || 'N/A',
    'Student Name': record.student_name || 'N/A',
    'Date': formatDate(record.timestamp || record.date),
    'Time': formatTime(record.timestamp || record.date),
    'Status': record.status || 'N/A',
    'Session ID': record.session_id || 'N/A',
  }))

  // Create a workbook and add the data
  const ws = XLSX.utils.json_to_sheet(excelData)

  // Auto-size columns
  const columnWidths = [
    { wch: 20 }, // Module Name
    { wch: 15 }, // Module Code
    { wch: 18 }, // Student Reg No
    { wch: 20 }, // Student Name
    { wch: 12 }, // Date
    { wch: 10 }, // Time
    { wch: 12 }, // Status
    { wch: 15 }, // Session ID
  ]
  ws['!cols'] = columnWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance')

  // Generate filename
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]
  const filename = `Attendance_${module.module_name || module.code || 'Export'}_${dateStr}.xlsx`

  // Trigger download
  XLSX.writeFile(wb, filename)
}

/**
 * Downloads attendance records as Excel file
 * @param {string} moduleId - The module ID
 * @param {string} startDate - Optional start date
 * @param {string} endDate - Optional end date
 * @returns {Promise<void>}
 */
export const downloadAttendanceExcel = async (moduleId, startDate = null, endDate = null) => {
  const data = await fetchAttendanceData(moduleId, startDate, endDate)
  generateAndDownloadExcel(data)
}

import axios from 'axios'
import XLSX from 'xlsx-js-style'
import { auth } from '../firebase/firebase'

import { buildAttendanceWorkbook, buildSessionWorkbook } from './attendanceWorkbook'
export { FACULTY_HEADER } from './attendanceWorkbook'
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
 * Fetches per-session attendance report data
 * @param {string} sessionId - The active_sessions doc ID
 * @returns {Promise<Object>}
 */
export const fetchSessionReportData = async (sessionId) => {
  const token = await getIdToken()

  try {
    const response = await api.get(`/api/attendance/session/${sessionId}/report`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return response.data
  } catch (error) {
    const message = error?.response?.data?.message
    throw new Error(message || 'Unable to fetch session report.')
  }
}


export const downloadSessionExcel = async (sessionId) => {
  const { workbook, filename } = buildSessionWorkbook(await fetchSessionReportData(sessionId))
  XLSX.writeFile(workbook, filename)
}
export const generateAndDownloadExcel = (data) => {
  const { workbook, filename } = buildAttendanceWorkbook(data)
  XLSX.writeFile(workbook, filename)
}
export const downloadAttendanceExcel = async (moduleId, startDate = null, endDate = null) => {
  generateAndDownloadExcel(await fetchAttendanceData(moduleId, startDate, endDate))
}

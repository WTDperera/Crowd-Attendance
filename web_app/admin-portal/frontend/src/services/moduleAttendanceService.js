import axios from 'axios'
import { auth } from '../firebase/firebase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
})

const getIdToken = async () => {
  const currentUser = auth.currentUser
  if (!currentUser) {
    throw new Error('You must be logged in to view attendance.')
  }

  return currentUser.getIdToken()
}

export const getModuleAttendanceSummary = async (moduleId) => {
  const token = await getIdToken()

  try {
    const response = await api.get(`/api/modules/${moduleId}/attendance-summary`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return response.data
  } catch (error) {
    const message = error?.response?.data?.message
    throw new Error(message || 'Unable to fetch attendance summary.')
  }
}

export const getStudentAttendanceDetails = async (moduleId, uid) => {
  const token = await getIdToken()

  try {
    const response = await api.get(
      `/api/modules/${moduleId}/students/${uid}/attendance-details`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    return response.data.records || []
  } catch (error) {
    const message = error?.response?.data?.message
    throw new Error(message || 'Unable to fetch attendance details.')
  }
}

/**
 * Fetches all sessions for a module owned by the lecturer
 * @param {string} moduleId
 * @returns {Promise<Array>}
 */
export const getModuleSessions = async (moduleId) => {
  const token = await getIdToken()

  try {
    const response = await api.get(`/api/attendance/sessions?moduleId=${moduleId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return response.data.sessions || []
  } catch (error) {
    const message = error?.response?.data?.message
    throw new Error(message || 'Unable to fetch module sessions.')
  }
}

/**
 * Fetches per-session attendance report and student records
 * @param {string} sessionId
 * @returns {Promise<Object>}
 */
export const getSessionReport = async (sessionId) => {
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

/**
 * Manually marks or updates a student's attendance for a session
 * @param {string} sessionId
 * @param {string} studentUid
 * @param {'Present'|'Absent'|'Excused'|'Late'} status
 * @returns {Promise<Object>}
 */
export const markStudentAttendance = async (sessionId, studentUid, status) => {
  const token = await getIdToken()

  try {
    const response = await api.post(
      `/api/attendance/session/${sessionId}/mark`,
      {
        student_uid: studentUid,
        status,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    return response.data
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error.message
    throw new Error(message || 'Unable to mark student attendance.')
  }
}


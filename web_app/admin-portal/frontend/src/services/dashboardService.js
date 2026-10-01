import axios from 'axios'
import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from '../firebase/firebase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
})

const getIdToken = async () => {
  let currentUser = auth.currentUser
  if (!currentUser && typeof auth.authStateReady === 'function') {
    await auth.authStateReady()
    currentUser = auth.currentUser
  }

  if (!currentUser) {
    throw new Error('You must be logged in to view dashboard data.')
  }

  return currentUser.getIdToken()
}

const normalizeModuleId = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toUpperCase()
}

const getOwnModules = async (lecturerId) => {
  if (!lecturerId) {
    return []
  }

  const modulesQuery = query(
    collection(db, 'modules'),
    where('lecturer_id', '==', lecturerId)
  )
  const snapshot = await getDocs(modulesQuery)

  return snapshot.docs
    .map((moduleDoc) => {
      const data = moduleDoc.data() || {}
      const moduleId = normalizeModuleId(data.code || moduleDoc.id)
      if (!moduleId) {
        return null
      }

      return {
        moduleId,
        moduleName: data.name || '',
        enrollment_enabled: Boolean(data.enrollment_enabled),
      }
    })
    .filter(Boolean)
}

export const getStudentCountPerModule = async (lecturerId) => {
  const [modules, studentsSnapshot] = await Promise.all([
    getOwnModules(lecturerId),
    getDocs(collection(db, 'students')),
  ])

  const moduleCounts = new Map()
  modules.forEach((module) => {
    moduleCounts.set(module.moduleId, 0)
  })

  const ownModuleIds = new Set(moduleCounts.keys())
  let totalDistinctStudents = 0

  studentsSnapshot.docs.forEach((studentDoc) => {
    const data = studentDoc.data() || {}
    const enrolledModuleIds = Array.isArray(data.enrolled_module_ids)
      ? data.enrolled_module_ids
      : []
    const normalizedIds = enrolledModuleIds.map(normalizeModuleId)

    if (normalizedIds.some((id) => ownModuleIds.has(id))) {
      totalDistinctStudents += 1
    }

    normalizedIds.forEach((normalizedId) => {
      if (!normalizedId || !moduleCounts.has(normalizedId)) {
        return
      }

      moduleCounts.set(normalizedId, moduleCounts.get(normalizedId) + 1)
    })
  })

  const result = modules
    .map((module) => {
      const count = moduleCounts.get(module.moduleId) || 0
      const percentage =
        totalDistinctStudents === 0
          ? 0
          : Math.round((count / totalDistinctStudents) * 100)

      return {
        moduleId: module.moduleId,
        code: module.moduleId,
        moduleName: module.moduleName,
        name: module.moduleName,
        count,
        enrolledCount: count,
        totalStudents: totalDistinctStudents,
        percentage,
      }
    })
    .sort((a, b) => a.moduleId.localeCompare(b.moduleId, undefined, { numeric: true }))

  result.totalStudents = totalDistinctStudents
  return result
}

export const getTotalModulesCount = async (lecturerId) => {
  const modules = await getOwnModules(lecturerId)
  return modules.length
}

// Total number of documents in the students collection.
export const getTotalStudentsCount = async () => {
  const snapshot = await getCountFromServer(collection(db, 'students'))
  return snapshot.data().count
}

export const getActiveSessionsCount = async (lecturerId) => {
  if (!lecturerId) {
    return 0
  }

  const sessionsQuery = query(
    collection(db, 'active_sessions'),
    where('lecturer_id', '==', lecturerId),
    where('status', '==', 'active')
  )
  const snapshot = await getDocs(sessionsQuery)
  return snapshot.size
}

export const getEnrollmentEnabledModulesCount = async (lecturerId) => {
  const modules = await getOwnModules(lecturerId)
  return modules.filter((module) => module.enrollment_enabled).length
}

export const getDashboardSummary = async (lecturerId) => {
  const token = await getIdToken()
  const response = await api.get('/api/attendance/dashboard-summary', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: lecturerId ? { lecturerId } : {},
  })

  const data = response.data
  return Array.isArray(data) ? data : (data?.modules || [])
}

export const getAttendancePerformancePerModule = async (lecturerId) => {
  const rawModules = await getDashboardSummary(lecturerId)

  return rawModules
    .map((mod) => ({
      code: mod.code || mod.moduleId || '',
      moduleId: mod.code || mod.moduleId || '',
      name: mod.name || mod.moduleName || '',
      moduleName: mod.name || mod.moduleName || '',
      enrolledCount: Number(mod.enrolledCount) || 0,
      completedSessions: Number(mod.completedSessions) || 0,
      presentMarks: Number(mod.presentMarks) || 0,
      absentMarks: Number(mod.absentMarks) || 0,
      percentage: Number(mod.percentage) || 0,
    }))
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
}
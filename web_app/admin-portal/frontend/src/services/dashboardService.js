import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase/firebase'

const normalizeModuleId = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toUpperCase()
}

const getCountForModule = (student, prefix, moduleId) => {
  const mapVal = student?.[prefix]?.[moduleId]
  if (mapVal !== undefined && mapVal !== null) {
    return Number(mapVal)
  }

  const flatVal = student?.[`${prefix}.${moduleId}`]
  if (flatVal !== undefined && flatVal !== null) {
    return Number(flatVal)
  }

  return 0
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

  return modules
    .map((module) => {
      const count = moduleCounts.get(module.moduleId) || 0
      const percentage =
        totalDistinctStudents === 0
          ? 0
          : Math.round((count / totalDistinctStudents) * 100)

      return {
        moduleId: module.moduleId,
        moduleName: module.moduleName,
        count,
        percentage,
      }
    })
    .sort((a, b) => {
      if (b.percentage !== a.percentage) {
        return b.percentage - a.percentage
      }
      return a.moduleId.localeCompare(b.moduleId)
    })
}

export const getTotalModulesCount = async (lecturerId) => {
  const modules = await getOwnModules(lecturerId)
  return modules.length
}

// Distinct students enrolled in any module owned by this lecturer.
export const getTotalStudentsCount = async (lecturerId) => {
  const modules = await getOwnModules(lecturerId)
  const ownModuleIds = new Set(modules.map((module) => module.moduleId))

  if (ownModuleIds.size === 0) {
    return 0
  }

  const studentsSnapshot = await getDocs(collection(db, 'students'))
  let count = 0

  studentsSnapshot.docs.forEach((studentDoc) => {
    const data = studentDoc.data() || {}
    const enrolledModuleIds = Array.isArray(data.enrolled_module_ids)
      ? data.enrolled_module_ids
      : []

    const isEnrolledInOwnModule = enrolledModuleIds.some((moduleId) =>
      ownModuleIds.has(normalizeModuleId(moduleId))
    )

    if (isEnrolledInOwnModule) {
      count += 1
    }
  })

  return count
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

export const getAttendancePerformancePerModule = async (lecturerId) => {
  const [modules, studentsSnapshot] = await Promise.all([
    getOwnModules(lecturerId),
    getDocs(collection(db, 'students')),
  ])

  const moduleTotals = new Map()
  modules.forEach((module) => {
    moduleTotals.set(module.moduleId, { present: 0, absent: 0 })
  })

  studentsSnapshot.docs.forEach((studentDoc) => {
    const data = studentDoc.data() || {}
    const enrolledModuleIds = Array.isArray(data.enrolled_module_ids)
      ? data.enrolled_module_ids
      : []

    enrolledModuleIds.forEach((moduleId) => {
      const normalizedId = normalizeModuleId(moduleId)
      if (!normalizedId || !moduleTotals.has(normalizedId)) {
        return
      }

      const present = getCountForModule(
        data,
        'attendance_counts',
        normalizedId
      )
      const absent = getCountForModule(
        data,
        'absence_counts',
        normalizedId
      )

      const totals = moduleTotals.get(normalizedId)
      totals.present += present
      totals.absent += absent
    })
  })

  return modules
    .map((module) => {
      const totals = moduleTotals.get(module.moduleId) || {
        present: 0,
        absent: 0,
      }
      const total = totals.present + totals.absent
      const percentage = total === 0 ? 0 : Math.round((totals.present / total) * 100)

      return {
        moduleId: module.moduleId,
        moduleName: module.moduleName,
        percentage,
      }
    })
    .sort((a, b) => {
      if (b.percentage !== a.percentage) {
        return b.percentage - a.percentage
      }
      return a.moduleId.localeCompare(b.moduleId)
    })
}
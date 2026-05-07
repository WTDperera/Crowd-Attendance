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

export const getStudentCountPerModule = async () => {
  const modulesRef = collection(db, 'modules')
  const studentsRef = collection(db, 'students')

  const [modulesSnapshot, studentsSnapshot] = await Promise.all([
    getDocs(modulesRef),
    getDocs(studentsRef),
  ])

  const modules = modulesSnapshot.docs
    .map((moduleDoc) => {
      const data = moduleDoc.data() || {}
      const moduleId = normalizeModuleId(data.code || moduleDoc.id)
      if (!moduleId) {
        return null
      }

      return {
        moduleId,
        moduleName: data.name || '',
      }
    })
    .filter(Boolean)

  const moduleCounts = new Map()
  modules.forEach((module) => {
    moduleCounts.set(module.moduleId, 0)
  })

  studentsSnapshot.docs.forEach((studentDoc) => {
    const data = studentDoc.data() || {}
    const enrolledModuleIds = Array.isArray(data.enrolled_module_ids)
      ? data.enrolled_module_ids
      : []

    enrolledModuleIds.forEach((moduleId) => {
      const normalizedId = normalizeModuleId(moduleId)
      if (!normalizedId || !moduleCounts.has(normalizedId)) {
        return
      }

      moduleCounts.set(normalizedId, moduleCounts.get(normalizedId) + 1)
    })
  })

  return modules
    .map((module) => ({
      moduleId: module.moduleId,
      moduleName: module.moduleName,
      count: moduleCounts.get(module.moduleId) || 0,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count
      }
      return a.moduleId.localeCompare(b.moduleId)
    })
}

export const getTotalModulesCount = async () => {
  const snapshot = await getDocs(collection(db, 'modules'))
  return snapshot.size
}

export const getTotalLecturersCount = async () => {
  const snapshot = await getDocs(collection(db, 'lecturers'))
  return snapshot.size
}

export const getActiveSessionsCount = async () => {
  const sessionsQuery = query(
    collection(db, 'active_sessions'),
    where('status', '==', 'active')
  )
  const snapshot = await getDocs(sessionsQuery)
  return snapshot.size
}

export const getEnrollmentEnabledModulesCount = async () => {
  const modulesQuery = query(
    collection(db, 'modules'),
    where('enrollment_enabled', '==', true)
  )
  const snapshot = await getDocs(modulesQuery)
  return snapshot.size
}

export const getAttendancePerformancePerModule = async () => {
  const modulesRef = collection(db, 'modules')
  const studentsRef = collection(db, 'students')

  const [modulesSnapshot, studentsSnapshot] = await Promise.all([
    getDocs(modulesRef),
    getDocs(studentsRef),
  ])

  const modules = modulesSnapshot.docs
    .map((moduleDoc) => {
      const data = moduleDoc.data() || {}
      const moduleId = normalizeModuleId(data.code || moduleDoc.id)
      if (!moduleId) {
        return null
      }

      return {
        moduleId,
        moduleName: data.name || '',
      }
    })
    .filter(Boolean)

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

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore'
import { auth, db } from '../firebase/firebase'
import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000' })
const request = async (method, path, data) => {
  if (!auth.currentUser) throw new Error('You must be logged in to manage modules.')
  const token = await auth.currentUser.getIdToken()
  try {
    return (await api.request({ method, url: path, data, headers: { Authorization: `Bearer ${token}` } })).data
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Unable to manage this module right now.')
  }
}

const modulesCollection = collection(db, 'modules')

const mapModuleDoc = (moduleDoc) => {
  const data = moduleDoc.data() || {}
  return {
    id: moduleDoc.id,
    ...data,
    code: data.code || moduleDoc.id,
    name: data.name || '',
    lecturer_id: data.lecturer_id || '',
    total_sessions: Number(data.total_sessions || 0),
    session_dates: Array.isArray(data.session_dates) ? data.session_dates : [],
    enrollment_enabled:
      typeof data.enrollment_enabled === 'boolean'
        ? data.enrollment_enabled
        : true,
  }
}

// Only returns modules owned by the given lecturer. A lecturer must never
// see or act on modules created by someone else.
export const listenModules = (lecturerId, callback, onError) => {
  if (!lecturerId) {
    callback([])
    return () => {}
  }

  const modulesQuery = query(
    modulesCollection,
    where('lecturer_id', '==', lecturerId)
  )

  return onSnapshot(
    modulesQuery,
    (snapshot) => {
      const rows = snapshot.docs
        .map(mapModuleDoc)
        .sort((a, b) => a.code.localeCompare(b.code))

      callback(rows)
    },
    (error) => {
      if (onError) {
        onError(error)
      }
    }
  )
}

export const createModule = async ({
  code,
  name,
  lecturer_id,
  enrollment_enabled = true,
  enrollment_password_hash,
}) => {
  const trimmedCode = code.trim().toUpperCase()
  if (!trimmedCode) {
    throw new Error('Module code is required.')
  }

  if (!enrollment_password_hash) {
    throw new Error('Enrollment password is required.')
  }

  await request('POST', '/api/modules', {
    code: trimmedCode, name: name.trim(), lecturer_id: lecturer_id.trim(),
    enrollment_enabled: Boolean(enrollment_enabled), enrollment_password_hash,
  })
}

export const updateModule = async (code, patch, requesterId) => {
  if (!requesterId || auth.currentUser?.uid !== requesterId) {
    throw new Error('You do not have permission to edit this module.')
  }
  const nextPatch = {
    name: patch.name.trim(),
    lecturer_id: patch.lecturer_id.trim(),
    enrollment_enabled: typeof patch.enrollment_enabled === 'boolean' ? patch.enrollment_enabled : true,
  }
  if (patch.enrollment_password_hash) nextPatch.enrollment_password_hash = patch.enrollment_password_hash
  await request('PATCH', `/api/modules/${encodeURIComponent(code.trim().toUpperCase())}`, nextPatch)
}

export const deleteModule = async (code, requesterId) => {
  if (!requesterId || auth.currentUser?.uid !== requesterId) {
    throw new Error('You do not have permission to delete this module.')
  }
  await request('DELETE', `/api/modules/${encodeURIComponent(code.trim().toUpperCase())}`)
}

export const getModuleById = async (moduleId, requesterId) => {
  const trimmedCode = moduleId.trim().toUpperCase()
  if (!trimmedCode) throw new Error('Module code is required.')
  const snapshot = await getDoc(doc(db, 'modules', trimmedCode))
  if (!snapshot.exists()) return null
  const moduleData = mapModuleDoc(snapshot)
  if (!requesterId || moduleData.lecturer_id !== requesterId) return null
  return moduleData
}

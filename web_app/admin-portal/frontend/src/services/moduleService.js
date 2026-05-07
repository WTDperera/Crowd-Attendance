import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase/firebase'

const modulesCollection = collection(db, 'modules')

export const listenModules = (callback, onError) => {
  const modulesQuery = query(modulesCollection, orderBy('code'))

  return onSnapshot(
    modulesQuery,
    (snapshot) => {
      const rows = snapshot.docs.map((moduleDoc) => {
        const data = moduleDoc.data() || {}
        return {
          id: moduleDoc.id,
          ...data,
          code: data.code || moduleDoc.id,
          name: data.name || '',
          lecturer_id: data.lecturer_id || '',
          total_sessions: Number(data.total_sessions || 0),
          session_dates: Array.isArray(data.session_dates)
            ? data.session_dates
            : [],
          enrollment_enabled:
            typeof data.enrollment_enabled === 'boolean'
              ? data.enrollment_enabled
              : true,
        }
      })

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

  await setDoc(
    doc(db, 'modules', trimmedCode),
    {
      code: trimmedCode,
      name: name.trim(),
      lecturer_id: lecturer_id.trim(),
      total_sessions: 0,
      session_dates: [],
      enrollment_enabled: Boolean(enrollment_enabled),
      enrollment_password_hash,
      enrollment_password_updated_at: serverTimestamp(),
    },
    { merge: false }
  )
}

export const updateModule = async (code, patch) => {
  const trimmedCode = code.trim().toUpperCase()
  if (!trimmedCode) {
    throw new Error('Module code is required.')
  }

  const nextPatch = {
    name: patch.name.trim(),
    lecturer_id: patch.lecturer_id.trim(),
    enrollment_enabled:
      typeof patch.enrollment_enabled === 'boolean'
        ? patch.enrollment_enabled
        : true,
  }

  if (patch.enrollment_password_hash) {
    nextPatch.enrollment_password_hash = patch.enrollment_password_hash
    nextPatch.enrollment_password_updated_at = serverTimestamp()
  }

  await updateDoc(doc(db, 'modules', trimmedCode), nextPatch)
}

export const deleteModule = async (code) => {
  const trimmedCode = code.trim().toUpperCase()
  if (!trimmedCode) {
    throw new Error('Module code is required.')
  }

  await deleteDoc(doc(db, 'modules', trimmedCode))
}

export const getModuleById = async (moduleId) => {
  const trimmedCode = moduleId.trim().toUpperCase()
  if (!trimmedCode) {
    throw new Error('Module code is required.')
  }

  const snapshot = await getDoc(doc(db, 'modules', trimmedCode))
  if (!snapshot.exists()) {
    return null
  }

  const data = snapshot.data() || {}
  return {
    id: snapshot.id,
    ...data,
    code: data.code || snapshot.id,
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

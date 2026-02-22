import axios from 'axios'
import { auth } from '../firebase/firebase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
})

const getIdToken = async () => {
  const currentUser = auth.currentUser
  if (!currentUser) {
    throw new Error('You must be logged in to manage students.')
  }

  return currentUser.getIdToken()
}

export const addStudent = async (data) => {
  const token = await getIdToken()

  try {
    const response = await api.post(
      '/api/students',
      {
        email: data.email,
        password: data.password,
        reg_no: data.reg_no,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    return response.data
  } catch (error) {
    const message = error?.response?.data?.message
    throw new Error(message || 'Unable to create the student account.')
  }
}

export const getStudents = async () => {
  const token = await getIdToken()

  try {
    const response = await api.get('/api/students', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return response.data.students || []
  } catch (error) {
    const message = error?.response?.data?.message
    throw new Error(message || 'Unable to fetch students.')
  }
}

export const updateStudent = async (uid, data) => {
  const token = await getIdToken()

  try {
    const response = await api.patch(`/api/students/${uid}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return response.data.student
  } catch (error) {
    const message = error?.response?.data?.message
    throw new Error(message || 'Unable to update the student.')
  }
}

export const deleteStudent = async (uid) => {
  const token = await getIdToken()

  try {
    const response = await api.delete(`/api/students/${uid}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return response.data
  } catch (error) {
    const message = error?.response?.data?.message
    throw new Error(message || 'Unable to delete the student.')
  }
}

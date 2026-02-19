import axios from 'axios'
import { auth } from '../firebase/firebase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
})

export const addStudent = async (data) => {
  const currentUser = auth.currentUser
  if (!currentUser) {
    throw new Error('You must be logged in to add students.')
  }

  const token = await currentUser.getIdToken()

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

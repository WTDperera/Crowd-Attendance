import axios from 'axios'
import { auth } from '../firebase/firebase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
})

const getIdToken = async () => {
  const currentUser = auth.currentUser
  if (!currentUser) {
    throw new Error('You must be logged in to view modules.')
  }

  return currentUser.getIdToken()
}

export const getModules = async () => {
  const token = await getIdToken()

  try {
    const response = await api.get('/api/modules', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return response.data.modules || []
  } catch (error) {
    const message = error?.response?.data?.message
    throw new Error(message || 'Unable to fetch modules.')
  }
}

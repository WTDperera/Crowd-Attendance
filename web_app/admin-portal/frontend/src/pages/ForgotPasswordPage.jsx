import { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../firebase/firebase'

function ForgotPassword() {
  const [email, setEmail] = useState('')

  const handleSubmit = async () => {
    if (!email) {
      alert('Please enter your email')
      return
    }

    try {
      await sendPasswordResetEmail(auth, email)
      alert('Password reset email sent! Check your inbox.')
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Forgot Password</h2>

      <input
        type="email"
        placeholder="Enter your email"
        onChange={(e) => setEmail(e.target.value)}
      />

      <br />
      <br />

      <button onClick={handleSubmit}>Send Reset Email</button>
    </div>
  )
}

export default ForgotPassword
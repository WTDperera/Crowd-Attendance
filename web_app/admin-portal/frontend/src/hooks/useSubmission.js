import { useEffect, useRef, useState } from 'react'

// Claim synchronously, before an async request or React's next render. Navigation
// and completion callbacks are suppressed after a form leaves the screen.
export default function useSubmission() {
  const mounted = useRef(false)
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  return {
    busy,
    isMounted: () => mounted.current,
    begin: () => {
      if (pending.current || !mounted.current) return false
      pending.current = true
      setBusy(true)
      return true
    },
    end: () => {
      pending.current = false
      if (mounted.current) setBusy(false)
    },
  }
}

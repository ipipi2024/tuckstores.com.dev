'use client'

import { useEffect } from 'react'

export default function ScrollToBottom() {
  useEffect(() => {
    document.getElementById('thread-end')?.scrollIntoView({ behavior: 'instant' })
  }, [])
  return null
}

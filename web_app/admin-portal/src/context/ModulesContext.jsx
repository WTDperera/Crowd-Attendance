import { createContext, useContext, useMemo, useState } from 'react'
import mockEnrollments from '../data/mockEnrollments.js'
import mockModules from '../data/mockModules.js'
import mockSessions from '../data/mockSessions.js'

const ModulesContext = createContext(null)

export function ModulesProvider({ children }) {
  const [modules, setModules] = useState(mockModules)
  const [sessions, setSessions] = useState(mockSessions)
  const [enrollments, setEnrollments] = useState(mockEnrollments)

  const addModule = (module) => {
    setModules((prev) => [module, ...prev])
    setEnrollments((prev) => {
      if (prev.some((item) => item.module_id === module.id)) {
        return prev
      }
      return [...prev, { module_id: module.id, student_ids: [] }]
    })
  }

  const updateModule = (id, updates) => {
    setModules((prev) =>
      prev.map((module) => (module.id === id ? { ...module, ...updates } : module))
    )
  }

  const deleteModule = (id) => {
    setModules((prev) => prev.filter((module) => module.id !== id))
    setSessions((prev) => prev.filter((session) => session.module_id !== id))
    setEnrollments((prev) => prev.filter((item) => item.module_id !== id))
  }

  const addSession = (session) => {
    setSessions((prev) => [session, ...prev])
  }

  const updateSession = (id, updates) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === id ? { ...session, ...updates } : session
      )
    )
  }

  const deleteSession = (id) => {
    setSessions((prev) => prev.filter((session) => session.id !== id))
  }

  const getModulesWithStats = () => {
    return modules.map((module) => {
      const enrollment = enrollments.find(
        (item) => item.module_id === module.id
      )
      const moduleSessions = sessions.filter(
        (session) => session.module_id === module.id
      )
      const lastSession = moduleSessions
        .slice()
        .sort(
          (a, b) =>
            new Date(b.start_time).getTime() -
            new Date(a.start_time).getTime()
        )[0]

      return {
        ...module,
        studentsCount: enrollment ? enrollment.student_ids.length : 0,
        sessionsCount: moduleSessions.length,
        lastSession,
      }
    })
  }

  const value = useMemo(
    () => ({
      modules,
      sessions,
      enrollments,
      addModule,
      updateModule,
      deleteModule,
      addSession,
      updateSession,
      deleteSession,
      getModulesWithStats,
    }),
    [modules, sessions, enrollments]
  )

  return (
    <ModulesContext.Provider value={value}>
      {children}
    </ModulesContext.Provider>
  )
}

export function useModules() {
  const context = useContext(ModulesContext)
  if (!context) {
    throw new Error('useModules must be used within ModulesProvider')
  }
  return context
}

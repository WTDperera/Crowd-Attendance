import { createContext, useContext, useMemo, useState } from 'react'

const StudentsContext = createContext(null)

const initialStudents = [
  {
    id: 'stu_1001',
    email: 'eg245289@engug.ruh.ac.lk',
    reg_no: 'EG/2022/5289',
    device_id: 'UP1A.231005.007',
    device_locked_at: null,
    last_login: '2026-02-17T18:58:30+05:30',
  },
  {
    id: 'stu_1002',
    email: 'eg244311@engug.ruh.ac.lk',
    reg_no: 'EG/2022/4311',
    device_id: null,
    device_locked_at: null,
    last_login: null,
  },
  {
    id: 'stu_1003',
    email: 'eg243998@engug.ruh.ac.lk',
    reg_no: 'EG/2022/3998',
    device_id: 'TQ3A.230805.001',
    device_locked_at: '2026-02-15T10:15:00+05:30',
    last_login: '2026-02-15T09:30:00+05:30',
  },
  {
    id: 'stu_1004',
    email: 'eg245011@engug.ruh.ac.lk',
    reg_no: 'EG/2022/5011',
    device_id: 'SP1A.210812.016',
    device_locked_at: null,
    last_login: '2026-02-14T08:22:10+05:30',
  },
  {
    id: 'stu_1005',
    email: 'eg246200@engug.ruh.ac.lk',
    reg_no: 'EG/2022/6200',
    device_id: null,
    device_locked_at: '2026-02-10T12:42:45+05:30',
    last_login: '2026-02-09T17:15:10+05:30',
  },
  {
    id: 'stu_1006',
    email: 'eg245180@engug.ruh.ac.lk',
    reg_no: 'EG/2022/5180',
    device_id: 'RQ3A.211201.014',
    device_locked_at: null,
    last_login: null,
  },
  {
    id: 'stu_1007',
    email: 'eg243210@engug.ruh.ac.lk',
    reg_no: 'EG/2021/3210',
    device_id: 'QP1A.220305.021',
    device_locked_at: null,
    last_login: '2026-02-11T11:05:20+05:30',
  },
  {
    id: 'stu_1008',
    email: 'eg245902@engug.ruh.ac.lk',
    reg_no: 'EG/2022/5902',
    device_id: null,
    device_locked_at: null,
    last_login: '2026-01-22T09:40:00+05:30',
  },
  {
    id: 'stu_1009',
    email: 'eg244920@engug.ruh.ac.lk',
    reg_no: 'EG/2022/4920',
    device_id: 'AP2A.240105.003',
    device_locked_at: null,
    last_login: '2026-02-16T14:55:42+05:30',
  },
  {
    id: 'stu_1010',
    email: 'eg241875@engug.ruh.ac.lk',
    reg_no: 'EG/2021/1875',
    device_id: 'RP1A.230707.011',
    device_locked_at: '2026-02-12T15:45:30+05:30',
    last_login: '2026-02-12T13:05:30+05:30',
  },
  {
    id: 'stu_1011',
    email: 'eg246310@engug.ruh.ac.lk',
    reg_no: 'EG/2022/6310',
    device_id: null,
    device_locked_at: null,
    last_login: null,
  },
  {
    id: 'stu_1012',
    email: 'eg244133@engug.ruh.ac.lk',
    reg_no: 'EG/2022/4133',
    device_id: 'UP1A.231005.019',
    device_locked_at: null,
    last_login: '2026-02-17T07:10:25+05:30',
  },
  {
    id: 'stu_1013',
    email: 'eg245415@engug.ruh.ac.lk',
    reg_no: 'EG/2022/5415',
    device_id: 'SP2A.230119.004',
    device_locked_at: null,
    last_login: '2026-02-05T16:18:09+05:30',
  },
  {
    id: 'stu_1014',
    email: 'eg246511@engug.ruh.ac.lk',
    reg_no: 'EG/2022/6511',
    device_id: null,
    device_locked_at: null,
    last_login: null,
  },
  {
    id: 'stu_1015',
    email: 'eg242710@engug.ruh.ac.lk',
    reg_no: 'EG/2021/2710',
    device_id: 'TP1A.221205.002',
    device_locked_at: null,
    last_login: '2026-02-13T12:02:11+05:30',
  },
  {
    id: 'stu_1016',
    email: 'eg245810@engug.ruh.ac.lk',
    reg_no: 'EG/2022/5810',
    device_id: null,
    device_locked_at: '2026-02-16T18:30:00+05:30',
    last_login: null,
  },
  {
    id: 'stu_1017',
    email: 'eg244654@engug.ruh.ac.lk',
    reg_no: 'EG/2022/4654',
    device_id: 'RQ3A.220905.012',
    device_locked_at: null,
    last_login: '2026-02-08T09:15:00+05:30',
  },
  {
    id: 'stu_1018',
    email: 'eg245670@engug.ruh.ac.lk',
    reg_no: 'EG/2022/5670',
    device_id: 'SQ1A.230417.008',
    device_locked_at: '2026-02-17T08:20:00+05:30',
    last_login: '2026-02-17T08:18:00+05:30',
  },
  {
    id: 'stu_1019',
    email: 'eg243455@engug.ruh.ac.lk',
    reg_no: 'EG/2021/3455',
    device_id: null,
    device_locked_at: null,
    last_login: '2026-02-02T10:05:00+05:30',
  },
  {
    id: 'stu_1020',
    email: 'eg246022@engug.ruh.ac.lk',
    reg_no: 'EG/2022/6022',
    device_id: 'UP1A.231005.040',
    device_locked_at: null,
    last_login: '2026-02-16T19:12:40+05:30',
  },
  {
    id: 'stu_1021',
    email: 'eg244002@engug.ruh.ac.lk',
    reg_no: 'EG/2022/4002',
    device_id: null,
    device_locked_at: null,
    last_login: null,
  },
  {
    id: 'stu_1022',
    email: 'eg242405@engug.ruh.ac.lk',
    reg_no: 'EG/2021/2405',
    device_id: 'UP2A.230101.010',
    device_locked_at: null,
    last_login: '2026-02-06T07:40:12+05:30',
  },
]

export function StudentsProvider({ children }) {
  const [students, setStudents] = useState(initialStudents)

  const addStudent = (student) => {
    setStudents((prev) => [student, ...prev])
  }

  const updateStudent = (id, updates) => {
    setStudents((prev) =>
      prev.map((student) =>
        student.id === id ? { ...student, ...updates } : student
      )
    )
  }

  const removeStudent = (id) => {
    setStudents((prev) => prev.filter((student) => student.id !== id))
  }

  const value = useMemo(
    () => ({ students, addStudent, updateStudent, removeStudent }),
    [students]
  )

  return (
    <StudentsContext.Provider value={value}>
      {children}
    </StudentsContext.Provider>
  )
}

export function useStudents() {
  const context = useContext(StudentsContext)
  if (!context) {
    throw new Error('useStudents must be used within StudentsProvider')
  }
  return context
}

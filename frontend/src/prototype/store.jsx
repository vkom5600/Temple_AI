import { createContext, useContext, useReducer, useState, useCallback, useRef } from 'react'
import { USERS, TASKS, ISSUES, BOOKINGS, MESSAGES, MEMORY, ROTA, CHECKINS, OBSERVANCES } from './data'

// Front-end only state. Later each action maps to an API call on the Node backend.
const initial = {
  me: null,
  users: USERS,
  tasks: TASKS,
  issues: ISSUES,
  bookings: BOOKINGS,
  messages: MESSAGES,
  memory: MEMORY,
  chat: [],
  activity: [],
  rota: ROTA,
  checkins: CHECKINS,
  observances: OBSERVANCES,
}

let counter = 1000
const nid = (p) => `${p}${++counter}`
const now = () => new Date().toISOString()

const patchTask = (s, id, fn) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? fn(t) : t)) })
const newTask = (t) => ({ id: nid('t'), status: 'todo', comments: [], notes: '', priority: 'normal', critical: false, kind: 'one-off', ...t })

function reducer(s, a) {
  switch (a.type) {
    case 'login':
      return { ...s, me: a.id }
    case 'logout':
      return { ...s, me: null }

    case 'complete':
      return patchTask(s, a.id, (t) => ({
        ...t,
        status: t.critical ? 'awaiting' : 'done',
        completedBy: s.me,
        completedAt: now(),
        comments: a.note ? [...t.comments, { by: s.me, text: a.note, at: now() }] : t.comments,
      }))
    case 'undo':
      return patchTask(s, a.id, (t) => ({ ...t, status: 'todo', completedBy: null, completedAt: null }))

    case 'flag': {
      const issue = { id: nid('i'), taskId: a.id ?? null, text: a.text, reason: a.reason, by: s.me, at: now(), status: 'open' }
      const s2 = { ...s, issues: [issue, ...s.issues] }
      if (!a.id) return s2
      return patchTask(s2, a.id, (t) => ({ ...t, status: 'flagged', comments: [...t.comments, { by: s.me, text: a.text, at: now() }] }))
    }

    case 'verify':
      return patchTask(s, a.id, (t) => ({ ...t, status: 'verified', verifiedBy: s.me, verifiedAt: now() }))
    case 'reject':
      return patchTask(s, a.id, (t) => ({
        ...t,
        status: 'todo',
        completedBy: null,
        completedAt: null,
        comments: [...t.comments, { by: s.me, text: `Sent back: ${a.note || 'please check again'}`, at: now() }],
      }))

    case 'createTasks':
      return { ...s, tasks: [...a.tasks.map(newTask), ...s.tasks] }
    case 'updateTask':
      return patchTask(s, a.id, (t) => ({ ...t, ...a.patch }))
    case 'deleteTask':
      return { ...s, tasks: s.tasks.filter((t) => t.id !== a.id) }
    case 'remind':
      return patchTask(s, a.id, (t) => ({ ...t, remindedAt: now(), reminders: (t.reminders ?? 0) + 1 }))

    case 'convertIssue': {
      const task = newTask({ ...a.task, source: { issueId: a.id } })
      return {
        ...s,
        tasks: [task, ...s.tasks],
        issues: s.issues.map((i) => (i.id === a.id ? { ...i, status: 'converted', newTaskId: task.id } : i)),
      }
    }
    case 'resolveIssue':
      return { ...s, issues: s.issues.map((i) => (i.id === a.id ? { ...i, status: 'resolved' } : i)) }

    case 'addBooking': {
      const b = { ...a.booking, id: a.booking.id }
      return { ...s, bookings: [...s.bookings, b], tasks: [...a.tasks.map(newTask), ...s.tasks] }
    }

    case 'checkIn':
      return { ...s, checkins: { ...s.checkins, [s.me]: now() } }

    case 'announce':
      return { ...s, messages: [{ id: nid('m'), by: s.me, text: a.text, at: now() }, ...s.messages] }
    case 'logRequest':
      return { ...s, memory: [{ id: nid('n'), by: s.me, text: a.text, at: now(), kind: 'request', status: 'open', verdict: a.verdict }, ...s.memory] }
    case 'closeNote':
      return { ...s, memory: s.memory.map((m) => (m.id === a.id ? { ...m, status: 'closed' } : m)) }
    case 'addMemory':
      return { ...s, memory: [{ id: nid('n'), by: s.me, text: a.text, at: now() }, ...s.memory] }
    case 'chat':
      return { ...s, chat: [...s.chat, ...a.msgs] }
    case 'updateUser':
      return { ...s, users: s.users.map((u) => (u.id === a.id ? { ...u, ...a.patch } : u)) }
    case 'addUser':
      return { ...s, users: [...s.users, { id: nid('u'), ...a.user }] }
    default:
      return s
  }
}

function withLog(s, a) {
  const next = reducer(s, a)
  if (!a.log) return next
  return { ...next, activity: [{ id: nid('a'), text: a.log, at: now(), by: s.me }, ...next.activity].slice(0, 30) }
}

const Ctx = createContext(null)

export function StoreProvider({ children }) {
  const [s, dispatch] = useReducer(withLog, initial)
  const [toast, setToast] = useState(null)
  const timer = useRef()

  // act(action) updates state; if action.toast is set, a small confirmation pops up
  // (stands in for the real email / browser notification that the backend will send).
  const act = useCallback((a) => {
    dispatch(a)
    if (a.toast) {
      setToast({ text: a.toast, id: Date.now() })
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setToast(null), 3500)
    }
  }, [])

  const me = s.users.find((u) => u.id === s.me) ?? null
  return <Ctx.Provider value={{ s, me, act, toast, newId: nid }}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)

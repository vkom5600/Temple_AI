// One place for every call to the backend: adds the login token, parses JSON,
// and turns failures into ApiError with the server's message.

const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api`
const TOKEN_KEY = 'temple_ai_token'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* private mode: stays logged in until the tab closes */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

// Fired when the server says the token is no longer valid; AuthContext logs out.
export const SESSION_EXPIRED_EVENT = 'temple-ai:session-expired'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export async function api<T>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  const token = tokenStore.get()
  let response: Response

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.")
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 401 && token) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
    throw new ApiError(response.status, data.message ?? `Request failed (${response.status})`)
  }

  return data as T
}

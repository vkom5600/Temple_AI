import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Icon } from './ui'

// Small confirmation that pops up at the bottom ("Details saved").
const ToastContext = createContext<(text: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const show = useCallback((text: string) => {
    setToast({ text, id: Date.now() })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="toast" key={toast.id} role="status">
          <Icon name="check" size={16} /> {toast.text}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

// User feedback messages (success / error) shown in the corner.
import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));
  const toast = useCallback((message, type = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => dismiss(id), type === "error" ? 6000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.type === "error" ? "alert" : "status"}
            className={`flex items-start gap-3 rounded-lg border-l-4 bg-ink px-4 py-3 text-sm text-white shadow-lg ${t.type === "error" ? "border-alert" : "border-hivis"}`}>
            {t.type === "error" ? <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#ff8a80]" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-hivis" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-white/60 hover:text-white"><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

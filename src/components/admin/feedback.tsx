"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const FeedbackContext = createContext<(message: string) => void>(() => {});
export const useAdminFeedback = () => useContext(FeedbackContext);

/** Lives above route/row removal so committed feedback and focus survive it. */
export function AdminFeedback({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState({ text: "", revision: 0 });
  const status = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (notice.text) status.current?.focus({ preventScroll: true }); }, [notice]);
  return <FeedbackContext.Provider value={text => setNotice(current => ({ text, revision: current.revision + 1 }))}>
    {notice.text && <p ref={status} role="status" tabIndex={-1} className="alert success">{notice.text}</p>}
    {children}
  </FeedbackContext.Provider>;
}

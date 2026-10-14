"use client";
import { useSyncExternalStore } from "react";
const locked = new Set<string>();
const listeners = new Set<() => void>();
let revision = 0;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function notify() { revision++; listeners.forEach(listener => listener()); }
export function useMutationLocks(keys: string[]) {
  useSyncExternalStore(subscribe, () => revision, () => 0);
  return keys.some(key => locked.has(key));
}
export function acquireMutation(keys: string[]) {
  if (keys.some(key => locked.has(key))) return null;
  keys.forEach(key => locked.add(key)); notify();
  return () => { keys.forEach(key => locked.delete(key)); notify(); };
}

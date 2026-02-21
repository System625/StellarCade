import { useEffect, useState, useRef } from "react";
import GlobalStateStore from "../services/global-state-store";
import type { GlobalState } from "../types/global-state";

export function useGlobalState(store?: GlobalStateStore) {
  const storeRef = useRef<GlobalStateStore | null>(store ?? null);
  if (!storeRef.current) storeRef.current = new GlobalStateStore();

  const [state, setState] = useState<GlobalState>(storeRef.current.getState());

  useEffect(() => {
    const unsub = storeRef.current!.subscribe((s) => setState(s));
    return () => unsub();
  }, []);

  const dispatch = (action: any) => storeRef.current!.dispatch(action);

  return { state, dispatch, store: storeRef.current };
}

export default useGlobalState;

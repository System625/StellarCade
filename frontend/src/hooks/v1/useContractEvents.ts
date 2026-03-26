import { useState, useEffect, useCallback, useRef } from 'react';
import type { UseContractEventsOptions, UseContractEventsResult, ContractEvent } from '../../types/contracts/events';

export function useContractEvents<T = unknown>({
  contractId,
  autoStart = true,
}: UseContractEventsOptions): UseContractEventsResult<T> {
  const [events, setEvents] = useState<ContractEvent<T>[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isListeningRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    if (!contractId) {
      setError(new Error('Contract ID is required'));
      return;
    }
    setError(null);
    setIsListening(true);
    isListeningRef.current = true;
  }, [contractId]);

  const stop = useCallback(() => {
    setIsListening(false);
    isListeningRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    setEvents([]);
    setError(null);
  }, []);

  useEffect(() => {
    if (autoStart) start();
    return () => stop();
  }, [autoStart, start, stop]);

  return { events, isListening, error, start, stop, clear };
}

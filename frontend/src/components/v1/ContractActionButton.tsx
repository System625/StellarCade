import { useMemo, useState } from 'react';
import type { AppError } from '../../types/errors';
import { toAppError } from '../../utils/v1/errorMapper';
import { ErrorNotice } from './ErrorNotice';

export interface ContractActionButtonProps<T = unknown> {
  label: string;
  loadingLabel?: string;
  action: () => Promise<T>;
  walletConnected: boolean;
  networkSupported: boolean;
  disabled?: boolean;
  onSuccess?: (result: T) => void | Promise<void>;
  onError?: (error: AppError) => void | Promise<void>;
  className?: string;
  testId?: string;
}

export function ContractActionButton<T = unknown>({
  label,
  loadingLabel = 'Processing...',
  action,
  walletConnected,
  networkSupported,
  disabled = false,
  onSuccess,
  onError,
  className = '',
  testId = 'contract-action-button',
}: ContractActionButtonProps<T>) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const sanitizedLabel = useMemo(() => {
    const trimmed = label.trim();
    return trimmed.length > 0 ? trimmed : 'Run action';
  }, [label]);

  const blockedReason = useMemo(() => {
    if (!walletConnected) {
      return 'Connect wallet to continue.';
    }
    if (!networkSupported) {
      return 'Switch to a supported network.';
    }
    return null;
  }, [walletConnected, networkSupported]);

  const isDisabled = disabled || isLoading || blockedReason !== null;

  const handleClick = async () => {
    if (isDisabled) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await action();
      await onSuccess?.(result);
    } catch (err) {
      const mapped = toAppError(err);
      setError(mapped);
      await onError?.(mapped);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={className} data-testid={`${testId}-container`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        data-testid={testId}
        aria-busy={isLoading}
        aria-disabled={isDisabled}
      >
        {isLoading ? loadingLabel : sanitizedLabel}
      </button>

      {blockedReason && <p data-testid={`${testId}-precondition`}>{blockedReason}</p>}

      {error && <ErrorNotice error={error} testId={`${testId}-error`} />}
    </div>
  );
}

export default ContractActionButton;

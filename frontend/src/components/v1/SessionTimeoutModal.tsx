/**
 * SessionTimeoutModal — warns before wallet persisted session expires (v1).
 *
 * Polls WalletSessionService.getRemainingPersistenceMs(); offers extend and
 * reconnect after auto-expire.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import WalletSessionService, {
  WALLET_SESSION_EXPIRY_POLL_MS_DEFAULT,
  WALLET_SESSION_WARN_BEFORE_EXPIRY_MS_DEFAULT,
} from '../../services/wallet-session-service';
import { WalletSessionState } from '../../types/wallet-session';

import './SessionTimeoutModal.css';

export interface SessionTimeoutModalProps {
  sessionService: WalletSessionService;
  /** Show modal when remaining persistence time is at or below this (ms). */
  warnBeforeExpiryMs?: number;
  /** Poll interval for remaining time (ms). */
  pollIntervalMs?: number;
  /** After session forced expiry, called so host can refresh wallet UI. */
  onReconnect?: () => void | Promise<void>;
  /** User dismissed the warning (still connected). */
  onDismissWarn?: () => void;
  className?: string;
  testId?: string;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  sessionService,
  warnBeforeExpiryMs = WALLET_SESSION_WARN_BEFORE_EXPIRY_MS_DEFAULT,
  pollIntervalMs = WALLET_SESSION_EXPIRY_POLL_MS_DEFAULT,
  onReconnect,
  onDismissWarn,
  className = '',
  testId = 'session-timeout-modal',
}) => {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [phase, setPhase] = useState<'hidden' | 'warn' | 'expired'>('hidden');
  const [dismissed, setDismissed] = useState(false);
  const expiredHandled = useRef(false);

  const tick = useCallback(() => {
    const state = sessionService.getState();
    if (state !== WalletSessionState.CONNECTED || !sessionService.getMeta()) {
      setRemainingMs(null);
      setPhase('hidden');
      setDismissed(false);
      expiredHandled.current = false;
      return;
    }
    const rem = sessionService.getRemainingPersistenceMs();
    setRemainingMs(rem);

    if (rem === null) {
      setPhase('hidden');
      return;
    }

    if (rem <= 0) {
      if (!expiredHandled.current) {
        expiredHandled.current = true;
        void sessionService.disconnect().finally(() => {
          setPhase('expired');
        });
      } else {
        setPhase('expired');
      }
      return;
    }

    if (rem <= warnBeforeExpiryMs) {
      if (!dismissed) {
        setPhase('warn');
      } else {
        setPhase('hidden');
      }
    } else {
      setPhase('hidden');
      setDismissed(false);
      expiredHandled.current = false;
    }
  }, [sessionService, warnBeforeExpiryMs, dismissed]);

  useEffect(() => {
    tick();
    const id = window.setInterval(tick, pollIntervalMs);
    const unsub = sessionService.subscribe(() => {
      tick();
    });
    return () => {
      window.clearInterval(id);
      unsub();
    };
  }, [tick, pollIntervalMs, sessionService]);

  const secondsLeft =
    remainingMs === null ? 0 : Math.max(0, Math.ceil(remainingMs / 1000));

  const handleExtend = useCallback(() => {
    sessionService.extendPersistedSession();
    setDismissed(false);
    expiredHandled.current = false;
    tick();
  }, [sessionService, tick]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onDismissWarn?.();
  }, [onDismissWarn]);

  const handleReconnect = useCallback(async () => {
    await onReconnect?.();
    expiredHandled.current = false;
    setPhase('hidden');
    setDismissed(false);
  }, [onReconnect]);

  if (phase === 'hidden') {
    return null;
  }

  return (
    <div
      className={`session-timeout-modal__backdrop ${className}`.trim()}
      data-testid={testId}
      role="presentation"
    >
      <div
        className="session-timeout-modal__dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title-${phase}`}
        aria-describedby={`${testId}-desc-${phase}`}
      >
        {phase === 'warn' && (
          <>
            <h2
              id={`${testId}-title-warn`}
              className="session-timeout-modal__title"
            >
              Session expiring soon
            </h2>
            <p
              id={`${testId}-desc-warn`}
              className="session-timeout-modal__body"
            >
              Your wallet session will expire in{' '}
              <strong data-testid={`${testId}-countdown`}>{secondsLeft}</strong>{' '}
              second{secondsLeft === 1 ? '' : 's'}. Extend to stay signed in.
            </p>
            <div className="session-timeout-modal__actions">
              <button
                type="button"
                className="session-timeout-modal__primary"
                data-testid={`${testId}-extend`}
                onClick={handleExtend}
              >
                Extend session
              </button>
              <button
                type="button"
                className="session-timeout-modal__secondary"
                data-testid={`${testId}-dismiss`}
                onClick={handleDismiss}
              >
                Dismiss
              </button>
            </div>
          </>
        )}
        {phase === 'expired' && (
          <>
            <h2
              id={`${testId}-title-expired`}
              className="session-timeout-modal__title"
            >
              Session expired
            </h2>
            <p
              id={`${testId}-desc-expired`}
              className="session-timeout-modal__body"
            >
              Your wallet session has ended. Reconnect to continue playing.
            </p>
            <div className="session-timeout-modal__actions">
              <button
                type="button"
                className="session-timeout-modal__primary"
                data-testid={`${testId}-reconnect`}
                onClick={() => void handleReconnect()}
              >
                Reconnect
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

SessionTimeoutModal.displayName = 'SessionTimeoutModal';

export default SessionTimeoutModal;

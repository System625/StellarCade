/**
 * ContractEventFeed Component — v1
 *
 * Renders a live, ordered, deduplicated stream of Soroban contract events.
 * Supports filter props (event type, contract source, time window), handles
 * disconnected/reconnecting states, and surfaces errors via ErrorNotice.
 *
 * @example
 * ```tsx
 * <ContractEventFeed
 *   contractId="CXXX..."
 *   eventTypeFilter="coin_flip"
 *   timeWindowMs={60_000}
 *   maxEvents={50}
 *   onEventClick={(event) => console.log(event)}
 * />
 * ```
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContractEvents } from '../../hooks/v1/useContractEvents';
import { ErrorNotice } from './ErrorNotice';
import { EmptyStateBlock } from './EmptyStateBlock';
import { toAppError } from '../../utils/v1/errorMapper';
import {
  generateIdempotencyKey,
  InFlightRequestDedupe,
} from '../../utils/v1/idempotency';
import type { ContractEvent } from '../../types/contracts/events';
import './ContractEventFeed.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventSeverity = 'info' | 'warning' | 'error' | 'success';

export interface SeverityMapping {
  [eventType: string]: EventSeverity;
}

export interface FilterChipConfig {
  label: string;
  value: string;
  active: boolean;
  count?: number;
}

export const DEFAULT_SEVERITY_MAPPING: SeverityMapping = {
  game_start: 'info',
  game_end: 'success',
  bet_placed: 'info',
  win: 'success',
  loss: 'error',
  error: 'error',
  warning: 'warning',
  transfer: 'info',
  mint: 'success',
  burn: 'warning',
};

export function getEventSeverity(
  eventType: string | undefined,
  mapping: SeverityMapping = DEFAULT_SEVERITY_MAPPING
): EventSeverity {
  if (!eventType) return 'info';
  const normalizedType = eventType.toLowerCase().replace(/[-_]/g, '_');
  for (const [key, severity] of Object.entries(mapping)) {
    if (normalizedType.includes(key.toLowerCase().replace(/[-_]/g, '_'))) {
      return severity;
    }
  }
  return 'info';
}

export interface ContractEventFeedProps {
  /**
   * The Soroban contract ID to subscribe to.
   * Must be a valid Stellar contract address (C... or G...).
   */
  contractId: string;

  /**
   * Optional filter: only show events matching this type string.
   * Compared case-insensitively against `event.type`.
   */
  eventTypeFilter?: string;

  /**
   * Optional filter: only show events from this contract source address.
   * When omitted, events from all contracts in the stream are shown.
   */
  contractSourceFilter?: string;

  /**
   * Optional filter: only show events newer than this many milliseconds ago.
   * @default undefined (no time filtering)
   */
  timeWindowMs?: number;

  /**
   * Maximum number of events to display (most recent first).
   * @default 100
   */
  maxEvents?: number;

  /**
   * How often to poll for new events, in milliseconds.
   * @default 5000
   */
  pollInterval?: number;

  /**
   * Whether to start listening immediately on mount.
   * @default true
   */
  autoStart?: boolean;

  /**
   * Callback fired when the user clicks an event row.
   */
  onEventClick?: (event: ContractEvent) => void;

  /**
   * Callback fired when the feed emits a new event.
   */
  onNewEvent?: (event: ContractEvent) => void;

  /** Available event type filters as clickable chips. */
  eventTypeFilters?: FilterChipConfig[];

  /** Callback when an event type filter chip is toggled. */
  onEventTypeFilterToggle?: (value: string) => void;

  /** Custom severity mapping for event types. */
  severityMapping?: SeverityMapping;

  /** Custom className applied to the root element. */
  className?: string;

  /** test ID prefix for targeted assertions. */
  testId?: string;
}

// ---------------------------------------------------------------------------
// Connection status badge
// ---------------------------------------------------------------------------

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'idle';

interface StatusBadgeProps {
  status: ConnectionStatus;
  testId?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, testId }) => {
  const labels: Record<ConnectionStatus, string> = {
    connected: 'Live',
    disconnected: 'Disconnected',
    reconnecting: 'Reconnecting…',
    idle: 'Idle',
  };

  return (
    <span
      className={`cef-status-badge cef-status-badge--${status}`}
      data-testid={testId ? `${testId}-status` : 'cef-status'}
      aria-live="polite"
      aria-label={`Feed status: ${labels[status]}`}
    >
      <span className="cef-status-badge__dot" aria-hidden="true" />
      {labels[status]}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Single event row
// ---------------------------------------------------------------------------

interface EventRowProps {
  event: ContractEvent;
  onClick?: (event: ContractEvent) => void;
  severity?: EventSeverity;
  testId?: string;
}

const EventRow: React.FC<EventRowProps> = ({ event, onClick, severity, testId }) => {
  const handleClick = useCallback(() => {
    onClick?.(event);
  }, [event, onClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.(event);
      }
    },
    [event, onClick],
  );

  const timestamp =
    (event.timestamp as any) instanceof Date
      ? (event.timestamp as any)
      : new Date(event.timestamp);

  const timeLabel = isNaN(timestamp.getTime())
    ? '—'
    : timestamp.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

  const isClickable = typeof onClick === 'function';

  return (
    <li
      className={`cef-event-row${isClickable ? ' cef-event-row--clickable' : ''}${severity ? ` cef-event-row--${severity}` : ''}`}
      data-testid={testId ? `${testId}-row-${event.id}` : `cef-row-${event.id}`}
      data-event-id={event.id}
      data-event-type={event.type ?? 'unknown'}
      data-event-severity={severity ?? 'info'}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      tabIndex={isClickable ? 0 : undefined}
      role={isClickable ? 'button' : 'listitem'}
      aria-label={isClickable ? `View event ${event.id}` : undefined}
    >
      <span className="cef-event-row__time" aria-label={`Event time: ${timeLabel}`}>
        {timeLabel}
      </span>

      <span className="cef-event-row__type" aria-label={`Event type: ${event.type ?? 'unknown'}`}>
        {event.type ?? 'unknown'}
      </span>

      <span className="cef-event-row__id" title={event.id} aria-label={`Event ID: ${event.id}`}>
        {event.id.slice(0, 12)}…
      </span>

      {event.contractId && (
        <span
          className="cef-event-row__contract"
          title={event.contractId}
          aria-label={`Contract: ${event.contractId}`}
        >
          {event.contractId.slice(0, 8)}…
        </span>
      )}
    </li>
  );
};

// (dedupe instance is created per-component mount — see useRef below)

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const ContractEventFeed: React.FC<ContractEventFeedProps> = ({
  contractId,
  eventTypeFilter,
  contractSourceFilter,
  timeWindowMs,
  maxEvents = 100,
  pollInterval = 5000,
  autoStart = true,
  onEventClick,
  onNewEvent,
  eventTypeFilters,
  onEventTypeFilterToggle,
  severityMapping = DEFAULT_SEVERITY_MAPPING,
  className = '',
  testId = 'contract-event-feed',
}) => {
  // ── Validation ────────────────────────────────────────────────────────────
  const isContractIdValid =
    typeof contractId === 'string' && contractId.trim().length > 0;

  // ── Hook ─────────────────────────────────────────────────────────────────
  const {
    events: rawEvents,
    isListening,
    error: hookError,
    start,
    stop,
    clear,
  } = useContractEvents({
    contractId: isContractIdValid ? contractId.trim() : '',
    autoStart: autoStart && isContractIdValid,
    pollInterval,
  });

  // ── Connection status ────────────────────────────────────────────────────
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('idle');
  const prevListeningRef = useRef<boolean | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    const prev = prevListeningRef.current;

    if (isListening) {
      reconnectAttemptsRef.current = 0;
      setConnectionStatus('connected');
    } else if (hookError && prev === true) {
      // Was connected, now errored — show reconnecting briefly
      reconnectAttemptsRef.current += 1;
      setConnectionStatus('reconnecting');
    } else if (!isListening && prev === null) {
      setConnectionStatus('idle');
    } else if (!isListening) {
      setConnectionStatus('disconnected');
    }

    prevListeningRef.current = isListening;
  }, [isListening, hookError]);

  // ── Deduplicated + filtered events ───────────────────────────────────────
  // Per-instance dedupe — reset on unmount, not shared across tests/mounts
  const feedDedupeRef = useRef(new InFlightRequestDedupe());
  const seenIdsRef = useRef<Set<string>>(new Set());

  const filteredEvents = useMemo(() => {
    if (!Array.isArray(rawEvents)) return [];

    const now = Date.now();
    const dedupe = feedDedupeRef.current;

    // Step 1: deduplicate — use a local Set to catch same-batch duplicates,
    // then idempotency key for cross-render dedup
    const batchSeen = new Set<string>();
    const uniqueEvents = rawEvents.filter((event): event is ContractEvent => {
      if (!event || typeof event.id !== 'string') return false;

      // Reject if already seen in this same batch
      if (batchSeen.has(event.id)) return false;
      batchSeen.add(event.id);

      const keyResult = generateIdempotencyKey({
        operation: 'contractEventFeed.event',
        scope: contractId,
        payload: { id: event.id },
      });

      if (!keyResult.success || !keyResult.key) return false;

      const reg = dedupe.register(keyResult.key, { ttlMs: 60_000 });
      if (!reg.accepted && !seenIdsRef.current.has(event.id)) return false;

      seenIdsRef.current.add(event.id);
      return true;
    });

    // Step 2: apply filters on the already-deduplicated list
    return uniqueEvents
      .filter((event) => {
        // Event type filter
        if (
          eventTypeFilter !== undefined &&
          eventTypeFilter.trim() !== '' &&
          typeof event.type === 'string' &&
          event.type.toLowerCase() !== eventTypeFilter.trim().toLowerCase()
        ) {
          return false;
        }

        // Contract source filter
        if (
          contractSourceFilter !== undefined &&
          contractSourceFilter.trim() !== '' &&
          event.contractId !== contractSourceFilter.trim()
        ) {
          return false;
        }

        // Time window filter
        if (timeWindowMs !== undefined && timeWindowMs > 0) {
          const ts =
            (event.timestamp as any) instanceof Date
              ? (event.timestamp as any).getTime()
              : typeof event.timestamp === 'string' ||
                  typeof event.timestamp === 'number'
                ? new Date(event.timestamp).getTime()
                : NaN;

          if (isNaN(ts) || now - ts > timeWindowMs) return false;
        }

        return true;
      })
      .slice(0, maxEvents);
  }, [rawEvents, contractId, eventTypeFilter, contractSourceFilter, timeWindowMs, maxEvents]);

  // ── Fire onNewEvent for newly seen events ────────────────────────────────
  const prevEventCountRef = useRef(0);

  useEffect(() => {
    if (!onNewEvent) return;
    const newCount = filteredEvents.length - prevEventCountRef.current;
    if (newCount > 0) {
      filteredEvents.slice(0, newCount).forEach((ev) => onNewEvent(ev));
    }
    prevEventCountRef.current = filteredEvents.length;
  }, [filteredEvents, onNewEvent]);

  // ── Error mapping ────────────────────────────────────────────────────────
  const mappedError = useMemo(() => {
    if (!hookError) return null;
    return toAppError(hookError, 'rpc' as const);
  }, [hookError]);

  // ── Toggle handler ────────────────────────────────────────────────────────
  const handleToggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  const handleClear = useCallback(() => {
    seenIdsRef.current.clear();
    feedDedupeRef.current = new InFlightRequestDedupe();
    prevEventCountRef.current = 0;
    clear();
  }, [clear]);

  // ── Guard: invalid contractId ─────────────────────────────────────────────
  if (!isContractIdValid) {
    return (
      <div
        className={`cef cef--invalid ${className}`.trim()}
        data-testid={testId}
      >
        <EmptyStateBlock
          icon="⚠️"
          title="Invalid Contract"
          description="A valid contract ID is required to subscribe to events."
          testId={`${testId}-invalid`}
        />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const rootClasses = [
    'cef',
    isListening ? 'cef--listening' : 'cef--paused',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={rootClasses}
      data-testid={testId}
      aria-label="Contract Event Feed"
    >
      {/* ── Header ── */}
      <header className="cef__header">
        <div className="cef__header-left">
          <h2 className="cef__title">Contract Events</h2>
          <StatusBadge status={connectionStatus} testId={testId} />
        </div>

        <div className="cef__header-right">
          <span className="cef__count" aria-live="polite" aria-atomic="true">
            {filteredEvents.length > 0
              ? `${filteredEvents.length} event${filteredEvents.length !== 1 ? 's' : ''}`
              : ''}
          </span>

          <button
            type="button"
            className={`cef__toggle-btn cef__toggle-btn--${isListening ? 'pause' : 'resume'}`}
            onClick={handleToggle}
            aria-label={isListening ? 'Pause event feed' : 'Resume event feed'}
            data-testid={`${testId}-toggle`}
          >
            {isListening ? '⏸ Pause' : '▶ Resume'}
          </button>

          <button
            type="button"
            className="cef__clear-btn"
            onClick={handleClear}
            aria-label="Clear all events"
            data-testid={`${testId}-clear`}
            disabled={filteredEvents.length === 0}
          >
            Clear
          </button>
        </div>
      </header>

      {/* ── Active filters strip ── */}
      {(eventTypeFilter || contractSourceFilter || timeWindowMs || (eventTypeFilters && eventTypeFilters.length > 0)) && (
        <div className="cef__filters" aria-label="Active filters" data-testid={`${testId}-filters`}>
          {eventTypeFilters && eventTypeFilters.length > 0 && eventTypeFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`cef__filter-chip cef__filter-chip--toggle${filter.active ? ' cef__filter-chip--active' : ''}`}
              onClick={() => onEventTypeFilterToggle?.(filter.value)}
              aria-pressed={filter.active}
              data-testid={`${testId}-filter-${filter.value}`}
            >
              {filter.label}
              {filter.count !== undefined && (
                <span className="cef__filter-chip__count">{filter.count}</span>
              )}
            </button>
          ))}
          {eventTypeFilter && !eventTypeFilters && (
            <span className="cef__filter-chip">
              type: <strong>{eventTypeFilter}</strong>
            </span>
          )}
          {contractSourceFilter && (
            <span className="cef__filter-chip">
              source: <strong>{contractSourceFilter.slice(0, 10)}…</strong>
            </span>
          )}
          {timeWindowMs && (
            <span className="cef__filter-chip">
              window: <strong>{timeWindowMs / 1000}s</strong>
            </span>
          )}
        </div>
      )}

      {/* ── Error notice ── */}
      {mappedError && (
        <ErrorNotice
          error={mappedError}
          onRetry={start}
          showRetry={true}
          showDismiss={false}
          testId={`${testId}-error`}
        />
      )}

      {/* ── Event list ── */}
      {filteredEvents.length > 0 ? (
        <ol
          className="cef__event-list"
          aria-label={`${filteredEvents.length} contract events`}
          data-testid={`${testId}-list`}
          reversed
        >
        {filteredEvents.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            onClick={onEventClick}
            severity={getEventSeverity(event.type, severityMapping)}
            testId={testId}
          />
        ))}
        </ol>
      ) : (
        !mappedError && (
          <EmptyStateBlock
            icon={isListening ? '📡' : '⏸'}
            title={isListening ? 'Listening for events…' : 'Feed paused'}
            description={
              isListening
                ? 'Events will appear here as they are emitted by the contract.'
                : 'Press Resume to start receiving contract events.'
            }
            testId={`${testId}-empty`}
          />
        )
      )}
    </section>
  );
};

ContractEventFeed.displayName = 'ContractEventFeed';

export default ContractEventFeed;
import React, { useMemo, useState } from 'react';
import {
  devClearContractSimResults,
  devListContractSimKeys,
  devParseMockResultPayload,
  devRegisterContractSimResult,
} from '../../services/soroban-contract-dev';
import { SorobanErrorCode } from '../../types/errors';
import './ContractCallSimulatorPanel.css';

const CONTRACT_ADDR_PLACEHOLDER = 'C…56 chars';

interface SimulatorLogEntry {
  id: number;
  timestamp: string;
  contractId: string;
  method: string;
  mode: 'success' | 'failure';
  payload: string;
  failureCode?: string;
}

interface ContractSimulatorPreset {
  id: string;
  label: string;
  contractId: string;
  method: string;
  mode: 'success' | 'failure';
  payload: string;
  failureCode?: SorobanErrorCode;
}

const PRESETS: ContractSimulatorPreset[] = [
  {
    id: 'pool-state-success',
    label: 'Pool state success',
    contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
    method: 'get_pool_state',
    mode: 'success',
    payload: '{"available":"100","reserved":"20"}',
  },
  {
    id: 'coin-flip-fail',
    label: 'Coin flip simulation failed',
    contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
    method: 'play_coin_flip',
    mode: 'failure',
    payload: 'Simulation failed due to temporary RPC issue',
    failureCode: SorobanErrorCode.SimulationFailed,
  },
];

/**
 * Collapsible dev-only UI to register mocked Soroban simulate / invoke outcomes.
 * Never rendered in production builds (parent should gate on `import.meta.env.DEV`).
 */
export const ContractCallSimulatorPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [contractId, setContractId] = useState('');
  const [method, setMethod] = useState('');
  const [mode, setMode] = useState<'success' | 'failure'>('success');
  const [payload, setPayload] = useState('{}');
  const [failureCode, setFailureCode] = useState<SorobanErrorCode>(
    SorobanErrorCode.RpcError,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [presetId, setPresetId] = useState('');
  const [logEntries, setLogEntries] = useState<SimulatorLogEntry[]>([]);

  const keys = useMemo(
    () => (open ? devListContractSimKeys() : []),
    [open, status],
  );

  const onRegister = () => {
    setStatus(null);
    const result = devParseMockResultPayload(mode, payload, failureCode);
    if (!result.success && mode === 'success') {
      setStatus(`Parse error: ${result.error.message}`);
      return;
    }
    if (!contractId.trim() || !method.trim()) {
      setStatus('Contract ID and method are required.');
      return;
    }
    devRegisterContractSimResult(contractId.trim(), method.trim(), result);
    setLogEntries((prev) => [
      ...prev,
      {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        contractId: contractId.trim(),
        method: method.trim(),
        mode,
        payload,
        failureCode: mode === 'failure' ? failureCode : undefined,
      },
    ]);
    setStatus(`Registered mock for ${method.trim()}.`);
  };

  const onClear = () => {
    devClearContractSimResults();
    setStatus('Cleared all dev mocks.');
  };

  const applyPreset = (nextPresetId: string) => {
    setPresetId(nextPresetId);
    if (!nextPresetId) {
      setContractId('');
      setMethod('');
      setMode('success');
      setPayload('{}');
      setFailureCode(SorobanErrorCode.RpcError);
      setStatus('Cleared preset values.');
      return;
    }

    const preset = PRESETS.find((entry) => entry.id === nextPresetId);
    if (!preset) {
      return;
    }
    setContractId(preset.contractId);
    setMethod(preset.method);
    setMode(preset.mode);
    setPayload(preset.payload);
    setFailureCode(preset.failureCode ?? SorobanErrorCode.RpcError);
    setStatus(`Applied preset: ${preset.label}.`);
  };

  return (
    <aside
      className="contract-call-simulator"
      aria-label="Contract call simulator (development only)"
      data-testid="contract-call-simulator-panel"
    >
      <button
        type="button"
        className="contract-call-simulator__toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-testid="contract-call-simulator-toggle"
      >
        {open ? '▼' : '▶'} Dev: contract mocks
      </button>
      {open && (
        <div className="contract-call-simulator__body">
          <p className="contract-call-simulator__hint">
            Matches any <code>simulate</code> / <code>invoke</code> with the same contract id and method name.
          </p>
          <label className="contract-call-simulator__field contract-call-simulator__preset-field">
            <span>Preset scenario</span>
            <select
              value={presetId}
              onChange={(e) => applyPreset(e.target.value)}
              data-testid="contract-call-simulator-preset"
            >
              <option value="">Manual entry (no preset)</option>
              {PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label className="contract-call-simulator__field">
            <span>Contract ID</span>
            <input
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
              placeholder={CONTRACT_ADDR_PLACEHOLDER}
              spellCheck={false}
              data-testid="contract-call-simulator-contract"
            />
          </label>
          <label className="contract-call-simulator__field">
            <span>Method</span>
            <input
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="e.g. get_pool_state"
              spellCheck={false}
              data-testid="contract-call-simulator-method"
            />
          </label>
          <fieldset className="contract-call-simulator__mode">
            <legend>Outcome</legend>
            <label>
              <input
                type="radio"
                name="ccsim-mode"
                checked={mode === 'success'}
                onChange={() => setMode('success')}
                data-testid="contract-call-simulator-mode-success"
              />{' '}
              Success (JSON body)
            </label>
            <label>
              <input
                type="radio"
                name="ccsim-mode"
                checked={mode === 'failure'}
                onChange={() => setMode('failure')}
                data-testid="contract-call-simulator-mode-failure"
              />{' '}
              Failure (message)
            </label>
          </fieldset>
          {mode === 'failure' && (
            <label className="contract-call-simulator__field">
              <span>Error code</span>
              <select
                value={failureCode}
                onChange={(e) =>
                  setFailureCode(e.target.value as SorobanErrorCode)
                }
                data-testid="contract-call-simulator-failure-code"
              >
                <option value={SorobanErrorCode.RpcError}>RpcError</option>
                <option value={SorobanErrorCode.SimulationFailed}>
                  SimulationFailed
                </option>
                <option value={SorobanErrorCode.InvalidParameter}>
                  InvalidParameter
                </option>
                <option value={SorobanErrorCode.WalletNotConnected}>
                  WalletNotConnected
                </option>
              </select>
            </label>
          )}
          <label className="contract-call-simulator__field">
            <span>{mode === 'success' ? 'JSON data' : 'Error message'}</span>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              rows={6}
              spellCheck={false}
              data-testid="contract-call-simulator-payload"
            />
          </label>
          <div className="contract-call-simulator__actions">
            <button
              type="button"
              onClick={onRegister}
              data-testid="contract-call-simulator-register"
            >
              Register mock
            </button>
            <button
              type="button"
              onClick={onClear}
              data-testid="contract-call-simulator-clear"
            >
              Clear all
            </button>
          </div>
          {status && (
            <p
              className="contract-call-simulator__status"
              role="status"
              data-testid="contract-call-simulator-status"
            >
              {status}
            </p>
          )}
          {keys.length > 0 && (
            <div className="contract-call-simulator__keys" data-testid="contract-call-simulator-keys">
              <strong>Active keys</strong>
              <ul>
                {keys.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Request-response log pane */}
          <div className="contract-call-simulator__log" data-testid="contract-call-simulator-log">
            <div className="contract-call-simulator__log-header">
              <strong>Request Log ({logEntries.length})</strong>
              {logEntries.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLogEntries([])}
                  className="contract-call-simulator__log-clear"
                  data-testid="contract-call-simulator-log-clear"
                >
                  Clear log
                </button>
              )}
            </div>
            {logEntries.length === 0 ? (
              <p
                className="contract-call-simulator__log-empty"
                data-testid="contract-call-simulator-log-empty"
              >
                No requests logged yet. Register a mock to see entries here.
              </p>
            ) : (
              <ul className="contract-call-simulator__log-list">
                {logEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className={`contract-call-simulator__log-entry contract-call-simulator__log-entry--${entry.mode}`}
                    data-testid="contract-call-simulator-log-entry"
                  >
                    <span className="contract-call-simulator__log-time">
                      {entry.timestamp.slice(11, 19)}
                    </span>
                    <span className="contract-call-simulator__log-method">
                      {entry.method}
                    </span>
                    <span className={`contract-call-simulator__log-badge contract-call-simulator__log-badge--${entry.mode}`}>
                      {entry.mode}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

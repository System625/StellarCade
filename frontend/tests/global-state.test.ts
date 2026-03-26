import { describe, it, expect, beforeEach, vi } from "vitest";


import GlobalStateStore from "../src/services/global-state-store";
import {
  isBannerDismissed,
  persistBannerDismissal,
} from "../src/services/global-state-store";
import { render, screen, fireEvent } from "@testing-library/react";
import { NetworkGuardBanner } from "../src/components/v1/NetworkGuardBanner";
import { ErrorNotice } from "../src/components/v1/ErrorNotice";
import type { AppError } from "../src/types/errors";
import React from "react";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("GlobalStateStore", () => {
  it("initializes with defaults and persists auth/flags", () => {
    const store = new GlobalStateStore({ storageKey: "test_state" });
    expect(store.getState().auth.isAuthenticated).toBe(false);

    store.dispatch({
      type: "AUTH_SET",
      payload: { userId: "u1", token: "t1" },
    });
    store.dispatch({
      type: "FLAGS_SET",
      payload: { key: "feature_x", value: true },
    });

    const raw = JSON.parse(localStorage.getItem("test_state") as string);
    expect(raw.auth.userId).toBe("u1");
    expect(raw.flags.feature_x).toBe(true);
  });

  it("clears wallet as ephemeral and does not persist", () => {
    const store = new GlobalStateStore({ storageKey: "test_state2" });
    store.dispatch({
      type: "WALLET_SET",
      payload: {
        meta: {
          address: "GABC",
          provider: { id: "m", name: "m" },
          network: "TESTNET",
          connectedAt: Date.now(),
        },
      } as any,
    });
    const raw = JSON.parse(localStorage.getItem("test_state2") as string);
    expect(raw.wallet).toBeUndefined();
  });

  it("persists and restores banner dismissals by key and identity", () => {
    expect(isBannerDismissed("network-guard-banner", "testnet:v1")).toBe(false);

    persistBannerDismissal("network-guard-banner", "testnet:v1", true);
    expect(isBannerDismissed("network-guard-banner", "testnet:v1")).toBe(true);
  });

  it("resets dismissal when banner identity changes", () => {
    persistBannerDismissal("network-guard-banner", "testnet:v1", true);
    expect(isBannerDismissed("network-guard-banner", "testnet:v1")).toBe(true);
    expect(isBannerDismissed("network-guard-banner", "testnet:v2")).toBe(false);
  });

  it("does not persist dismissals unless banner opts in", () => {
    render(
      React.createElement(NetworkGuardBanner, {
        network: "PUBLIC",
        normalizedNetwork: "PUBLIC",
        supportedNetworks: ["TESTNET"],
        isSupported: false,
        dismissible: true,
        persistDismissal: false,
      }),
    );

    fireEvent.click(screen.getByTestId("network-dismiss-button"));
    expect(isBannerDismissed("network-guard-banner", "PUBLIC:PUBLIC:TESTNET")).toBe(false);
  });

  it("persists dismissals for ErrorNotice when enabled", () => {
    const error: AppError = {
      code: "RPC_NODE_UNAVAILABLE",
      domain: "rpc",
      severity: "retryable",
      message: "Network is down",
    };

    render(
      React.createElement(ErrorNotice, {
        error,
        onDismiss: () => {},
        persistDismissal: true,
        dismissalKey: "error-notice",
        dismissalIdentity: "rpc-node:v1",
        testId: "persisted-error",
      }),
    );

    fireEvent.click(screen.getByTestId("persisted-error-dismiss"));
    expect(isBannerDismissed("error-notice", "rpc-node:v1")).toBe(true);
  });
});

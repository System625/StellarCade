/**
 * Utility functions for LoadingSkeletonSet to help build and parse dimension props.
 */

import { useState, useEffect } from "react";

// Concatenates classes filtering out falsy values
export function classNames(...classes: (string | undefined | null | false)[]): string {
    return classes.filter(Boolean).join(" ");
}

// Parses string or number props into robust CSS dimension values
export function parseDimension(value?: string | number): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value === "number") return `${value}px`;
    return value;
}

/**
 * Returns true if the user has requested reduced motion via the
 * `prefers-reduced-motion: reduce` media query. Safe to call in SSR
 * environments (returns false when `window` is unavailable).
 */
export function prefersReducedMotion(): boolean {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * React hook that tracks the `prefers-reduced-motion` media query and
 * updates reactively when the user changes their system preference.
 *
 * Returns `true` when reduced motion is preferred so components can
 * suppress or simplify animated behaviour automatically.
 *
 * @example
 * ```tsx
 * function AnimatedWidget() {
 *   const reducedMotion = useReducedMotion();
 *   return <div className={reducedMotion ? "static" : "animated"} />;
 * }
 * ```
 */
export function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState<boolean>(prefersReducedMotion);

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
            return;
        }
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

        const handler = (e: MediaQueryListEvent) => {
            setReduced(e.matches);
        };

        // Use addEventListener when available, fall back to addListener for older browsers
        if (mq.addEventListener) {
            mq.addEventListener("change", handler);
            return () => mq.removeEventListener("change", handler);
        } else {
            mq.addListener(handler);
            return () => {
                mq.removeListener(handler);
            };
        }
    }, []);

    return reduced;
}

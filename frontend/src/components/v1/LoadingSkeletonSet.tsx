import React from 'react';
import './LoadingSkeletonSet.css';
import { classNames, parseDimension, useReducedMotion } from '../../utils/v1/skeletonUtils';
import {
    SKELETON_PRESETS,
    skRadiusSm,
    skRadiusMd,
    skRadiusLg,
    type SkeletonPresetType,
} from './skeleton.tokens';

export interface SkeletonBaseProps extends React.HTMLAttributes<HTMLDivElement> {
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    className?: string;
    circle?: boolean;
}

/**
 * Maps a token radius value to the corresponding utility class name.
 * Falls back to inline style when the value doesn't match a known token.
 */
function radiusTokenClass(radius?: string | number): string | undefined {
    if (radius === undefined) return undefined;
    const str = typeof radius === 'number' ? `${radius}px` : radius;
    if (str === '50%') return 'stellarcade-skeleton--radius-circle';
    if (str === skRadiusSm) return 'stellarcade-skeleton--radius-sm';
    if (str === skRadiusMd) return 'stellarcade-skeleton--radius-md';
    if (str === skRadiusLg) return 'stellarcade-skeleton--radius-lg';
    return undefined;
}

export function SkeletonBase({ width, height, borderRadius, className, circle, style, ...rest }: SkeletonBaseProps) {
    const resolvedRadius = circle ? '50%' : borderRadius;
    const tokenCls = radiusTokenClass(circle ? '50%' : (typeof resolvedRadius === 'string' ? resolvedRadius : undefined));
    const reducedMotion = useReducedMotion();

    return (
        <div
            className={classNames(
                'stellarcade-skeleton',
                'stellarcade-skeleton-base',
                tokenCls,
                reducedMotion ? 'stellarcade-skeleton--no-motion' : undefined,
                className,
            )}
            style={{
                width: parseDimension(width),
                height: parseDimension(height) || '1rem',
                borderRadius: tokenCls ? undefined : parseDimension(resolvedRadius),
                ...style,
            }}
            data-testid="skeleton-base"
            data-reduced-motion={reducedMotion ? 'true' : undefined}
            {...rest}
        />
    );
}

export interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
    children?: React.ReactNode;
}

export function SkeletonCard({ className, children, ...rest }: SkeletonCardProps) {
    return (
        <div
            className={classNames('stellarcade-skeleton-card', className)}
            data-testid="skeleton-card"
            {...rest}
        >
            {children ? children : (
                <>
                    <SkeletonBase height="150px" borderRadius="0.5rem" />
                    <SkeletonBase height="24px" width="75%" />
                    <SkeletonBase height="16px" width="50%" />
                </>
            )}
        </div>
    );
}

export interface SkeletonRowProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
    avatarSize?: string | number;
}

export function SkeletonRow({ className, avatarSize = "40px", ...rest }: SkeletonRowProps) {
    return (
        <div
            className={classNames('stellarcade-skeleton-row', className)}
            data-testid="skeleton-row"
            {...rest}
        >
            <SkeletonBase width={avatarSize} height={avatarSize} circle />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <SkeletonBase height="16px" width="60%" />
                <SkeletonBase height="12px" width="40%" />
            </div>
        </div>
    );
}

export interface SkeletonListProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
    count?: number;
    type?: 'row' | 'card';
}

export function SkeletonList({ className, count = 3, type = 'row', ...rest }: SkeletonListProps) {
    return (
        <div
            className={classNames('stellarcade-skeleton-list', className)}
            data-testid="skeleton-list"
            {...rest}
        >
            {Array.from({ length: Math.max(0, count) }).map((_, i) => (
                type === 'row' ? <SkeletonRow key={`skeleton-row-${i}`} /> : <SkeletonCard key={`skeleton-card-${i}`} />
            ))}
        </div>
    );
}

// ── SkeletonPreset ──────────────────────────────────────────────────

export interface SkeletonPresetProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Which named preset to render. */
    type: SkeletonPresetType;
    className?: string;
}

/**
 * Renders a named loading preset (`card`, `list`, or `detail`).
 *
 * Each preset is defined in `skeleton.tokens.ts` as an array of
 * `SkeletonShape` objects that are mapped to `SkeletonBase` elements.
 *
 * @example
 * ```tsx
 * <SkeletonPreset type="card" />
 * <SkeletonPreset type="detail" />
 * ```
 */
export function SkeletonPreset({ type, className, ...rest }: SkeletonPresetProps) {
    const shapes = SKELETON_PRESETS[type];

    return (
        <div
            className={classNames(
                'stellarcade-skeleton-preset',
                `stellarcade-skeleton-preset--${type}`,
                className,
            )}
            data-testid={`skeleton-preset-${type}`}
            {...rest}
        >
            {shapes.map((shape, i) => (
                <SkeletonBase
                    key={`preset-${type}-${i}`}
                    width={shape.width}
                    height={shape.height}
                    borderRadius={shape.borderRadius}
                    circle={shape.circle}
                />
            ))}
        </div>
    );
}

// ── LoadingState ────────────────────────────────────────────────────

export interface LoadingStateProps {
    isLoading: boolean;
    error?: Error | null;
    empty?: boolean;
    children: React.ReactNode;
    /** Custom fallback element for the loading state. */
    fallback?: React.ReactNode;
    /** Use a named preset as the loading fallback (ignored when `fallback` is set). */
    preset?: SkeletonPresetType;
    errorFallback?: (error: Error) => React.ReactNode;
    emptyFallback?: React.ReactNode;
}

export function LoadingState({
    isLoading,
    error,
    empty,
    children,
    fallback,
    preset,
    errorFallback,
    emptyFallback
}: LoadingStateProps) {
    if (error) {
        if (errorFallback) return <>{errorFallback(error)}</>;
        return (
            <div className="stellarcade-error-state" data-testid="skeleton-error">
                Failed to load data: {error.message}
            </div>
        );
    }

    if (isLoading) {
        if (fallback) return <>{fallback}</>;
        if (preset) return <SkeletonPreset type={preset} />;
        return <SkeletonList count={3} />;
    }

    if (empty) {
        if (emptyFallback) return <>{emptyFallback}</>;
        return (
            <div className="stellarcade-empty-state" data-testid="skeleton-empty">
                No data available
            </div>
        );
    }

    return <>{children}</>;
}

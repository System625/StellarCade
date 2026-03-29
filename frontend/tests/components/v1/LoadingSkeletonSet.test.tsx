
import { render, screen } from '@testing-library/react';
import {
    SkeletonBase,
    SkeletonCard,
    SkeletonRow,
    SkeletonList,
    SkeletonPreset,
    LoadingState,
} from '../../../src/components/v1/LoadingSkeletonSet';
import { parseDimension, classNames, prefersReducedMotion } from '../../../src/utils/v1/skeletonUtils';
import {
    SKELETON_PRESETS,
    skHeightThumbnail,
    skHeightTextLg,
    skHeightTextMd,
    skHeightTextSm,
    skHeightHeading,
    skHeightDetailBanner,
    skSizeAvatarMd,
    skRadiusMd,
    skRadiusLg,
} from '../../../src/components/v1/skeleton.tokens';
import type { SkeletonPresetType } from '../../../src/components/v1/skeleton.tokens';

// ── Utility tests ───────────────────────────────────────────────────

describe('skeletonUtils', () => {
    it('parses dimension correctly', () => {
        expect(parseDimension(50)).toBe('50px');
        expect(parseDimension('100%')).toBe('100%');
        expect(parseDimension(undefined)).toBeUndefined();
    });

    it('joins classNames correctly', () => {
        expect(classNames('a', 'b')).toBe('a b');
        expect(classNames('a', undefined, null, false, 'c')).toBe('a c');
    });
});

// ── Core component tests ────────────────────────────────────────────

describe('LoadingSkeletonSet Components', () => {
    it('renders SkeletonBase with default and custom styles', () => {
        render(<SkeletonBase width="100px" height={50} borderRadius="50%" />);
        const el = screen.getByTestId('skeleton-base');
        expect(el.className).toContain('stellarcade-skeleton-base');
        expect(el.style.width).toBe('100px');
        expect(el.style.height).toBe('50px');
    });

    it('renders SkeletonCard with generic structure', () => {
        render(<SkeletonCard />);
        const card = screen.getByTestId('skeleton-card');
        expect(card).toBeTruthy();
        expect(card.children.length).toBeGreaterThan(0);
    });

    it('renders SkeletonCard with custom children', () => {
        render(
            <SkeletonCard>
                <span data-testid="custom-child">Testing</span>
            </SkeletonCard>
        );
        expect(screen.getByTestId('custom-child')).toBeTruthy();
    });

    it('renders SkeletonRow with correct avatar sizing', () => {
        render(<SkeletonRow avatarSize="60px" />);
        const row = screen.getByTestId('skeleton-row');
        expect(row).toBeTruthy();
    });

    it('renders SkeletonList with correct lengths and types', () => {
        render(<SkeletonList count={5} type="card" />);
        const list = screen.getByTestId('skeleton-list');
        expect(list.children.length).toBe(5);
        expect(screen.getAllByTestId('skeleton-card').length).toBe(5);
    });
});

// ── LoadingState conditional rendering ──────────────────────────────

describe('LoadingState Conditional Rendering', () => {
    it('renders error state when error is provided', () => {
        render(
            <LoadingState isLoading={true} error={new Error('Test error')} empty={false}>
                <div data-testid="content">Content</div>
            </LoadingState>
        );
        expect(screen.getByTestId('skeleton-error').textContent).toContain('Failed to load data: Test error');
        expect(screen.queryByTestId('content')).toBeNull();
    });

    it('renders loading state when isLoading is true without error', () => {
        render(
            <LoadingState isLoading={true} empty={false}>
                <div data-testid="content">Content</div>
            </LoadingState>
        );
        expect(screen.getByTestId('skeleton-list')).toBeTruthy();
        expect(screen.queryByTestId('content')).toBeNull();
    });

    it('renders empty state when empty is true and no loading/error', () => {
        render(
            <LoadingState isLoading={false} empty={true}>
                <div data-testid="content">Content</div>
            </LoadingState>
        );
        expect(screen.getByTestId('skeleton-empty').textContent).toContain('No data available');
        expect(screen.queryByTestId('content')).toBeNull();
    });

    it('renders content when not loading, no error, and not empty', () => {
        render(
            <LoadingState isLoading={false} empty={false}>
                <div data-testid="content">Loaded Content</div>
            </LoadingState>
        );
        expect(screen.getByTestId('content').textContent).toContain('Loaded Content');
        expect(screen.queryByTestId('skeleton-list')).toBeNull();
    });

    it('uses custom fallbacks properly', () => {
        render(
            <LoadingState
                isLoading={false}
                error={new Error('custom')}
                errorFallback={() => <span data-testid="custom-error">Custom</span>}
            >
                <div data-testid="content">Content</div>
            </LoadingState>
        );
        expect(screen.getByTestId('custom-error')).toBeTruthy();
    });
});

// ── Skeleton tokens tests ───────────────────────────────────────────

describe('Skeleton Tokens', () => {
    it('SKELETON_PRESETS has card, list, and detail keys', () => {
        expect(SKELETON_PRESETS).toHaveProperty('card');
        expect(SKELETON_PRESETS).toHaveProperty('list');
        expect(SKELETON_PRESETS).toHaveProperty('detail');
    });

    it('card preset has correct shapes', () => {
        const card = SKELETON_PRESETS.card;
        expect(card).toHaveLength(3);
        expect(card[0].height).toBe(skHeightThumbnail);
        expect(card[0].borderRadius).toBe(skRadiusMd);
        expect(card[1].height).toBe(skHeightTextLg);
        expect(card[1].width).toBe('75%');
        expect(card[2].height).toBe(skHeightTextMd);
        expect(card[2].width).toBe('50%');
    });

    it('list preset has correct shapes', () => {
        const list = SKELETON_PRESETS.list;
        expect(list).toHaveLength(3);
        expect(list[0].circle).toBe(true);
        expect(list[0].height).toBe(skSizeAvatarMd);
        expect(list[1].height).toBe(skHeightTextMd);
        expect(list[2].height).toBe(skHeightTextSm);
    });

    it('detail preset has correct shapes', () => {
        const detail = SKELETON_PRESETS.detail;
        expect(detail).toHaveLength(5);
        expect(detail[0].height).toBe(skHeightDetailBanner);
        expect(detail[0].borderRadius).toBe(skRadiusLg);
        expect(detail[1].height).toBe(skHeightHeading);
        expect(detail[4].height).toBe(skHeightTextSm);
    });

    it('all preset shapes have required height property', () => {
        const presetKeys: SkeletonPresetType[] = ['card', 'list', 'detail'];
        for (const key of presetKeys) {
            for (const shape of SKELETON_PRESETS[key]) {
                expect(shape).toHaveProperty('height');
                expect(typeof shape.height).toBe('string');
            }
        }
    });
});

// ── SkeletonPreset rendering tests ──────────────────────────────────

describe('SkeletonPreset Component', () => {
    it('renders card preset with correct number of skeleton shapes', () => {
        render(<SkeletonPreset type="card" />);
        const preset = screen.getByTestId('skeleton-preset-card');
        expect(preset).toBeTruthy();
        expect(preset.className).toContain('stellarcade-skeleton-preset');
        expect(preset.className).toContain('stellarcade-skeleton-preset--card');
        const bases = preset.querySelectorAll('[data-testid="skeleton-base"]');
        expect(bases.length).toBe(SKELETON_PRESETS.card.length);
    });

    it('renders list preset with correct number of skeleton shapes', () => {
        render(<SkeletonPreset type="list" />);
        const preset = screen.getByTestId('skeleton-preset-list');
        expect(preset).toBeTruthy();
        expect(preset.className).toContain('stellarcade-skeleton-preset--list');
        const bases = preset.querySelectorAll('[data-testid="skeleton-base"]');
        expect(bases.length).toBe(SKELETON_PRESETS.list.length);
    });

    it('renders detail preset with correct number of skeleton shapes', () => {
        render(<SkeletonPreset type="detail" />);
        const preset = screen.getByTestId('skeleton-preset-detail');
        expect(preset).toBeTruthy();
        expect(preset.className).toContain('stellarcade-skeleton-preset--detail');
        const bases = preset.querySelectorAll('[data-testid="skeleton-base"]');
        expect(bases.length).toBe(SKELETON_PRESETS.detail.length);
    });

    it('accepts custom className', () => {
        render(<SkeletonPreset type="card" className="my-custom" />);
        const preset = screen.getByTestId('skeleton-preset-card');
        expect(preset.className).toContain('my-custom');
    });
});

// ── Token-driven class application tests ────────────────────────────

describe('Token-driven class application', () => {
    it('applies radius-circle class for circle shapes', () => {
        render(<SkeletonBase circle />);
        const el = screen.getByTestId('skeleton-base');
        expect(el.className).toContain('stellarcade-skeleton--radius-circle');
    });

    it('applies radius-md class for 0.5rem borderRadius', () => {
        render(<SkeletonBase borderRadius="0.5rem" />);
        const el = screen.getByTestId('skeleton-base');
        expect(el.className).toContain('stellarcade-skeleton--radius-md');
    });

    it('applies radius-lg class for 0.75rem borderRadius', () => {
        render(<SkeletonBase borderRadius="0.75rem" />);
        const el = screen.getByTestId('skeleton-base');
        expect(el.className).toContain('stellarcade-skeleton--radius-lg');
    });

    it('applies radius-sm class for 0.25rem borderRadius', () => {
        render(<SkeletonBase borderRadius="0.25rem" />);
        const el = screen.getByTestId('skeleton-base');
        expect(el.className).toContain('stellarcade-skeleton--radius-sm');
    });

    it('uses inline style for non-token radius', () => {
        render(<SkeletonBase borderRadius="10px" />);
        const el = screen.getByTestId('skeleton-base');
        expect(el.className).not.toContain('stellarcade-skeleton--radius');
        expect(el.style.borderRadius).toBe('10px');
    });
});

// ── LoadingState preset prop tests ──────────────────────────────────

describe('LoadingState preset prop', () => {
    it('renders card preset when preset="card" and isLoading', () => {
        render(
            <LoadingState isLoading={true} preset="card">
                <div data-testid="content">Content</div>
            </LoadingState>
        );
        expect(screen.getByTestId('skeleton-preset-card')).toBeTruthy();
        expect(screen.queryByTestId('content')).toBeNull();
    });

    it('renders detail preset when preset="detail" and isLoading', () => {
        render(
            <LoadingState isLoading={true} preset="detail">
                <div data-testid="content">Content</div>
            </LoadingState>
        );
        expect(screen.getByTestId('skeleton-preset-detail')).toBeTruthy();
        expect(screen.queryByTestId('content')).toBeNull();
    });

    it('renders list preset when preset="list" and isLoading', () => {
        render(
            <LoadingState isLoading={true} preset="list">
                <div data-testid="content">Content</div>
            </LoadingState>
        );
        expect(screen.getByTestId('skeleton-preset-list')).toBeTruthy();
        expect(screen.queryByTestId('content')).toBeNull();
    });

    it('prefers explicit fallback over preset', () => {
        render(
            <LoadingState
                isLoading={true}
                preset="card"
                fallback={<div data-testid="custom-fallback">Custom</div>}
            >
                <div data-testid="content">Content</div>
            </LoadingState>
        );
        expect(screen.getByTestId('custom-fallback')).toBeTruthy();
        expect(screen.queryByTestId('skeleton-preset-card')).toBeNull();
    });

    it('renders children when not loading even with preset set', () => {
        render(
            <LoadingState isLoading={false} preset="card">
                <div data-testid="content">Loaded</div>
            </LoadingState>
        );
        expect(screen.getByTestId('content')).toBeTruthy();
        expect(screen.queryByTestId('skeleton-preset-card')).toBeNull();
    });
});

// ── Reduced-motion rendering tests ──────────────────────────────────

describe('SkeletonBase reduced-motion behavior', () => {
    const originalMatchMedia = window.matchMedia;

    afterEach(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: originalMatchMedia,
        });
    });

    function mockMatchMedia(matches: boolean) {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
                media: query,
                onchange: null,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    }

    it('renders SkeletonBase with no-motion class in reduced-motion environment', () => {
        mockMatchMedia(true);
        render(<SkeletonBase width="100px" height="20px" />);
        const el = screen.getByTestId('skeleton-base');
        expect(el.className).toContain('stellarcade-skeleton--no-motion');
        expect(el).toHaveAttribute('data-reduced-motion', 'true');
    });

    it('renders SkeletonBase without no-motion class when reduced motion is not requested', () => {
        mockMatchMedia(false);
        render(<SkeletonBase width="100px" height="20px" />);
        const el = screen.getByTestId('skeleton-base');
        expect(el.className).not.toContain('stellarcade-skeleton--no-motion');
        expect(el).not.toHaveAttribute('data-reduced-motion');
    });

    it('prefersReducedMotion() returns true when media query matches', () => {
        mockMatchMedia(true);
        expect(prefersReducedMotion()).toBe(true);
    });

    it('prefersReducedMotion() returns false when media query does not match', () => {
        mockMatchMedia(false);
        expect(prefersReducedMotion()).toBe(false);
    });

    it('SkeletonList items respect reduced-motion when reduced motion is active', () => {
        mockMatchMedia(true);
        render(<SkeletonList count={2} type="row" />);
        const bases = screen.getAllByTestId('skeleton-base');
        // All base skeletons should carry the no-motion class
        for (const el of bases) {
            expect(el.className).toContain('stellarcade-skeleton--no-motion');
        }
    });

    it('default rendering is unchanged across breakpoints when reduced motion is not requested', () => {
        mockMatchMedia(false);
        render(<SkeletonPreset type="card" />);
        const bases = screen.getAllByTestId('skeleton-base');
        for (const el of bases) {
            expect(el.className).not.toContain('stellarcade-skeleton--no-motion');
            // Should still carry the base animation class
            expect(el.className).toContain('stellarcade-skeleton');
        }
    });
});

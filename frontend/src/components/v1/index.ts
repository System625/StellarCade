/**
 * Components v1 - Public API
 *
 * Re-exports all v1 components for clean imports.
 *
 * @example
 * ```tsx
 * import { EmptyStateBlock, WalletStatusCard } from '@/components/v1';
 * ```
 */

export { EmptyStateBlock, default as EmptyStateBlockDefault } from './EmptyStateBlock';
export type {
  EmptyStateBlockProps,
  EmptyStateAction,
  EmptyStateVariant,
  ActionVariant,
} from './EmptyStateBlock.types';

export { default as ErrorNotice } from './ErrorNotice';
export type { ErrorNoticeProps } from './ErrorNotice';

export { FormErrorSummary, default as FormErrorSummaryDefault } from './FormErrorSummary';
export type { FormErrorSummaryProps, FormFieldError } from './FormErrorSummary';

export { ActionToolbar } from './ActionToolbar';
export type {
  ActionToolbarProps,
  ToolbarAction,
  ToolbarActionIntent
} from './ActionToolbar';

export { ContractEventFeed, default as ContractEventFeedDefault } from './ContractEventFeed';
export type { ContractEventFeedProps } from './ContractEventFeed';

export { PaginatedListController } from './PaginatedListController';
export type { PaginatedListControllerProps } from './PaginatedListController';

export { WalletStatusCard, default as WalletStatusCardDefault } from './WalletStatusCard';
export type {
  WalletStatusCardProps,
  WalletStatusCardCallbacks,
  WalletBadgeVariant,
  WalletStatus,
  WalletCapabilities,
  WalletStatusError,
} from './WalletStatusCard.types';

export { AsyncStateBoundary } from './AsyncStateBoundary';
export type { AsyncStateBoundaryProps } from './AsyncStateBoundary';

export { ContractActionButton } from './ContractActionButton';
export type { ContractActionButtonProps } from './ContractActionButton';

/**
 * FormErrorSummary — reusable validation error list with field anchors (v1).
 *
 * Renders structured [{ field, message }] with accessible semantics and
 * keyboard-friendly jump links to matching field elements by id.
 */

import React, { useCallback, useId } from 'react';

import './FormErrorSummary.css';

export interface FormFieldError {
  field: string;
  message: string;
}

export interface FormErrorSummaryProps {
  /** Structured errors to display */
  errors: FormFieldError[];
  /** Prefix for generated anchor hrefs; field id becomes `${fieldIdPrefix}${field}` */
  fieldIdPrefix?: string;
  /** Optional title above the list */
  title?: string;
  className?: string;
  testId?: string;
}

function fieldToDomId(prefix: string, field: string): string {
  const safe = field.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${prefix}${safe}`;
}

export const FormErrorSummary: React.FC<FormErrorSummaryProps> = ({
  errors,
  fieldIdPrefix = 'field-',
  title = 'Please fix the following:',
  className = '',
  testId = 'form-error-summary',
}) => {
  const baseId = useId().replace(/:/g, '');

  const focusField = useCallback(
    (field: string) => {
      const id = fieldToDomId(fieldIdPrefix, field);
      const el = document.getElementById(id);
      if (el && 'focus' in el && typeof (el as HTMLElement).focus === 'function') {
        (el as HTMLElement).focus();
        try {
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch {
          el.scrollIntoView();
        }
      }
    },
    [fieldIdPrefix],
  );

  const onKeyJump = useCallback(
    (e: React.KeyboardEvent<HTMLAnchorElement>, field: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        focusField(field);
      }
    },
    [focusField],
  );

  if (!errors.length) {
    return null;
  }

  const listId = `${testId}-list-${baseId}`;

  return (
    <div
      className={`form-error-summary ${className}`.trim()}
      data-testid={testId}
      role="region"
      aria-labelledby={`${testId}-title-${baseId}`}
      aria-describedby={listId}
    >
      <div
        id={`${testId}-title-${baseId}`}
        className="form-error-summary__title"
      >
        {title}
      </div>
      <ul
        id={listId}
        className="form-error-summary__list"
        role="list"
        aria-live="polite"
        aria-relevant="additions removals"
      >
        {errors.map((err, i) => {
          const targetId = fieldToDomId(fieldIdPrefix, err.field);
          return (
            <li
              key={`${err.field}-${i}`}
              className="form-error-summary__item"
              role="listitem"
            >
              <a
                href={`#${targetId}`}
                className="form-error-summary__link"
                onClick={(e) => {
                  e.preventDefault();
                  focusField(err.field);
                }}
                onKeyDown={(e) => onKeyJump(e, err.field)}
                data-testid={`${testId}-link-${err.field}`}
                aria-describedby={`${testId}-msg-${baseId}-${i}`}
              >
                <span className="form-error-summary__field">{err.field}</span>
              </a>
              <span
                id={`${testId}-msg-${baseId}-${i}`}
                className="form-error-summary__message"
                role="alert"
              >
                {err.message}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

FormErrorSummary.displayName = 'FormErrorSummary';

export default FormErrorSummary;

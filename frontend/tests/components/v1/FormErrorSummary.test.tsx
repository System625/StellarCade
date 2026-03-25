/**
 * FormErrorSummary — rendering and accessibility tests.
 */

import { FormErrorSummary } from '@/components/v1/FormErrorSummary';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

describe('FormErrorSummary', () => {
  it('renders nothing when errors empty', () => {
    const { container } = render(<FormErrorSummary errors={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders region and list with errors', () => {
    render(
      <FormErrorSummary
        errors={[
          { field: 'email', message: 'Invalid email' },
          { field: 'amount', message: 'Too low' },
        ]}
      />,
    );

    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
    expect(screen.getByText('Too low')).toBeInTheDocument();
  });

  it('uses aria-live polite on list for announcements', () => {
    render(
      <FormErrorSummary errors={[{ field: 'x', message: 'bad' }]} />,
    );
    const list = screen.getByRole('list');
    expect(list).toHaveAttribute('aria-live', 'polite');
  });

  it('exposes role alert on each message', () => {
    render(
      <FormErrorSummary
        errors={[{ field: 'email', message: 'Required' }]}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('focuses matching field element on link click', () => {
    const FocusTrap = () => (
      <>
        <FormErrorSummary
          fieldIdPrefix="fld-"
          errors={[{ field: 'email', message: 'bad' }]}
        />
        <input id="fld-email" data-testid="email-input" />
      </>
    );
    render(<FocusTrap />);
    const input = screen.getByTestId('email-input');
    const link = screen.getByRole('link', { name: /email/i });
    fireEvent.click(link);
    expect(document.activeElement).toBe(input);
  });

  it('focuses field on Enter key on link', () => {
    render(
      <>
        <FormErrorSummary
          fieldIdPrefix="f-"
          errors={[{ field: 'name', message: 'err' }]}
        />
        <input id="f-name" data-testid="name-input" />
      </>,
    );
    const link = screen.getByRole('link', { name: /name/i });
    fireEvent.keyDown(link, { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByTestId('name-input'));
  });
});

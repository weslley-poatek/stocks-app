import { fireEvent, render, screen } from '@testing-library/react-native';

import { CompanyLogo, initialsOf } from '../components/CompanyLogo';

// The logo is hidden from screen readers, so tests must look at hidden elements.
const HIDDEN = { includeHiddenElements: true };

describe('CompanyLogo initials', () => {
  it('takes the first two letters of the ticker', () => {
    expect(initialsOf('PETR4')).toBe('PE');
    expect(initialsOf('vale3')).toBe('VA');
  });

  it('copes with a short or odd ticker', () => {
    expect(initialsOf('X')).toBe('X');
    expect(initialsOf('BRK.B')).toBe('BR');
    expect(initialsOf('.B')).toBe('B');
    expect(initialsOf('')).toBe('?');
    expect(initialsOf('--')).toBe('?');
  });

  it('renders them when there is no uri', async () => {
    await render(<CompanyLogo symbol="X" size={32} />);
    expect(screen.getByText('X', HIDDEN)).toBeTruthy();
  });

  it('starts over when a recycled cell gets a new uri', async () => {
    const { rerender } = await render(<CompanyLogo symbol="AA" uri="https://x/a.png" size={32} />);
    await fireEvent(screen.getByTestId('company-logo', HIDDEN), 'error', { nativeEvent: {} });
    expect(screen.queryByTestId('company-logo', HIDDEN)).toBeNull();
    await rerender(<CompanyLogo symbol="BB" uri="https://x/b.png" size={32} />);
    expect(screen.getByTestId('company-logo', HIDDEN).props.style).toMatchObject({ opacity: 0 });
    await fireEvent(screen.getByTestId('company-logo', HIDDEN), 'load', { nativeEvent: {} });
    expect(screen.queryByText('BB', HIDDEN)).toBeNull();
    await rerender(<CompanyLogo symbol="CC" uri="https://x/c.png" size={32} />);
    expect(screen.getByText('CC', HIDDEN)).toBeTruthy(); // not loaded yet: initials, image hidden
  });
});

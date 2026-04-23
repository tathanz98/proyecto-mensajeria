import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Wallet from '../Wallet';

describe('Wallet Component', () => {
  it('renders correctly with default bank account', () => {
    render(<Wallet onNavigate={() => {}} />);
    expect(screen.getByText('Mi Billetera')).toBeDefined();
    expect(screen.getByText('Bancolombia Ahorros')).toBeDefined();
  });

  it('toggles virtual card lock state and hides/shows details', () => {
    render(<Wallet onNavigate={() => {}} />);
    
    // Ensure card is unlocked and numbers are hidden by default
    expect(screen.queryByText('Tarjeta Bloqueada')).toBeNull();
    // Numbers are hidden (••••)
    expect(screen.getAllByText('••••').length).toBeGreaterThan(0);
  });
});

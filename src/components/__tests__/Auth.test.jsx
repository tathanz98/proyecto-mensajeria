import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Auth from '../Auth';

describe('Auth Component', () => {
  it('renders login form by default', () => {
    render(<Auth onLogin={() => {}} />);
    expect(screen.getByText('Bienvenido de nuevo')).toBeDefined();
    expect(screen.getByText('Inicia sesión para comenzar a repartir')).toBeDefined();
    expect(screen.getByPlaceholderText('correo@ejemplo.com')).toBeDefined();
  });

  it('switches to registration form and shows vehicle selection', () => {
    render(<Auth onLogin={() => {}} />);
    
    // Switch to register
    const switchBtn = screen.getByText('Regístrate aquí');
    fireEvent.click(switchBtn);

    expect(screen.getByText('Únete al equipo')).toBeDefined();
    expect(screen.getByText('Tipo de Vehículo')).toBeDefined();
    
    // Check vehicle options
    const select = screen.getByDisplayValue('🏍️ Motocicleta');
    expect(select).toBeDefined();
  });

  it('prevents registration if terms are not accepted', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    render(<Auth onLogin={() => {}} />);
    
    // Switch to register
    fireEvent.click(screen.getByText('Regístrate aquí'));
    
    // Submit form directly
    const form = screen.getByRole('button', { name: 'Registrarse' }).closest('form');
    fireEvent.submit(form);
    
    expect(alertMock).toHaveBeenCalledWith('Debes leer y aceptar el contrato de prestación de servicios para continuar.');
    alertMock.mockRestore();
  });
});

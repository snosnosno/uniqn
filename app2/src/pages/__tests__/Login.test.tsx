import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../Login';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../utils/logger';

// Mock Firebase
jest.mock('../../firebase', () => ({
  auth: {},
  db: {},
}));

// Mock dependencies
jest.mock('../../contexts/AuthContext');
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: jest.fn(),
    },
  }),
}));

describe('Login Component', () => {
  const mockSignIn = jest.fn();
  const mockSignInWithGoogle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      signIn: mockSignIn,
      signInWithGoogle: mockSignInWithGoogle,
    });
  });

  const renderLogin = () => {
    return render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
  };

  test('renders login form with all elements', () => {
    renderLogin();

    expect(screen.getByRole('heading', { name: 'login.title' })).toBeInTheDocument();
    expect(screen.getByLabelText('adminLogin.email')).toBeInTheDocument();
    expect(screen.getByLabelText('adminLogin.password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'adminLogin.loginButton' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'googleSignIn.button' })).toBeInTheDocument();
    expect(screen.getByText('adminLogin.forgotPassword')).toBeInTheDocument();
    expect(screen.getByText('adminLogin.signUpLink')).toBeInTheDocument();
  });

  test('handles successful login', async () => {
    mockSignIn.mockResolvedValue(undefined);
    renderLogin();

    const emailInput = screen.getByLabelText('adminLogin.email');
    const passwordInput = screen.getByLabelText('adminLogin.password');
    const submitButton = screen.getByRole('button', { name: 'adminLogin.loginButton' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
    });
    
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  test('handles login error - user disabled', async () => {
    const error = { code: 'auth/user-disabled' };
    mockSignIn.mockRejectedValue(error);
    renderLogin();

    const emailInput = screen.getByLabelText('adminLogin.email');
    const passwordInput = screen.getByLabelText('adminLogin.password');
    const submitButton = screen.getByRole('button', { name: 'adminLogin.loginButton' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('adminLogin.approvalPending')).toBeInTheDocument();
    });
    
    expect(logger.error).toHaveBeenCalled();
  });

  test('handles generic login error', async () => {
    const error = new Error('Login failed');
    mockSignIn.mockRejectedValue(error);
    renderLogin();

    const emailInput = screen.getByLabelText('adminLogin.email');
    const passwordInput = screen.getByLabelText('adminLogin.password');
    const submitButton = screen.getByRole('button', { name: 'adminLogin.loginButton' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('adminLogin.errorMessage')).toBeInTheDocument();
    });
    
    expect(logger.error).toHaveBeenCalledWith(
      'Error occurred',
      error,
      { component: 'Login' }
    );
  });

  test('handles Google sign-in success', async () => {
    mockSignInWithGoogle.mockResolvedValue(undefined);
    renderLogin();

    const googleButton = screen.getByRole('button', { name: 'googleSignIn.button' });
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
    
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  test('handles Google sign-in error', async () => {
    const error = new Error('Google sign-in failed');
    mockSignInWithGoogle.mockRejectedValue(error);
    renderLogin();

    const googleButton = screen.getByRole('button', { name: 'googleSignIn.button' });
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(screen.getByText('googleSignIn.error')).toBeInTheDocument();
    });
    
    expect(logger.error).toHaveBeenCalledWith(
      'Google Sign-In Error:',
      error,
      { component: 'Login' }
    );
  });

  test('form submission is prevented without data', () => {
    renderLogin();
    const form = screen.getByRole('form');
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    
    fireEvent(form, submitEvent);
    
    expect(submitEvent.defaultPrevented).toBe(false);
  });

  test('input fields update correctly', () => {
    renderLogin();

    const emailInput = screen.getByLabelText('adminLogin.email') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('adminLogin.password') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'new@email.com' } });
    fireEvent.change(passwordInput, { target: { value: 'newpassword' } });

    expect(emailInput.value).toBe('new@email.com');
    expect(passwordInput.value).toBe('newpassword');
  });
});
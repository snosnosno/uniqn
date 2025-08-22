import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SignUp from '../SignUp';
import { useAuth } from '../../contexts/AuthContext';
import { callFunctionLazy } from '../../utils/firebase-dynamic';
import { logger } from '../../utils/logger';

// Mock Firebase
jest.mock('../../firebase', () => ({
  auth: {},
  db: {},
}));

// Mock dependencies
jest.mock('../../contexts/AuthContext');
jest.mock('../../utils/firebase-dynamic');
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

describe('SignUp Component', () => {
  const mockSignInWithGoogle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      signInWithGoogle: mockSignInWithGoogle,
    });
  });

  const renderSignUp = () => {
    return render(
      <BrowserRouter>
        <SignUp />
      </BrowserRouter>
    );
  };

  test('renders signup form with all elements', () => {
    renderSignUp();

    expect(screen.getByRole('heading', { name: 'signUp.title' })).toBeInTheDocument();
    expect(screen.getByLabelText('signUp.name')).toBeInTheDocument();
    expect(screen.getByLabelText('signUp.phone')).toBeInTheDocument();
    expect(screen.getByLabelText('signUp.email')).toBeInTheDocument();
    expect(screen.getByLabelText('signUp.password')).toBeInTheDocument();
    expect(screen.getByText('signUp.role')).toBeInTheDocument();
    expect(screen.getByText('signUp.gender')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'signUp.signUpButton' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'googleSignIn.button' })).toBeInTheDocument();
  });

  test('validates password length', async () => {
    renderSignUp();

    const passwordInput = screen.getByLabelText('signUp.password');
    const submitButton = screen.getByRole('button', { name: 'signUp.signUpButton' });

    fireEvent.change(passwordInput, { target: { value: '12345' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('signUp.passwordLengthError')).toBeInTheDocument();
    });
  });

  test('handles successful registration', async () => {
    (callFunctionLazy as jest.Mock).mockResolvedValue({ data: { success: true } });
    renderSignUp();

    // Fill form
    fireEvent.change(screen.getByLabelText('signUp.name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText('signUp.phone'), { target: { value: '010-1234-5678' } });
    fireEvent.change(screen.getByLabelText('signUp.email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('signUp.password'), { target: { value: 'password123' } });
    
    // Select role
    fireEvent.click(screen.getByLabelText('signUp.staff'));
    
    // Select gender
    fireEvent.click(screen.getByLabelText('signUp.male'));

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'signUp.signUpButton' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(callFunctionLazy).toHaveBeenCalledWith('requestRegistration', {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        phone: '010-1234-5678',
        role: 'staff',
        gender: 'male',
      });
    });

    // Check modal appears
    await waitFor(() => {
      expect(screen.getByText('signUp.registrationCompleteTitle')).toBeInTheDocument();
    });
  });

  test('handles registration error', async () => {
    const error = new Error('Registration failed');
    (callFunctionLazy as jest.Mock).mockRejectedValue(error);
    renderSignUp();

    // Fill minimum required fields
    fireEvent.change(screen.getByLabelText('signUp.name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText('signUp.phone'), { target: { value: '010-1234-5678' } });
    fireEvent.change(screen.getByLabelText('signUp.email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('signUp.password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByLabelText('signUp.staff'));
    fireEvent.click(screen.getByLabelText('signUp.male'));

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'signUp.signUpButton' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('signUp.errorMessage')).toBeInTheDocument();
    });
    
    expect(logger.error).toHaveBeenCalledWith(
      'Registration error:',
      error,
      { component: 'SignUp' }
    );
  });

  test('handles Google sign-in', async () => {
    mockSignInWithGoogle.mockResolvedValue(undefined);
    renderSignUp();

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
    renderSignUp();

    const googleButton = screen.getByRole('button', { name: 'googleSignIn.button' });
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(screen.getByText('googleSignIn.error')).toBeInTheDocument();
    });
    
    expect(logger.error).toHaveBeenCalledWith(
      'Google Sign-In Error:',
      error,
      { component: 'SignUp' }
    );
  });

  test('role selection works correctly', () => {
    renderSignUp();

    const staffRadio = screen.getByLabelText('signUp.staff') as HTMLInputElement;
    const managerRadio = screen.getByLabelText('signUp.manager') as HTMLInputElement;

    // Default should be staff
    expect(staffRadio.checked).toBe(true);
    expect(managerRadio.checked).toBe(false);

    // Click manager
    fireEvent.click(managerRadio);
    expect(staffRadio.checked).toBe(false);
    expect(managerRadio.checked).toBe(true);
  });

  test('gender selection works correctly', () => {
    renderSignUp();

    const maleRadio = screen.getByLabelText('signUp.male') as HTMLInputElement;
    const femaleRadio = screen.getByLabelText('signUp.female') as HTMLInputElement;

    // Initially neither should be selected
    expect(maleRadio.checked).toBe(false);
    expect(femaleRadio.checked).toBe(false);

    // Click male
    fireEvent.click(maleRadio);
    expect(maleRadio.checked).toBe(true);
    expect(femaleRadio.checked).toBe(false);

    // Click female
    fireEvent.click(femaleRadio);
    expect(maleRadio.checked).toBe(false);
    expect(femaleRadio.checked).toBe(true);
  });

  test('loading state is managed correctly', async () => {
    (callFunctionLazy as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: { success: true } }), 100))
    );
    renderSignUp();

    // Fill form
    fireEvent.change(screen.getByLabelText('signUp.name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText('signUp.phone'), { target: { value: '010-1234-5678' } });
    fireEvent.change(screen.getByLabelText('signUp.email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('signUp.password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByLabelText('signUp.staff'));
    fireEvent.click(screen.getByLabelText('signUp.male'));

    const submitButton = screen.getByRole('button', { name: 'signUp.signUpButton' });
    
    // Button should not be disabled initially
    expect(submitButton).not.toBeDisabled();

    fireEvent.click(submitButton);

    // Button should be disabled while loading
    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      // Button should be enabled after completion
      expect(submitButton).not.toBeDisabled();
    });
  });
});
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { AuthContext } from '../contexts/AuthContext';
import { TournamentProvider } from '../contexts/TournamentContext';
import { JobPostingProvider } from '../contexts/JobPostingContextAdapter';
import { MemoryRouter } from 'react-router-dom';

// Mock user for testing
export const mockUser: any = {
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  emailVerified: true,
  isAnonymous: false,
  metadata: {},
  providerData: [],
  refreshToken: '',
  tenantId: null,
  delete: jest.fn(),
  getIdToken: jest.fn(),
  getIdTokenResult: jest.fn(),
  reload: jest.fn(),
  toJSON: jest.fn(),
  phoneNumber: null,
  photoURL: null,
  providerId: 'firebase'
};

// Mock auth context value
export const mockAuthContextValue = {
  currentUser: mockUser,
  loading: false,
  isAdmin: true,
  role: 'admin',
  signOut: jest.fn(),
  signIn: jest.fn(),
  sendPasswordReset: jest.fn(),
  signInWithGoogle: jest.fn()
};

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authValue?: typeof mockAuthContextValue;
  initialRoute?: string;
}

export function customRender(
  ui: React.ReactElement,
  {
    authValue = mockAuthContextValue,
    initialRoute = '/',
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthContext.Provider value={authValue}>
          <TournamentProvider>
            {children}
          </TournamentProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything from testing library
export * from '@testing-library/react';

// Override render with custom render
export { customRender as render };
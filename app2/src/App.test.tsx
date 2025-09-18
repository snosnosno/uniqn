import { render, screen } from '@testing-library/react';
import { httpsCallable } from 'firebase/functions';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import App from './App';
import { useAuth } from './contexts/AuthContext';


// Mock AuthContext
jest.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: jest.fn(),
}));

// Mock Firebase Functions
jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn(),
}));


const mockedUseAuth = useAuth as jest.Mock;
const mockedHttpsCallable = httpsCallable as jest.Mock;


describe('App Component Routing', () => {

  beforeEach(() => {
    mockedUseAuth.mockClear();
    mockedHttpsCallable.mockClear();

    // Default mock for successful function calls
    mockedHttpsCallable.mockReturnValue(() => Promise.resolve({ 
        data: { 
            ongoingEventsCount: 5, 
            totalDealersCount: 120, 
            topRatedDealers: [] 
        } 
    }));
  });

  it('redirects to admin dashboard for an admin user', async () => {
    mockedUseAuth.mockReturnValue({
      loading: false,
      isAdmin: true,
      currentUser: { uid: 'admin-user' }
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    // Look for the specific H1 tag in the main content
    expect(await screen.findByRole('heading', { name: /Admin Dashboard/i })).toBeInTheDocument();
  });

  it('redirects to events page for a non-admin (dealer) user', async () => {
    mockedUseAuth.mockReturnValue({
      loading: false,
      isAdmin: false,
      currentUser: { uid: 'dealer-user' }
    });

    render(
        <MemoryRouter initialEntries={['/']}>
            <App />
        </MemoryRouter>
    );

    // Look for the specific H1 tag on the dealer events page
    expect(await screen.findByRole('heading', { name: /Available Events for Application/i })).toBeInTheDocument();
  });

  it('shows login page when a logged-out user tries to access a private route', async () => {
    mockedUseAuth.mockReturnValue({
        currentUser: null,
        loading: false,
        isAdmin: false,
    });

    render(
        <MemoryRouter initialEntries={['/app/admin/ceo-dashboard']}>
            <App />
        </MemoryRouter>
    );
    
    expect(await screen.findByText(/관리자 로그인/i)).toBeInTheDocument();
  });

});

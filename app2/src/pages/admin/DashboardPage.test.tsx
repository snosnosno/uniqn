import React from 'react';
import { render, screen } from '../../test-utils/test-utils';
import { httpsCallable } from 'firebase/functions';
import DashboardPage from './DashboardPage';

// Mock the firebase/functions module
jest.mock('firebase/functions');

// Mock firebaseConnectionManager
jest.mock('../../utils/firebaseConnectionManager', () => ({
  firebaseConnectionManager: {
    safeOnSnapshot: jest.fn(() => jest.fn())
  }
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock getFunctionsLazy
jest.mock('../../utils/firebase-dynamic', () => ({
  getFunctionsLazy: jest.fn(() => Promise.resolve({}))
}));

const mockHttpsCallable = httpsCallable as jest.Mock;

describe('DashboardPage', () => {
  
  beforeEach(() => {
    // Clear any previous mock implementations and calls
    mockHttpsCallable.mockClear();
    jest.clearAllMocks();
  });

  test('should display a loading state initially', () => {
    // Mock a function that never resolves to keep it in loading state
    mockHttpsCallable.mockReturnValue(() => new Promise(() => {}));
    
    render(<DashboardPage />);
    
    expect(screen.getByText(/dashboard.loadingText/i)).toBeInTheDocument();
  });

  test('should display statistics cards on successful data fetch', async () => {
    const mockStats = {
      ongoingEventsCount: 5,
      totalDealersCount: 25,
      topRatedDealers: [
        { id: '1', name: 'Alice', rating: 4.9, ratingCount: 50 },
        { id: '2', name: 'Bob', rating: 4.8, ratingCount: 45 },
      ],
    };

    // Mock the successful function call
    mockHttpsCallable.mockReturnValue(() => Promise.resolve({ data: mockStats }));

    render(<DashboardPage />);

    // Wait for the loading to disappear and data to be rendered
    expect(await screen.findByText('dashboard.stats.ongoingEvents')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    
    expect(screen.getByText('dashboard.stats.totalDealers')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();

    expect(screen.getByText('dashboard.stats.topRatedDealers')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText(/4.9/)).toBeInTheDocument();
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });

  test('should display an error message if the data fetch fails', async () => {
    const errorMessage = 'Something went wrong';
    
    // Mock the failed function call
    mockHttpsCallable.mockReturnValue(() => Promise.reject(new Error(errorMessage)));
    
    render(<DashboardPage />);

    // Wait for error message to appear
    const errorText = await screen.findByText(/Something went wrong/i);
    expect(errorText).toBeInTheDocument();
  });

});
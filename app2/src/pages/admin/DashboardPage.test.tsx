import { render, screen } from '@testing-library/react';
import { httpsCallable } from 'firebase/functions';
import React from 'react';

import DashboardPage from './DashboardPage';


// Mock the firebase/functions module
jest.mock('firebase/functions');

const mockHttpsCallable = httpsCallable as jest.Mock;

describe('DashboardPage', () => {
  
  beforeEach(() => {
    // Clear any previous mock implementations and calls
    mockHttpsCallable.mockClear();
  });

  test('should display a loading state initially', () => {
    // Mock a function that never resolves to keep it in loading state
    mockHttpsCallable.mockReturnValue(() => new Promise(() => {}));
    
    render(<DashboardPage />);
    
    expect(screen.getByText(/Loading dashboard.../i)).toBeInTheDocument();
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
    expect(await screen.findByText('Ongoing Events')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    
    expect(screen.getByText('Total Dealers')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();

    expect(screen.getByText('Top Rated Dealers')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText(/4.9/)).toBeInTheDocument();
    expect(screen.getByText(/(50 ratings)/)).toBeInTheDocument();
  });

  test('should display an error message if the data fetch fails', async () => {
    const errorMessage = 'Something went wrong';
    
    // Mock the failed function call
    mockHttpsCallable.mockReturnValue(() => Promise.reject(new Error(errorMessage)));
    
    render(<DashboardPage />);

    // findByText will wait for the element to appear
    const errorElement = await screen.findByText((content, element) => {
      // Look for a text node that contains the error message, ignoring surrounding elements.
      const hasText = (node: Element | null) => node?.textContent === `Error: ${errorMessage}`;
      const elementHasText = hasText(element);
      const childrenDontHaveText = Array.from(element?.children || []).every(child => !hasText(child));
      return elementHasText && childrenDontHaveText;
    });
    expect(errorElement).toBeInTheDocument();
  });

});

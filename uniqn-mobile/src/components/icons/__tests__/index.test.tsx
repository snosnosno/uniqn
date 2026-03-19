import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { HeartFilledIcon, SearchIcon, getDefaultIconColor } from '../index';

describe('icons', () => {
  it('renders svg icons without crashing', () => {
    render(
      <>
        <SearchIcon testID="search-icon" />
        <HeartFilledIcon testID="heart-icon" color="#EF4444" />
      </>
    );

    expect(screen.getByTestId('search-icon')).toBeTruthy();
    expect(screen.getByTestId('heart-icon')).toBeTruthy();
  });

  it('resolves default colors by theme', () => {
    expect(getDefaultIconColor('light')).toBe('#6B7280');
    expect(getDefaultIconColor('dark')).toBe('#9CA3AF');
    expect(getDefaultIconColor('dark', '#123456')).toBe('#123456');
  });
});

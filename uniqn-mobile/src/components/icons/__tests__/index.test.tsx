import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import {
  CloseCircleOutlineIcon,
  DocumentTextOutlineIcon,
  HeartFilledIcon,
  LoaderIcon,
  MegaphoneIcon,
  MegaphoneOutlineIcon,
  QrCodeIcon,
  ScanIcon,
  SearchIcon,
  getDefaultIconColor,
} from '../index';

describe('icons', () => {
  it('renders svg icons without crashing', () => {
    render(
      <>
        <SearchIcon testID="search-icon" />
        <HeartFilledIcon testID="heart-icon" color="#DC2626" />
        <LoaderIcon testID="loader-icon" />
        <QrCodeIcon testID="qr-code-icon" />
        <ScanIcon testID="scan-icon" />
        <MegaphoneIcon testID="megaphone-icon" />
        <MegaphoneOutlineIcon testID="megaphone-outline-icon" />
        <DocumentTextOutlineIcon testID="document-text-outline-icon" />
        <CloseCircleOutlineIcon testID="close-circle-outline-icon" />
      </>
    );

    expect(screen.getByTestId('search-icon')).toBeTruthy();
    expect(screen.getByTestId('heart-icon')).toBeTruthy();
    expect(screen.getByTestId('loader-icon')).toBeTruthy();
    expect(screen.getByTestId('qr-code-icon')).toBeTruthy();
    expect(screen.getByTestId('scan-icon')).toBeTruthy();
    expect(screen.getByTestId('megaphone-icon')).toBeTruthy();
    expect(screen.getByTestId('megaphone-outline-icon')).toBeTruthy();
    expect(screen.getByTestId('document-text-outline-icon')).toBeTruthy();
    expect(screen.getByTestId('close-circle-outline-icon')).toBeTruthy();
  });

  it('resolves default colors by theme', () => {
    expect(getDefaultIconColor('light')).toBe(SECONDARY_PALETTE[500]);
    expect(getDefaultIconColor('dark')).toBe(SECONDARY_PALETTE[400]);
    expect(getDefaultIconColor('dark', '#123456')).toBe('#123456');
  });
});

declare module 'react-qr-scanner' {
  import React from 'react';

  export interface QrScannerProps {
    delay?: number | false;
    onError?: (err: any) => void;
    onScan?: (data: { text: string } | null) => void;
    style?: React.CSSProperties;
    className?: string;
    facingMode?: 'user' | 'environment';
    legacyMode?: boolean;
    maxImageSize?: number;
    resolution?: number;
    showViewFinder?: boolean;
    constraints?: MediaStreamConstraints;
  }

  const QrScanner: React.FC<QrScannerProps>;
  export default QrScanner;
}
/**
 * UNIQN Mobile - Typography 프리미티브
 *
 * @description DESIGN.md의 타이포그래피 스케일을 semantic 컴포넌트로 래핑.
 *              Display/Heading은 Outfit, Body/UI는 Plus Jakarta Sans.
 * @version 1.0.0
 *
 * Scale (DESIGN.md):
 *   H1  36px / 800 Outfit_800ExtraBold    — font-display-bold
 *   H2  28px / 700 Outfit_700Bold         — font-display
 *   H3  22px / 600 Outfit_600SemiBold     — font-display-semibold
 *   H4  18px / 600 Outfit_600SemiBold     — font-display-semibold
 *   H5  15px / 600 Outfit_600SemiBold     — font-display-semibold
 *   Body      14px / 400 PlusJakartaSans_400Regular   — font-sans
 *   Caption   12px / 500 PlusJakartaSans_500Medium    — font-sans-medium
 *   Micro     10px / 600 PlusJakartaSans_600SemiBold  — font-sans-semibold
 *
 * @example
 *   <H1>페이지 제목</H1>
 *   <H4 className="text-primary-600">섹션 제목</H4>
 *   <Body>본문 텍스트</Body>
 */

import React from 'react';
import { Text, type TextProps } from 'react-native';

export interface TypographyProps extends TextProps {
  children?: React.ReactNode;
  className?: string;
}

// ============================================================================
// Headings — Outfit (Display)
// ============================================================================

export function H1({ children, className = '', ...props }: TypographyProps) {
  return (
    <Text className={`text-3xl font-display-bold ${className}`} {...props}>
      {children}
    </Text>
  );
}

export function H2({ children, className = '', ...props }: TypographyProps) {
  return (
    <Text className={`text-2xl font-display ${className}`} {...props}>
      {children}
    </Text>
  );
}

export function H3({ children, className = '', ...props }: TypographyProps) {
  return (
    <Text className={`text-xl font-display-semibold ${className}`} {...props}>
      {children}
    </Text>
  );
}

export function H4({ children, className = '', ...props }: TypographyProps) {
  return (
    <Text className={`text-lg font-display-semibold ${className}`} {...props}>
      {children}
    </Text>
  );
}

export function H5({ children, className = '', ...props }: TypographyProps) {
  return (
    <Text className={`text-base font-display-semibold ${className}`} {...props}>
      {children}
    </Text>
  );
}

// ============================================================================
// Body & UI — Plus Jakarta Sans
// ============================================================================

export function Body({ children, className = '', ...props }: TypographyProps) {
  return (
    <Text className={`text-sm font-sans ${className}`} {...props}>
      {children}
    </Text>
  );
}

export function Caption({ children, className = '', ...props }: TypographyProps) {
  return (
    <Text className={`text-xs font-sans-medium ${className}`} {...props}>
      {children}
    </Text>
  );
}

export function Micro({ children, className = '', ...props }: TypographyProps) {
  return (
    <Text className={`text-micro font-sans-semibold ${className}`} {...props}>
      {children}
    </Text>
  );
}

import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';

// Jest matcher 확장 - axe-core 접근성 검증
expect.extend(toHaveNoViolations);

// ResizeObserver Mock (드롭다운 크기 감지용)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// IntersectionObserver Mock (드롭다운 가시성 테스트용)
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

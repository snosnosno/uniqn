// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// IndexedDB 폴리필 추가
import 'fake-indexeddb/auto';

// TextEncoder/TextDecoder 폴리필 (Firebase Functions 테스트용)
import { TextEncoder, TextDecoder } from 'util';

// 브라우저 전용 API 모킹
Object.defineProperty(window, 'indexedDB', {
  value: require('fake-indexeddb').default,
  writable: true,
});

Object.defineProperty(window, 'IDBKeyRange', {
  value: require('fake-indexeddb/lib/FDBKeyRange').default,
  writable: true,
});

// Performance API 모킹
Object.defineProperty(window.performance, 'memory', {
  value: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 10000000,
    jsHeapSizeLimit: 100000000,
  },
  writable: true,
});

// TextEncoder/TextDecoder 전역 설정
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// ReadableStream polyfill for Firebase Functions
if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = class ReadableStream {
    constructor() {}
  } as any;
}

// ========================================
// Global Test Setup
// ========================================
// Firebase and Logger mocks are imported per-test-file
// to avoid conflicts with existing tests

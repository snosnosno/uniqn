/**
 * UNIQN Mobile - Test Utilities
 *
 * @description Helper functions for testing React Native components
 * @version 1.0.0
 */

import React, { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ============================================================================
// Query Client for Tests
// ============================================================================

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// ============================================================================
// Test Providers
// ============================================================================

interface TestProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

export function TestProviders({
  children,
  queryClient = createTestQueryClient(),
}: TestProvidersProps): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ============================================================================
// Custom Render
// ============================================================================

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

export function customRender(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): ReturnType<typeof render> {
  const { queryClient, ...renderOptions } = options;

  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders queryClient={queryClient}>{children}</TestProviders>
    ),
    ...renderOptions,
  });
}

// ============================================================================
// Wait Utilities
// ============================================================================

/**
 * Wait for all pending promises to resolve
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Wait for a specific amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  { timeout = 5000, interval = 50 } = {}
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('waitFor timeout');
    }
    await wait(interval);
  }
}

// ============================================================================
// Mock Helpers
// ============================================================================

/**
 * Create a mock function that resolves after a delay
 */
export function createDelayedMock<T>(
  value: T,
  delay = 100
): jest.Mock<Promise<T>> {
  return jest.fn(() => new Promise((resolve) => setTimeout(() => resolve(value), delay)));
}

/**
 * Create a mock function that rejects after a delay
 */
export function createDelayedRejection<T extends Error>(
  error: T,
  delay = 100
): jest.Mock<Promise<never>> {
  return jest.fn(
    () => new Promise((_, reject) => setTimeout(() => reject(error), delay))
  );
}

/**
 * Create a mock async function that can be controlled
 */
export function createControllableMock<T>(): {
  mock: jest.Mock<Promise<T>>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolveRef: (value: T) => void;
  let rejectRef: (error: Error) => void;

  const mock = jest.fn(
    () =>
      new Promise<T>((resolve, reject) => {
        resolveRef = resolve;
        rejectRef = reject;
      })
  );

  return {
    mock,
    resolve: (value: T) => resolveRef(value),
    reject: (error: Error) => rejectRef(error),
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that an element has specific text content
 */
export function assertTextContent(
  element: { props?: { children?: unknown } } | null,
  expectedText: string
): void {
  if (!element) {
    throw new Error('Element is null');
  }

  const getText = (node: unknown): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getText).join('');
    if (node && typeof node === 'object' && 'props' in node) {
      const props = node.props as { children?: unknown };
      if (props.children) return getText(props.children);
    }
    return '';
  };

  const actualText = getText(element);
  if (!actualText.includes(expectedText)) {
    throw new Error(
      `Expected text "${expectedText}" not found. Actual: "${actualText}"`
    );
  }
}

// ============================================================================
// Event Helpers
// ============================================================================

/**
 * Simulate a press event sequence (pressIn -> pressOut)
 */
export async function simulatePress(
  fireEvent: { pressIn: (element: unknown) => void; pressOut: (element: unknown) => void },
  element: unknown
): Promise<void> {
  fireEvent.pressIn(element);
  await wait(10);
  fireEvent.pressOut(element);
}

// ============================================================================
// Re-exports
// ============================================================================

export * from '@testing-library/react-native';
export { customRender as render };

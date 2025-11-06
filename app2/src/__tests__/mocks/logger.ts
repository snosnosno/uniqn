/**
 * Logger Mock Setup
 *
 * Jest Mock for logger utility used in tests.
 * Prevents actual console output and allows verification of log calls.
 */

// ========================================
// Logger Mock Functions
// ========================================

/**
 * Mock logger.info - Information logs
 */
export const mockLoggerInfo = jest.fn();

/**
 * Mock logger.error - Error logs
 */
export const mockLoggerError = jest.fn();

/**
 * Mock logger.warn - Warning logs
 */
export const mockLoggerWarn = jest.fn();

/**
 * Mock logger.debug - Debug logs
 */
export const mockLoggerDebug = jest.fn();

// ========================================
// Mock Logger Object
// ========================================

export const mockLogger = {
  info: mockLoggerInfo,
  error: mockLoggerError,
  warn: mockLoggerWarn,
  debug: mockLoggerDebug,
};

// ========================================
// Mock Module Setup
// ========================================

jest.mock('@/utils/logger', () => ({
  logger: mockLogger,
}));

// ========================================
// Helper Functions
// ========================================

/**
 * Reset all logger mocks
 * Call this in beforeEach() or afterEach()
 */
export const resetLoggerMocks = () => {
  mockLoggerInfo.mockClear();
  mockLoggerError.mockClear();
  mockLoggerWarn.mockClear();
  mockLoggerDebug.mockClear();
};

/**
 * Verify logger was called with specific message
 * @param level - Log level (info, error, warn, debug)
 * @param message - Expected message
 */
export const expectLoggerCalled = (level: 'info' | 'error' | 'warn' | 'debug', message: string) => {
  const mockFn = mockLogger[level];
  expect(mockFn).toHaveBeenCalledWith(expect.stringContaining(message), expect.any(Object));
};

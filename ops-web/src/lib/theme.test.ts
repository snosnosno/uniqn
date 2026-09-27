import { describe, expect, it } from 'vitest';
import { parseStoredTheme } from './theme';

describe('parseStoredTheme', () => {
  it('저장값이 없거나 이상하면 기본 다크', () => {
    expect(parseStoredTheme(null)).toBe('dark');
    expect(parseStoredTheme('')).toBe('dark');
    expect(parseStoredTheme('purple')).toBe('dark');
  });

  it('light/dark 는 그대로', () => {
    expect(parseStoredTheme('light')).toBe('light');
    expect(parseStoredTheme('dark')).toBe('dark');
  });
});

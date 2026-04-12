'use strict';

const { transformContent } = require('../migrate-semantic-tokens');

describe('transformContent — dark: 페어 치환', () => {
  it('text-secondary-900 dark:text-secondary-50 → text-content-primary', () => {
    const input = `className="text-secondary-900 dark:text-secondary-50 font-bold"`;
    const { content, modified } = transformContent(input);
    expect(content).toBe(`className="text-content-primary font-bold"`);
    expect(modified).toBe(true);
  });

  it('bg-white dark:bg-surface-elevated → bg-surface-card', () => {
    const input = `className="rounded bg-white dark:bg-surface-elevated p-4"`;
    expect(transformContent(input).content).toBe(`className="rounded bg-surface-card p-4"`);
  });

  it('border-secondary-200 dark:border-surface-overlay → border-divider', () => {
    const input = `className="border border-secondary-200 dark:border-surface-overlay"`;
    expect(transformContent(input).content).toBe(`className="border border-divider"`);
  });
});

describe('transformContent — 단독 클래스 치환 (P2 해결)', () => {
  it('단독 text-secondary-900 → text-content-primary', () => {
    const input = `className="text-secondary-900 text-sm"`;
    expect(transformContent(input).content).toBe(`className="text-content-primary text-sm"`);
  });

  it('단독 bg-secondary-100 → bg-surface-card', () => {
    const input = `className="rounded bg-secondary-100 p-2"`;
    expect(transformContent(input).content).toBe(`className="rounded bg-surface-card p-2"`);
  });

  it('변환 대상 없으면 modified=false', () => {
    const input = `className="text-primary-500 bg-surface"`;
    expect(transformContent(input).modified).toBe(false);
  });
});

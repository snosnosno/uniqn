import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { render } from '@testing-library/react-native';

import * as Icons from '../index';
import {
  BookmarkFilledIcon,
  BookmarkIcon,
  BookmarkOutlineIcon,
  HeartFilledIcon,
  HeartIcon,
  SearchIcon,
  getDefaultIconColor,
} from '../index';

// ─── 전체 export 스냅샷 ──────────────────────────────────────────────────────
// 래핑 레이어(createIcon / createFilledIcon / 커스텀 SVG) 전체가 안정적으로
// 렌더되는지 리그레션 감시. Lucide 업데이트로 경로/속성이 변하면 스냅샷이 깨져
// 의도적 승인 전까지 병합 차단.

type IconExportEntry = [string, React.FC<Record<string, unknown>>];

// 컴포넌트(PascalCase로 시작)만 필터 — `getDefaultIconColor` 같은 유틸 제외.
const iconEntries: IconExportEntry[] = (Object.entries(Icons) as [string, unknown][]).filter(
  (entry): entry is IconExportEntry => typeof entry[1] === 'function' && /^[A-Z]/.test(entry[0])
);

describe('icons snapshots', () => {
  it.each(iconEntries)('%s renders stable SVG output', (_name, Icon) => {
    const { toJSON } = render(<Icon />);
    expect(toJSON()).toMatchSnapshot();
  });
});

// ─── 팩토리 단위 테스트 ──────────────────────────────────────────────────────

describe('getDefaultIconColor', () => {
  it('returns light palette when color scheme is light', () => {
    expect(getDefaultIconColor('light')).toBe(SECONDARY_PALETTE[500]);
  });

  it('returns dark palette when color scheme is dark', () => {
    expect(getDefaultIconColor('dark')).toBe(SECONDARY_PALETTE[400]);
  });

  it('returns explicit color when provided, overriding theme', () => {
    expect(getDefaultIconColor('dark', '#123456')).toBe('#123456');
    expect(getDefaultIconColor('light', '#ABCDEF')).toBe('#ABCDEF');
  });

  it('defaults to light palette when color scheme is undefined', () => {
    expect(getDefaultIconColor(undefined)).toBe(SECONDARY_PALETTE[500]);
  });
});

describe('createIcon factory', () => {
  it('applies the default stroke width of 2.0 to wrapped Lucide icon', () => {
    const { toJSON } = render(<SearchIcon />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"strokeWidth":2');
  });

  it('honours an explicit strokeWidth prop passed by the caller', () => {
    const { toJSON } = render(<SearchIcon strokeWidth={1.25} />);
    expect(JSON.stringify(toJSON())).toContain('"strokeWidth":1.25');
  });

  it('uses the explicit color prop over the theme default', () => {
    const { toJSON } = render(<SearchIcon color="#FF00AA" />);
    expect(JSON.stringify(toJSON())).toContain('#FF00AA');
  });

  it('falls back to the light theme palette (mocked) when no color is given', () => {
    const { toJSON } = render(<SearchIcon />);
    // jest.setup.js 에서 nativewind mock이 colorScheme을 'light'로 고정함.
    expect(JSON.stringify(toJSON())).toContain(SECONDARY_PALETTE[500]);
  });
});

describe('createFilledIcon factory', () => {
  it('renders HeartFilledIcon with the default fill (#DC2626)', () => {
    const { toJSON } = render(<HeartFilledIcon />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain('#DC2626');
  });

  it('allows the caller to override the filled color', () => {
    const { toJSON } = render(<HeartFilledIcon color="#00FF00" />);
    expect(JSON.stringify(toJSON())).toContain('#00FF00');
  });

  it('renders BookmarkFilledIcon with the default gold fill (#D4A017)', () => {
    const { toJSON } = render(<BookmarkFilledIcon />);
    expect(JSON.stringify(toJSON())).toContain('#D4A017');
  });
});

describe('BookmarkIcon toggle API', () => {
  it('renders the outline variant when filled is false or omitted', () => {
    const { toJSON: toJsonUndefined } = render(<BookmarkIcon />);
    const { toJSON: toJsonExplicit } = render(<BookmarkIcon filled={false} />);
    const outlineRef = render(<BookmarkOutlineIcon />).toJSON();

    expect(JSON.stringify(toJsonUndefined())).toEqual(JSON.stringify(outlineRef));
    expect(JSON.stringify(toJsonExplicit())).toEqual(JSON.stringify(outlineRef));
  });

  it('renders the filled variant when filled=true', () => {
    const { toJSON } = render(<BookmarkIcon filled />);
    const filledRef = render(<BookmarkFilledIcon />).toJSON();
    expect(JSON.stringify(toJSON())).toEqual(JSON.stringify(filledRef));
  });
});

describe('CurrencyYenIcon deprecated alias', () => {
  it('is exported as an alias of CurrencyWonIcon (한국어 서비스 의미 교정)', () => {
    expect(Icons.CurrencyYenIcon).toBe(Icons.CurrencyWonIcon);
  });
});

describe('still renders without crashing (sanity regression)', () => {
  // Lucide RN(1.8.0)은 내부적으로 testID를 data-testid로 변환하므로 RNTL로는
  // 접근 불가. toJSON 으로 모든 아이콘이 렌더되는지 검증한다.
  it('renders a mix of outline, filled, custom, and alias icons', () => {
    const { toJSON } = render(
      <>
        <Icons.SearchIcon />
        <Icons.HeartFilledIcon />
        <Icons.BookmarkIcon filled />
        <Icons.BookmarkIcon />
        <Icons.CurrencyWonIcon />
        <Icons.MagnifyingGlassIcon />
        <HeartIcon />
      </>
    );
    const tree = toJSON();
    expect(tree).toBeTruthy();
    expect(Array.isArray(tree) ? tree.length : 0).toBe(7);
  });
});

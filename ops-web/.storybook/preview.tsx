import type { Decorator, Preview } from '@storybook/react-vite';
import { useEffect, type ReactNode } from 'react';
import '../src/index.css';

/** 앱과 같은 <html data-theme> 방식으로 테마를 적용한다. */
function ThemeFrame({ theme, children }: { theme: 'dark' | 'light'; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return <div className="bg-background p-4 text-foreground">{children}</div>;
}

/** 툴바에서 다크(기본)/라이트 전환. */
const withTheme: Decorator = (Story, context) => (
  <ThemeFrame theme={context.globals.theme === 'light' ? 'light' : 'dark'}>
    <Story />
  </ThemeFrame>
);

const preview: Preview = {
  globalTypes: {
    theme: {
      description: '테마',
      toolbar: {
        title: '테마',
        items: [
          { value: 'dark', title: '다크(기본)' },
          { value: 'light', title: '라이트' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'dark' },
  decorators: [withTheme],
  parameters: { layout: 'fullscreen' },
};

export default preview;

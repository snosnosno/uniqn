import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { AuthProvider } from '@/auth/AuthProvider';
import { Toaster } from '@/components/ui/sonner';
import { createQueryClient } from '@/lib/queryClient';
import { applyStoredTheme } from '@/lib/theme';
import { router } from '@/routes/router';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('#root 요소가 없습니다. index.html 을 확인하세요.');
}

// 렌더 전에 저장된 테마(기본 다크)를 반영한다.
applyStoredTheme();

const queryClient = createQueryClient();

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
      <Toaster position="bottom-center" />
    </QueryClientProvider>
  </StrictMode>
);

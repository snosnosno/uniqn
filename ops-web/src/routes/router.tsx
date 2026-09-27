import { createBrowserRouter, Navigate } from 'react-router';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppLayout } from './AppLayout';
import { RootLayout } from './RootLayout';
import { NotFoundPage } from './NotFoundPage';
import { RouteErrorPage } from './RouteErrorPage';

/**
 * 라우트 표 — 설계 §3.1.
 * 공개뷰(monitor·live)는 lazy 로 분리해 TV 전광판 첫 로딩을 가볍게 한다(설계 §11).
 * 콘솔 라우트는 RequireAuth 아래 — 비로그인이면 /login?redirect=… 로 보낸다(UX 가드, 데이터 보호는 RLS).
 */
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to="/tournaments" replace /> },
      { path: 'login', lazy: () => import('./auth/LoginPage') },
      { path: 'forgot-password', lazy: () => import('./auth/ForgotPasswordPage') },
      { path: 'reset-password', lazy: () => import('./auth/ResetPasswordPage') },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: 'tournaments', lazy: () => import('./tournaments/TournamentsPage') },
              { path: 'tournaments/new', lazy: () => import('./tournaments/NewTournamentPage') },
              {
                path: 'tournaments/:id/:tab?',
                lazy: () => import('./placeholders/TournamentConsolePage'),
              },
            ],
          },
        ],
      },
      { path: 'monitor/:token', lazy: () => import('./placeholders/MonitorPage') },
      { path: 'live/:viewToken', lazy: () => import('./placeholders/PlayerViewPage') },
      // 디자인 견본(D1) — 운영 빌드에는 넣지 않는다.
      ...(import.meta.env.MODE === 'production'
        ? []
        : [{ path: '_design', lazy: () => import('./design/DesignPage') }]),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

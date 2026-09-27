import { createBrowserRouter, Navigate } from 'react-router';
import { RootLayout } from './RootLayout';
import { NotFoundPage } from './NotFoundPage';
import { RouteErrorPage } from './RouteErrorPage';

/**
 * 라우트 표 — 설계 §3.1.
 * 화면 본체는 디자인 단계(D1~D4) 승인 후 슬라이스별로 채운다. 지금은 자리표시다.
 * 공개뷰(monitor·live)는 lazy 로 분리해 TV 전광판 첫 로딩을 가볍게 한다(설계 §11).
 */
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to="/tournaments" replace /> },
      { path: 'login', lazy: () => import('./placeholders/LoginPage') },
      { path: 'tournaments', lazy: () => import('./placeholders/TournamentsPage') },
      { path: 'tournaments/:id/:tab?', lazy: () => import('./placeholders/TournamentConsolePage') },
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

import { Outlet } from 'react-router';

export function RootLayout() {
  return (
    <div className="min-h-dvh bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <Outlet />
    </div>
  );
}

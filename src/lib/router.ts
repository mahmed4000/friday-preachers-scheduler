import { useEffect, useState } from 'react';

export type Route = '/' | '/schedule' | '/mosques' | '/preachers' | '/messages' | '/report' | '/settings';

export function navigate(path: string) {
  if (location.pathname + location.search === path) return;
  history.pushState(null, '', path);
  window.dispatchEvent(new Event('app:navigate'));
  window.scrollTo(0, 0);
}

export function usePath(): string {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener('popstate', on);
    window.addEventListener('app:navigate', on);
    return () => {
      window.removeEventListener('popstate', on);
      window.removeEventListener('app:navigate', on);
    };
  }, []);
  return path;
}

export function queryParam(name: string): string | null {
  return new URLSearchParams(location.search).get(name);
}

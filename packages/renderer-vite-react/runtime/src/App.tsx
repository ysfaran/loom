import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { routes } from './routes.gen';
import './styles.css';

const modules = import.meta.glob('../content/**/*.mdx');

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

type LoadedModule = {
  default?: ComponentType;
};

export default function App() {
  const [pathname, setPathname] = useState(() => normalizePathname(window.location.pathname));
  const [Component, setComponent] = useState<ComponentType | null>(null);

  const activePath = useMemo(() => {
    const known = routes.find((route) => route.route === pathname);
    return known ? known.route : '/';
  }, [pathname]);

  useEffect(() => {
    const onPopState = () => setPathname(normalizePathname(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const active = routes.find((route) => route.route === activePath) ?? routes[0];
    if (!active) {
      setComponent(null);
      return;
    }

    const key = `../content/${active.file}`;
    const loader = modules[key];
    if (!loader) {
      setComponent(null);
      return;
    }

    loader().then((mod) => {
      const loaded = mod as LoadedModule;
      setComponent(() => loaded.default ?? null);
    });
  }, [activePath]);

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[280px_1fr]">
      <aside className="border-b border-slate-200 bg-white p-4 md:border-b-0 md:border-r">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Docs</h2>
        <ul className="grid gap-2">
          {routes.map((route) => (
            <li key={route.file}>
              <a
                className="text-sm text-slate-900 no-underline hover:text-sky-600"
                href={route.route}
                onClick={(event) => {
                  event.preventDefault();
                  history.pushState({}, '', route.route);
                  setPathname(normalizePathname(route.route));
                }}
              >
                {route.route}
              </a>
            </li>
          ))}
        </ul>
      </aside>
      <main className="bg-slate-50 p-6">
        <div className="prose prose-slate prose-a:text-sky-600 prose-a:no-underline hover:prose-a:underline max-w-none">
          {Component ? <Component /> : <p>Loading...</p>}
        </div>
      </main>
    </div>
  );
}

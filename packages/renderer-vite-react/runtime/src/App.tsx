import React from 'react';

import { routes, siteTitle } from './loom.generated';

export function App(): React.JSX.Element {
  const [currentPath, setCurrentPath] = React.useState<string>(() => normalizePath(window.location.pathname));

  React.useEffect(() => {
    document.title = siteTitle;

    const onPopState = (): void => {
      setCurrentPath(normalizePath(window.location.pathname));
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const currentRoute = routes.find((route) => normalizePath(route.path) === currentPath) ?? null;

  const navigate = (event: React.MouseEvent<HTMLAnchorElement>, path: string): void => {
    event.preventDefault();
    const normalized = normalizePath(path);

    if (normalized === currentPath) {
      return;
    }

    history.pushState(null, '', normalized);
    setCurrentPath(normalized);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 md:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-200 bg-white p-6 md:border-b-0 md:border-r">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Documentation</p>
            <h1 className="mt-2 text-2xl font-bold">{siteTitle}</h1>
          </div>

          <nav>
            <ul className="space-y-2">
              {routes.map((route) => (
                <li key={route.path}>
                  <a
                    className={
                      normalizePath(route.path) === currentPath
                        ? 'block rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white'
                        : 'block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100'
                    }
                    href={route.path}
                    onClick={(event) => navigate(event, route.path)}
                  >
                    {route.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="p-6 md:p-10">
          {currentRoute ? (
            <article className="prose prose-slate max-w-none">
              <currentRoute.Component />
            </article>
          ) : (
            <article className="prose prose-slate max-w-none">
              <h1>Page not found</h1>
              <p>
                There is no document route for <code>{currentPath}</code>.
              </p>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

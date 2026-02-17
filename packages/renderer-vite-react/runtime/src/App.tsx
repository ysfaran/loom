import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { layout, siteTitle } from './plugin.gen';
import { routes } from './routes.gen';
import './styles.css';

const modules = import.meta.glob('../content/**/*.mdx');

type LoadedModule = {
  default?: ComponentType;
};

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function classNames(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export default function App() {
  const [pathname, setPathname] = useState(() => normalizePathname(window.location.pathname));
  const [Component, setComponent] = useState<ComponentType | null>(null);

  const activeRoute = useMemo(() => {
    const known = routes.find((route) => route.route === pathname);
    return known ?? routes[0] ?? null;
  }, [pathname]);

  useEffect(() => {
    const onPopState = () => setPathname(normalizePathname(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!activeRoute || activeRoute.kind !== 'mdx' || !activeRoute.file) {
      setComponent(null);
      return;
    }

    const key = `../content/${activeRoute.file}`;
    const loader = modules[key];
    if (!loader) {
      setComponent(null);
      return;
    }

    loader().then((mod) => {
      const loaded = mod as LoadedModule;
      setComponent(() => loaded.default ?? null);
    });
  }, [activeRoute]);

  const visibleRoutes = routes.filter((route) => route.showInSidebar);

  if (!activeRoute) {
    return <p>No pages found.</p>;
  }

  const showMdxSource = activeRoute.kind === 'mdx' && !activeRoute.mdxDecoration?.replaceContentHtml;
  const beforeContent = activeRoute.mdxDecoration?.beforeContentHtml ?? [];
  const afterContent = activeRoute.mdxDecoration?.afterContentHtml ?? [];
  const replacement = activeRoute.mdxDecoration?.replaceContentHtml;

  return (
    <div className={classNames('min-h-screen bg-slate-50 text-slate-900', layout.classNames.root)}>
      {!layout.hideDefaultHeader && (
        <header className={classNames('border-b border-slate-200 bg-white px-6 py-4', layout.classNames.header)}>
          <p className="text-sm font-semibold tracking-wide text-slate-700">{siteTitle}</p>
        </header>
      )}
      {layout.slots.header.map((html, index) => (
        <div key={`header-slot-${index}`} dangerouslySetInnerHTML={{ __html: html }} />
      ))}
      <div className="grid min-h-[calc(100vh-65px)] grid-cols-1 md:grid-cols-[280px_1fr]">
        {!layout.hideDefaultSidebar && (
          <aside
            className={classNames(
              'border-b border-slate-200 bg-white p-4 md:border-b-0 md:border-r',
              layout.classNames.sidebar
            )}
          >
            {layout.slots.sidebarTop.map((html, index) => (
              <div key={`sidebar-top-slot-${index}`} dangerouslySetInnerHTML={{ __html: html }} />
            ))}
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Docs</h2>
            <ul className="grid gap-2">
              {visibleRoutes.map((route) => (
                <li key={route.route}>
                  <a
                    className="text-sm text-slate-900 no-underline hover:text-sky-600"
                    href={route.route}
                    onClick={(event) => {
                      event.preventDefault();
                      history.pushState({}, '', route.route);
                      setPathname(normalizePathname(route.route));
                    }}
                  >
                    {route.navLabel}
                  </a>
                </li>
              ))}
            </ul>
            {layout.slots.sidebarBottom.map((html, index) => (
              <div key={`sidebar-bottom-slot-${index}`} dangerouslySetInnerHTML={{ __html: html }} />
            ))}
          </aside>
        )}
        <main className={classNames('p-6', layout.classNames.main)}>
          <article
            className={classNames(
              'prose prose-slate prose-a:text-sky-600 prose-a:no-underline hover:prose-a:underline max-w-none',
              layout.classNames.content
            )}
          >
            {beforeContent.map((html, index) => (
              <div key={`before-content-${index}`} dangerouslySetInnerHTML={{ __html: html }} />
            ))}
            {replacement && <div dangerouslySetInnerHTML={{ __html: replacement }} />}
            {activeRoute.kind === 'html' && <div dangerouslySetInnerHTML={{ __html: activeRoute.html ?? '' }} />}
            {showMdxSource && (Component ? <Component /> : <p>Loading...</p>)}
            {afterContent.map((html, index) => (
              <div key={`after-content-${index}`} dangerouslySetInnerHTML={{ __html: html }} />
            ))}
          </article>
        </main>
      </div>
      {!layout.hideDefaultFooter && (
        <footer className={classNames('border-t border-slate-200 bg-white px-6 py-3 text-sm text-slate-500', layout.classNames.footer)}>
          Built with Loom
        </footer>
      )}
      {layout.slots.footer.map((html, index) => (
        <div key={`footer-slot-${index}`} dangerouslySetInnerHTML={{ __html: html }} />
      ))}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Brand } from './components/Brand.js';
import { Icon } from './components/Icon.js';
import { pages, pageFromHash } from './navigation.js';
import { Dashboard } from './pages/Dashboard.js';
import { Placeholder } from './pages/Placeholder.js';
import { Settings } from './pages/Settings.js';
import type { ThemeChoice } from './pages/Settings.js';

function keepDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return;
  const controls = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]');
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function App() {
  const [page, setPage] = useState(() => pageFromHash(window.location.hash));
  const [theme, setTheme] = useState<ThemeChoice>('system');
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const mobileDialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const aboutDialog = useRef<HTMLDialogElement>(null);
  const active = pages.find((item) => item.id === page)!;

  useEffect(() => {
    const navigate = () => {
      setPage(pageFromHash(window.location.hash));
      mobileDialog.current?.close();
      requestAnimationFrame(() => heading.current?.focus());
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  useEffect(() => { document.title = `${active.label} · Hourvia`; }, [active.label]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const isDark = theme === 'system' ? media.matches : theme === 'dark';
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
      setDark(isDark);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const navigation = <nav aria-label="Workspace navigation"><span className="nav-label">YOUR WORKSPACE</span>{pages.map((item) => <a className={`nav-item ${page === item.id ? 'active' : ''}`} key={item.id} href={`#/${item.id}`} aria-current={page === item.id ? 'page' : undefined} onClick={() => mobileDialog.current?.close()}><Icon name={item.icon} /><span>{item.label}</span>{page === item.id && <span className="active-dot" />}</a>)}</nav>;
  const workspaceCard = <div className="workspace-card"><span className="workspace-avatar">P</span><div><strong>Personal workspace</strong><span>Shell preview · not connected</span></div><Icon name="chevron" /></div>;

  return <>
    <a href="#main" className="skip-link" onClick={(event) => { event.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
    <aside className="sidebar"><Brand />{workspaceCard}{navigation}<div className="sidebar-bottom"><div className="sidebar-note"><Icon name="spark" /><p>A little clarity.<br />A little more possibility.</p><span>MAKE TIME FOR WHAT MATTERS.</span></div><button className="company-button" onClick={() => aboutDialog.current?.showModal()}><span className="company-avatar">LI</span><span><strong>Living IT Solutions</strong><small>Thoughtfully built.</small></span><Icon name="arrow" /></button></div></aside>
    <div className="app-body"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => mobileDialog.current?.showModal()}><Icon name="menu" /></button><span className="breadcrumb-workspace">Workspace</span><Icon name="chevron" /><strong>{active.label}</strong></div><div className="topbar-actions"><span className="preview-badge"><span /> Foundation preview</span><span className="topbar-divider" /><button className="icon-button" aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} onClick={() => setTheme(dark ? 'light' : 'dark')}><Icon name={dark ? 'sun' : 'moon'} /></button><span className="preview-avatar" aria-label="Preview, no signed-in account">P</span></div></header>
    <main id="main" tabIndex={-1}><div className="page-heading"><div><p className="eyebrow">YOUR SPACE. YOUR PACE.</p><h1 ref={heading} tabIndex={-1}>{active.label}</h1><p className="page-description">{active.description}</p></div><span className="page-status"><span /> A fresh start</span></div>
      {page === 'dashboard' ? <Dashboard /> : page === 'settings' ? <Settings theme={theme} onThemeChange={setTheme} /> : <Placeholder page={page} />}
      <footer className="footer"><span>© {new Date().getUTCFullYear()} Hourvia <span className="footer-dot">·</span> by Living IT Solutions</span><span>Time tracked. Progress made.</span></footer>
    </main></div>
    <dialog ref={mobileDialog} className="mobile-dialog" aria-label="Navigation" onKeyDown={keepDialogFocus}><div className="dialog-header"><Brand /><button className="icon-button" aria-label="Close navigation" onClick={() => mobileDialog.current?.close()}><Icon name="close" /></button></div>{workspaceCard}{navigation}</dialog>
    <dialog ref={aboutDialog} className="about-dialog" aria-labelledby="about-title" onKeyDown={keepDialogFocus}><div className="dialog-header"><Brand /><button className="icon-button" aria-label="Close about dialog" onClick={() => aboutDialog.current?.close()}><Icon name="close" /></button></div><h2 id="about-title">Time tracked. Progress made.</h2><p>Hourvia by Living IT Solutions is a foundation for thoughtful personal and business time tracking.</p><p>This Sprint 0 preview has no signed-in account, saved workspaces, live timers, or business records. Navigation and appearance controls are available to explore.</p><span className="pill">ARCHITECTURE & FOUNDATION</span></dialog>
  </>;
}

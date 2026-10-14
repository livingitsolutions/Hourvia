import { brand, renderBrand } from './brand.js';

renderBrand();

const themeToggle = document.querySelector('#theme-toggle');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
let themePreference = 'system';

function applyTheme(preference) {
  themePreference = preference;
  const theme = preference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#101e25' : '#f6f8f7';
  themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  themeToggle.querySelector('use').setAttribute('href', theme === 'dark' ? '#i-sun' : '#i-moon');
  document.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === preference));
  });
}

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
document.querySelectorAll('[data-theme-choice]').forEach((button) => {
  button.addEventListener('click', () => applyTheme(button.dataset.themeChoice));
});
systemTheme.addEventListener('change', () => {
  if (themePreference === 'system') applyTheme('system');
});
applyTheme('system');

const menuToggle = document.querySelector('.mobile-menu');
const backdrop = document.querySelector('.sidebar-backdrop');
const sidebar = document.querySelector('#sidebar');
const mobileLayout = window.matchMedia('(max-width: 900px)');
const appBody = document.querySelector('.app-body');

function setMenu(open) {
  document.body.classList.toggle('menu-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  backdrop.hidden = !open;
  sidebar.inert = mobileLayout.matches && !open;
  appBody.inert = open;
  if (open) sidebar.querySelector('a').focus();
}

menuToggle.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
backdrop.addEventListener('click', () => { setMenu(false); menuToggle.focus(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('menu-open')) {
    setMenu(false);
    menuToggle.focus();
  }
  if (event.key === 'Tab' && document.body.classList.contains('menu-open')) {
    const links = [...sidebar.querySelectorAll('a, button:not(:disabled)')];
    const first = links[0];
    const last = links[links.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
mobileLayout.addEventListener('change', () => {
  setMenu(false);
});

function showPage(focus = false) {
  const page = window.location.hash === '#design-system' ? 'design-system' : 'overview';
  document.querySelectorAll('.page').forEach((section) => { section.hidden = section.id !== page; });
  document.querySelectorAll('[data-page]').forEach((link) => {
    const active = link.dataset.page === page;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const title = page === 'overview' ? 'Overview' : 'Design system';
  document.querySelector('#breadcrumb-page').textContent = title;
  document.title = `${brand.name} — ${title}`;
  setMenu(false);
  if (focus) {
    document.querySelector('#main').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}
window.addEventListener('hashchange', () => showPage(true));
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  if (link.getAttribute('href') === '#main') return;
  link.addEventListener('click', () => {
    if (link.hash === window.location.hash || (link.hash === '#overview' && !window.location.hash)) {
      setMenu(false);
      document.querySelector('#main').focus({ preventScroll: true });
    }
  });
});
showPage();

const aboutDialog = document.querySelector('#about-dialog');
document.querySelectorAll('[data-open-about]').forEach((button) => {
  button.addEventListener('click', () => { setMenu(false); aboutDialog.showModal(); });
});
document.querySelectorAll('.dialog-close, .dialog-done').forEach((button) => {
  button.addEventListener('click', () => aboutDialog.close());
});
aboutDialog.addEventListener('click', (event) => {
  const bounds = aboutDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) aboutDialog.close();
});
aboutDialog.addEventListener('close', () => {
  if (mobileLayout.matches && sidebar.contains(document.activeElement)) menuToggle.focus();
});

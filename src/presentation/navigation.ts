import type { IconName } from './components/Icon.js';

export const pages = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', description: 'A little clarity goes a long way.' },
  { id: 'timer', label: 'Timer', icon: 'timer', description: 'Make room for focused work.' },
  { id: 'timesheets', label: 'Timesheets', icon: 'timesheets', description: 'A clear record of the work behind your week.' },
  { id: 'adjustments', label: 'Adjustments', icon: 'adjustments', description: 'Make corrections. Keep the whole story.' },
  { id: 'projects', label: 'Projects', icon: 'projects', description: 'Give your time a little context.' },
  { id: 'reports', label: 'Reports', icon: 'reports', description: 'Turn tracked time into perspective.' },
  { id: 'settings', label: 'Settings', icon: 'settings', description: 'A workspace that feels like yours.' },
] as const satisfies readonly { id: string; label: string; icon: IconName; description: string }[];

export type PageId = typeof pages[number]['id'];

export function pageFromHash(hash: string): PageId {
  const candidate = hash.replace(/^#\/?/, '').split('?')[0];
  return pages.find((page) => page.id === candidate)?.id ?? 'dashboard';
}

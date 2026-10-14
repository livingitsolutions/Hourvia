export type IconName = 'dashboard' | 'timer' | 'timesheets' | 'adjustments' | 'projects' | 'reports' | 'settings' | 'arrow' | 'chevron' | 'sun' | 'moon' | 'menu' | 'close' | 'shield' | 'check' | 'spark' | 'workspace';

const paths: Record<IconName, string> = {
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  timer: 'M9 2h6 M12 6v2 M19 7l2 2 M12 12v4l3 2 M21 15a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  timesheets: 'M5 4h14v17H5z M9 2v4 M15 2v4 M8 10h8 M8 14h8 M8 18h5',
  adjustments: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  projects: 'M3 6h7l2 3h9v11H3z M3 6V4h7l2 2h9v3',
  reports: 'M4 3v18h17 M9 17v-6 M14 17V7 M19 17V4',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  chevron: 'M9 5l7 7-7 7',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5',
  moon: 'M20 14a9 9 0 0 1-10-10 9 9 0 1 0 10 10z',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  close: 'M6 6l12 12 M18 6L6 18',
  shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6',
  check: 'M5 12l4 4L19 6',
  spark: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  workspace: 'M3 21h18 M5 21V7h14v14 M9 7V3h6v4 M9 11h1 M14 11h1 M9 15h1 M14 15h1',
};

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

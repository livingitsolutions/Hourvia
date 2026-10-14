import { Icon } from '../components/Icon.js';
import type { PageId } from '../navigation.js';
import { pages } from '../navigation.js';

const copy: Record<Exclude<PageId, 'dashboard' | 'settings'>, { title: string; body: string; principles: readonly string[] }> = {
  timer: { title: 'A calmer way to keep track.', body: 'A focused timer for your personal or business workspace. Live tracking and saved entries arrive in a later sprint.', principles: ['One active timer per user and workspace', 'UTC instants, not browser-clock totals', 'Canonical durations in integer seconds'] },
  timesheets: { title: 'Your week, in perspective.', body: 'Bring your work into a clear record. Timesheet submission, reviews, and locking are planned, not enabled.', principles: ['Reporting periods preserve an IANA timezone', 'Submitted records are locked for review', 'Approved snapshots remain reproducible'] },
  adjustments: { title: 'Correct the record. Keep the story.', body: 'Thoughtful corrections without erasing original entries. Adjustment requests and approvals are planned, not enabled.', principles: ['Original entries remain immutable', 'Every correction carries a reason', 'Only approved revisions affect reports'] },
  projects: { title: 'A little context for every hour.', body: 'Organize work by project and client, within the right workspace. Project and client management arrive in a later sprint.', principles: ['Projects and clients belong to one workspace', 'Cross-workspace references are rejected', 'Archive context instead of erasing history'] },
  reports: { title: 'Less guesswork. More perspective.', body: 'Understand where your time goes, without losing the detail. Reporting queries and exports arrive in a later sprint.', principles: ['Use effective entries, never double-count revisions', 'Group UTC instants in the reporting timezone', 'Keep approved timesheet snapshots stable'] },
};

export function Placeholder({ page }: { page: Exclude<PageId, 'dashboard' | 'settings'> }) {
  const details = copy[page];
  const metadata = pages.find((item) => item.id === page)!;
  return <section className="placeholder-card" aria-labelledby="placeholder-title"><span className="placeholder-icon"><Icon name={metadata.icon} /></span><span className="eyebrow">A GOOD FOUNDATION COMES FIRST</span><h2 id="placeholder-title">{details.title}</h2><p className="placeholder-description">{details.body}</p>{page === 'timer' && <div className="timer-preview" aria-label="Timer preview, not running"><span>00:00:00</span><button className="button button-primary" disabled><Icon name="timer" /> Timer not enabled</button></div>}<div className="principles">{details.principles.map((principle) => <div key={principle}><Icon name="check" /><span>{principle}</span></div>)}</div><a className="text-link" href="#/dashboard">Back to dashboard <Icon name="arrow" /></a></section>;
}

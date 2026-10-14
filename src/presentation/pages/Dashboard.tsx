import { Icon } from '../components/Icon.js';

export function Dashboard() {
  return <>
    <section className="welcome-card" aria-labelledby="welcome-title">
      <div className="welcome-copy">
        <span className="hero-eyebrow"><span /> A LITTLE MORE INTENTION</span>
        <h2 id="welcome-title">Your time matters.<br /><span>Make it count.</span></h2>
        <p>Less wondering where the day went.<br className="desktop-break" /> More space for the work that moves you forward.</p>
        <a href="#/timer" className="button button-mint">Explore your timer <Icon name="arrow" /></a>
        <span className="hero-footnote">Time tracked. Progress made.</span>
      </div>
      <div className="clock-art" aria-hidden="true">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <div className="clock-face"><div className="clock-center" /><div className="clock-hand hand-short" /><div className="clock-hand hand-long" />{Array.from({ length: 12 }, (_, index) => <span key={index} className="clock-tick" style={{ transform: `rotate(${index * 30}deg)` }} />)}</div>
        <div className="floating-note"><span className="note-dot" /> A little focus. A lot of possibility.</div>
        <span className="art-cross cross-one">+</span><span className="art-cross cross-two">+</span>
      </div>
    </section>
    <section className="summary-grid" aria-label="Workspace overview">
      {[
        { label: 'TRACKED TIME', icon: 'timer' as const, text: 'Your work, one moment at a time' },
        { label: 'ACTIVE PROJECTS', icon: 'projects' as const, text: 'A home for every kind of work' },
        { label: 'TIMESHEET STATUS', icon: 'timesheets' as const, text: 'Your week, neatly brought together' },
      ].map((item) => <article className="summary-card" key={item.label}><div className="summary-top"><span>{item.label}</span><Icon name={item.icon} /></div><div className="summary-value">—<span>Not connected</span></div><p>{item.text}</p></article>)}
    </section>
    <section className="getting-started" aria-labelledby="getting-started-title">
      <div className="section-heading"><div><h2 id="getting-started-title">A thoughtful start</h2><p>Your workspace is taking shape. Here’s what’s ahead.</p></div><span className="pill">SPRINT 0 · FOUNDATION</span></div>
      <div className="journey-grid">
        <a className="journey-card" href="#/settings"><span className="step-number">01</span><Icon name="workspace" /><h3>A space of your own</h3><p>Personal work or a shared business. The right context for every hour.</p><span className="journey-link">Explore workspace settings <Icon name="arrow" /></span></a>
        <a className="journey-card" href="#/projects"><span className="step-number">02</span><Icon name="projects" /><h3>Bring your work together</h3><p>Connect time to projects and clients. See the purpose behind the minutes.</p><span className="journey-link">Explore projects <Icon name="arrow" /></span></a>
        <a className="journey-card" href="#/reports"><span className="step-number">03</span><Icon name="reports" /><h3>Find your perspective</h3><p>Clear timesheets and considered reports. Progress you can understand.</p><span className="journey-link">Explore reports <Icon name="arrow" /></span></a>
      </div>
    </section>
    <div className="foundation-note"><span className="foundation-note-icon"><Icon name="shield" /></span><div><strong>Good foundations. Better peace of mind.</strong><p>Workspace boundaries, immutable history, and server-side permissions are part of the architecture from day one.</p></div><span className="note-label">BUILT WITH INTENTION</span></div>
  </>;
}

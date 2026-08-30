import { NavLink } from 'react-router-dom';

const navigation = [
  ['/', 'Overview'],
  ['/benchmark', 'Benchmark'],
  ['/cases', 'Cases'],
  ['/viewer', 'JSONL Viewer'],
  ['/generator', 'Dataset Generator'],
  ['/methodology', 'Methodology'],
];

export default function AppShell({ children }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="wordmark" to="/">VoiceInk <span>Research</span></NavLink>
        <nav className="header-nav" aria-label="Application pages">
          {navigation.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : undefined}>{label}</NavLink>
          ))}
        </nav>
        <div className="project-state"><span />100 cases · 3 systems</div>
      </header>
      <main className="page" id="main-content">{children}</main>
    </div>
  );
}

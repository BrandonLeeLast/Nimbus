import { Outlet, NavLink } from 'react-router-dom';

const nav = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/releases', label: 'Releases' },
  { to: '/recon', label: 'Recon' },
  { to: '/settings', label: 'Settings' },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#1a1a1a]">
      <header className="bg-[#0a0a0a] border-b border-[#2a2a2a] px-6 flex items-center gap-10 h-12 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-5 bg-[#ff460b]" />
          <span className="text-white font-bold text-sm tracking-widest uppercase">Nimbus</span>
        </div>

        {/* Nav */}
        <nav className="flex items-center h-full">
          {nav.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `relative flex items-center h-full px-4 text-xs font-semibold tracking-wider uppercase transition-colors ${
                  isActive
                    ? 'text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#ff460b]'
                    : 'text-[#666] hover:text-[#aaa]'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 py-8 overflow-auto px-6">
        <Outlet />
      </main>
    </div>
  );
}

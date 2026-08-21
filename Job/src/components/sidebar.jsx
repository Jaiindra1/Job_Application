import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from '../Security/auth';

const Sidebar = () => {
    const navigate = useNavigate();
    const navItems = [
        { label: 'Dashboard', icon: 'dashboard', href: '/' },
        { label: 'Find Jobs', icon: 'search', href: '/find-jobs'},
        { label: 'Saved Jobs', icon: 'bookmark', href: '/saved-jobs' },
        { label: 'Applications', icon: 'description', href: '/applications' },
        { label: 'Companies', icon: 'business', href: '/companies' },
        { label: 'Resume', icon: 'description', href: '/resume' },
        { label: 'Profile', icon: 'person', href: '/profile' },
        { label: 'Skills & Insights', icon: 'analytics', href: '/skills-insights' },
        { label: 'Auto Apply', icon: 'auto_mode', href: '/auto-apply' },
    ]
    
    return (
        <aside className="hidden md:flex flex-col h-full py-stack-lg fixed left-0 top-0 w-sidebar-width bg-surface border-r border-outline-variant z-40">

        {/* Brand */}
        <div className="px-stack-lg mb-stack-lg flex items-center gap-stack-sm">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-tertiary flex items-center justify-center text-white font-headline-md text-headline-md font-bold shadow-[0_8px_18px_rgba(8,124,255,.28)]">
            J
          </div>

          <div>
            <h1 className="font-headline-md text-headline-md font-bold text-primary tracking-tight">
              JobPilot <span className="text-tertiary">AI</span>
            </h1>

            <p className="font-label-md text-label-md text-on-surface-variant">
              Your Career Agent
            </p>
          </div>
        </div>

        {/* Navigation */}  
        <nav className="flex-1 px-stack-sm space-y-1">
        { navItems.map((item) => {
            return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) => `flex items-center gap-stack-md px-stack-md py-stack-sm rounded-lg transition-all duration-200 border-l-4 ${
                    isActive
                      ? "bg-primary-container text-on-primary-container font-bold border-primary shadow-ambient-lvl1"
                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface border-transparent hover:border-outline-variant"
                  }`}
                >
                  {({ isActive }) => <>
                    <span className="material-symbols-outlined" style={{
                      fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                    }}>
                      {item.icon}
                    </span>
                    <span className="font-title-md text-title-md">
                      {item.label}
                    </span>
                  </>}
                </NavLink>
            )
        }) }

        </nav>

        {/* Profile */}
        <div className="mt-auto px-stack-sm border-t border-outline-variant pt-stack-sm mx-stack-sm">
          <a
            className="flex items-center gap-stack-md px-stack-md py-stack-sm rounded-lg hover:bg-surface-container-low transition-colors"
            href="#"
          >
            <img
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover shadow-ambient-lvl1"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB4HFf5kSwf--nYkh6VAW1hS6uTlHllAKLCwStdFrQjGsTm5Gf3ut4QomN9-e516KGzeK6mI5_qTw2giLB0ApToktHHlmpA45yp_VnffWImjlnkpxHUYmJgVlaPq-y7pu35PkjajDIN9p0glqFi_wqRhCwsneJsLgfSSVKwxjIGafYy4BFwzvG1ehoaIHE6Pz06-PTxx0jmchXJk_fXOAhFxJ-DQn_JusdqVnl_CUjFmBv9n4FvCVZaag"
            />

            <span className="font-title-md text-title-md text-on-surface font-semibold">
              Jai Indra Teja
            </span>
          </a>
          <button onClick={() => { logout(); navigate('/login'); }} className="mt-1 w-full flex items-center gap-stack-md px-stack-md py-stack-sm rounded-lg text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors">
            <span className="material-symbols-outlined">logout</span><span className="font-title-md text-title-md">Logout</span>
          </button>
        </div>
      </aside>
    )
}

export default Sidebar;

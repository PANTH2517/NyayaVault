import React from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Search,
  CheckSquare,
  AlertTriangle,
  History,
  ShieldCheck,
} from 'lucide-react';

export type ViewTab =
  | 'dashboard'
  | 'cases'
  | 'search'
  | 'approvals'
  | 'incidents'
  | 'audit';

interface SidebarProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  openIncidentsCount?: number;
  underReviewCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  openIncidentsCount = 0,
  underReviewCount = 0,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cases', label: 'Cases & Records', icon: Briefcase },
    { id: 'search', label: 'Search & Filter', icon: Search },
    {
      id: 'approvals',
      label: 'Approvals Queue',
      icon: CheckSquare,
      badge: underReviewCount > 0 ? underReviewCount : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'incidents',
      label: 'Security Incidents',
      icon: AlertTriangle,
      badge: openIncidentsCount > 0 ? openIncidentsCount : null,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    },
    { id: 'audit', label: 'Audit Trail & Integrity', icon: History },
  ];

  return (
    <aside className="w-64 bg-slate-900/60 border-r border-slate-800 p-4 space-y-6 flex flex-col justify-between shrink-0 font-sans">
      <div className="space-y-1">
        <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id as ViewTab)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* System Security Notice Footer */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-400 space-y-2 text-[11px]">
        <div className="flex items-center gap-2 text-emerald-400 font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>SHA-256 Protected</span>
        </div>
        <p className="text-[10px] leading-relaxed text-slate-500">
          All document modifications generate immutable versions and hash-chained audit events.
        </p>
      </div>
    </aside>
  );
};

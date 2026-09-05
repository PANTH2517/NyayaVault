import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Briefcase,
  Search,
  CheckSquare,
  AlertTriangle,
  History,
  ShieldCheck,
  BookOpen,
  Users,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ViewTab =
  | 'dashboard'
  | 'cases'
  | 'search'
  | 'approvals'
  | 'incidents'
  | 'audit'
  | 'about'
  | 'users'
  | 'security-controls';

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
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const sections = [
    {
      title: 'WORKSPACE',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'cases', label: 'Cases', icon: Briefcase },
        { id: 'search', label: 'Evidence Files', icon: Search },
        {
          id: 'approvals',
          label: 'Approvals',
          icon: CheckSquare,
          badge: underReviewCount > 0 ? underReviewCount : null,
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        },
      ],
    },
    {
      title: 'SECURITY',
      items: [
        { id: 'audit', label: 'Audit Trail', icon: History },
        {
          id: 'incidents',
          label: 'Security Incidents',
          icon: AlertTriangle,
          badge: openIncidentsCount > 0 ? openIncidentsCount : null,
          badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        },
      ],
    },
    {
      title: 'HELP',
      items: [{ id: 'about', label: 'How It Works', icon: BookOpen }],
    },
  ];

  if (isAdmin) {
    sections.push({
      title: 'ADMINISTRATION',
      items: [
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'security-controls', label: 'Security Controls', icon: ShieldAlert },
      ],
    });
  }

  return (
    <aside className="w-64 bg-slate-900/80 border-r border-slate-800 p-4 flex flex-col justify-between shrink-0 font-sans backdrop-blur-xl z-20">
      <div className="space-y-5">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 font-mono">
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id as ViewTab)}
                  className={`relative w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer group ${
                    isActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeSidebarTab"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 bg-amber-500/10 border border-amber-500/30 rounded-xl shadow-sm"
                    />
                  )}

                  <div className="relative z-10 flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`relative z-10 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Security Status Badge Footer */}
      <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-slate-400 space-y-1.5 text-xs font-sans">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-[11px]">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Integrity Verification Active</span>
        </div>
        <p className="text-[10px] leading-relaxed text-slate-500">
          Role & case access controls and audit logging enabled.
        </p>
      </div>
    </aside>
  );
};

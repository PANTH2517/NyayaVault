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
  Shield,
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
  | 'security-controls'
  | 'blockchain-network';

interface SidebarProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  openIncidentsCount?: number;
  underReviewCount?: number;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  openIncidentsCount = 0,
  underReviewCount = 0,
  onCloseMobile,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const handleItemClick = (tab: ViewTab) => {
    onTabChange(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

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
          badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
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
          badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        },
      ],
    },
    {
      title: 'HELP & SYSTEM',
      items: [{ id: 'about', label: 'How It Works', icon: BookOpen }],
    },
  ];

  if (isAdmin) {
    sections.push({
      title: 'ADMINISTRATION',
      items: [
        { id: 'blockchain-network', label: 'Blockchain Network', icon: ShieldCheck },
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'security-controls', label: 'Security Controls', icon: ShieldAlert },
      ],
    });
  }

  return (
    <aside
      aria-label="Main Navigation"
      className="w-full h-full bg-[#090d16]/90 border-r border-slate-800/80 p-4 flex flex-col justify-between shrink-0 font-sans backdrop-blur-2xl"
    >
      <div className="space-y-6">
        {/* Identity Header in Sidebar */}
        <div className="px-2 pt-1 pb-2 flex items-center gap-3 border-b border-slate-800/80">
          <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-white tracking-tight truncate">
              NyayaVault
            </div>
            <div className="text-[10px] text-slate-400 font-mono tracking-wider uppercase truncate">
              Evidence OS v2.0
            </div>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="space-y-4">
          {sections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400/80 font-mono mb-1">
                {section.title}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id as ViewTab)}
                    aria-label={item.label}
                    className={`relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                      isActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeSidebarTab"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                        className="absolute inset-0 bg-amber-500/10 border border-amber-500/30 rounded-xl shadow-sm"
                      />
                    )}

                    <div className="relative z-10 flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
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
        </nav>
      </div>

      {/* Security Status Badge Footer */}
      <div className="pt-4 border-t border-slate-800/80 space-y-2">
        <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800/80 text-slate-400 space-y-1.5 text-xs font-sans">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-[11px]">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Cryptographic Chain Active</span>
          </div>
          <p className="text-[10px] leading-relaxed text-slate-400">
            SHA-256 integrity verification, RBAC rules & blockchain anchor active.
          </p>
        </div>
      </div>
    </aside>
  );
};

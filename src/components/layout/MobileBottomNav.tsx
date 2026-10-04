import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Users,
  Menu,
} from 'lucide-react';
import { NavItem } from './Sidebar.tsx';

interface MobileBottomNavProps {
  currentTab: NavItem;
  onTabChange: (tab: NavItem) => void;
  onOpenMenu: () => void;
}

export function MobileBottomNav({
  currentTab,
  onTabChange,
  onOpenMenu,
}: MobileBottomNavProps) {
  const navItems = [
    { id: 'dashboard' as NavItem, label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'schedules' as NavItem, label: 'الجداول', icon: CalendarDays },
    { id: 'mosques' as NavItem, label: 'المساجد', icon: Building2 },
    { id: 'imams' as NavItem, label: 'الخطباء', icon: Users },
  ];

  const isMoreActive = ![
    'dashboard',
    'schedules',
    'mosques',
    'imams',
  ].includes(currentTab);

  return (
    <nav
      className="no-print fixed bottom-0 inset-x-0 bg-[#03261e]/95 dark:bg-[#021813]/98 backdrop-blur-md border-t border-emerald-900/80 z-30 lg:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.25)] select-none"
      dir="rtl"
      aria-label="التنقل السريع للجوال"
    >
      <div className="grid grid-cols-5 h-16 items-center px-1 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center h-full py-1.5 transition-all duration-150 cursor-pointer relative active:scale-95 ${
                isActive
                  ? 'text-amber-400 font-bold'
                  : 'text-emerald-200/70 hover:text-white'
              }`}
            >
              {isActive && (
                <span className="absolute top-1 w-6 h-1 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              )}
              <Icon
                className={`w-5 h-5 transition-transform ${
                  isActive ? 'scale-110 text-amber-300' : 'text-emerald-300/80'
                }`}
              />
              <span className="text-[10px] mt-1 font-heading leading-tight truncate">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* More (Opens Full Sidebar Drawer) */}
        <button
          onClick={onOpenMenu}
          className={`flex flex-col items-center justify-center h-full py-1.5 transition-all duration-150 cursor-pointer relative active:scale-95 ${
            isMoreActive
              ? 'text-amber-400 font-bold'
              : 'text-emerald-200/70 hover:text-white'
          }`}
          title="المزيد من القوائم والإعدادات"
        >
          {isMoreActive && (
            <span className="absolute top-1 w-6 h-1 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
          )}
          <Menu
            className={`w-5 h-5 transition-transform ${
              isMoreActive ? 'scale-110 text-amber-300' : 'text-emerald-300/80'
            }`}
          />
          <span className="text-[10px] mt-1 font-heading leading-tight truncate">
            المزيد
          </span>
        </button>
      </div>
    </nav>
  );
}

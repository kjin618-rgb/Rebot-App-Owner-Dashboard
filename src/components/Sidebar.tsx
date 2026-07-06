import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { LayoutDashboard, Users, MessageSquare, Sparkles, Settings, Coffee } from 'lucide-react';

interface SidebarProps {
  storeName?: string;
}

export default function Sidebar({ storeName = '리봇 베이커리' }: SidebarProps) {
  const { store_code = 'demo' } = useParams();

  const navItems = [
    { name: '홈', path: `/dashboard/${store_code}`, icon: LayoutDashboard },
    { name: '고객 관리', path: `/customers/${store_code}`, icon: Users },
    { name: '메시지 발송', path: `/messages/${store_code}`, icon: MessageSquare },
    { name: '콘텐츠 생성', path: `/content/${store_code}`, icon: Sparkles },
    { name: '설정', path: `/settings/${store_code}`, icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col w-[300px] h-screen bg-navy sticky top-0 shrink-0 p-5">
      {/* Brand Logo Header */}
      <div className="h-16 flex items-center gap-3 border-b border-white/10 pb-5 mb-5">
        <div className="w-14 h-14 rounded-lg bg-orange flex items-center justify-center shrink-0">
          <Coffee className="w-6 h-6 text-yellow" />
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-white tracking-tight text-heading-3 leading-none flex items-center gap-1.5">
            리봇 CRM
            <span className="text-micro font-bold text-navy bg-yellow px-1.5 py-0.5 rounded-md">AI</span>
          </h1>
          <p className="text-caption text-white/60 font-medium truncate mt-1" title={storeName}>
            {storeName}
          </p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-body-sm font-semibold tracking-wide transition-all duration-300 ${
                  isActive
                    ? 'bg-orange text-white font-bold'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0 text-yellow" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="pt-4 border-t border-white/10">
        <div className="bg-white/[0.06] border border-white/[0.16] rounded-lg p-5 text-center shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <p className="text-micro font-bold text-white/50 tracking-wider font-mono">STORE INSTANCE</p>
          <p className="text-caption text-white font-semibold font-mono mt-0.5 truncate" title={store_code}>
            {store_code}
          </p>
        </div>
      </div>
    </aside>
  );
}

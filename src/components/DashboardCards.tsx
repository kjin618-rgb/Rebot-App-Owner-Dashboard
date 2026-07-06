import React from 'react';
import { Users, CheckSquare, ShieldCheck, AlertCircle } from 'lucide-react';

interface DashboardCardsProps {
  totalCustomers: number;
  marketingConsentCount: number;
  churnSummary: {
    safe: number;
    watch: number;
    danger: number;
    churned: number;
  };
}

export default function DashboardCards({ totalCustomers, marketingConsentCount, churnSummary }: DashboardCardsProps) {
  const dangerAndWatch = (churnSummary?.watch || 0) + (churnSummary?.danger || 0);
  const consentRate = totalCustomers > 0 ? Math.round((marketingConsentCount / totalCustomers) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Total Customers — Orange 100% */}
      <div className="bg-orange rounded-xl p-6 flex items-start justify-between shadow-[0_10px_28px_rgba(28,47,58,0.10)]">
        <div className="space-y-2.5">
          <p className="text-white/80 text-micro font-bold uppercase tracking-wider">전체 등록 고객</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-number-xl font-extrabold text-white tracking-tight font-mono">{totalCustomers}</h3>
            <span className="text-white/90 text-body-sm font-semibold">명</span>
          </div>
          <p className="text-white/70 text-caption font-medium leading-normal">매장에 등록된 누적 단골 수</p>
        </div>
        <div className="w-11 h-11 rounded-lg bg-white flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-yellow" />
        </div>
      </div>

      {/* Marketing Consent — Yellow 100% */}
      <div className="bg-yellow rounded-xl p-6 flex items-start justify-between shadow-[0_10px_28px_rgba(28,47,58,0.10)]">
        <div className="space-y-2.5">
          <p className="text-navy/70 text-micro font-bold uppercase tracking-wider">마케팅 동의 고객</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-number-xl font-extrabold text-navy tracking-tight font-mono">{marketingConsentCount}</h3>
            <span className="text-navy/80 text-body-sm font-semibold">명</span>
            <span className="text-micro font-bold text-white bg-navy px-1.5 py-0.5 rounded-md ml-1.5 font-mono">
              {consentRate}%
            </span>
          </div>
          <p className="text-navy/70 text-caption font-medium leading-normal">메시지 즉시 발송 가능 고객</p>
        </div>
        <div className="w-11 h-11 rounded-lg bg-white flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-yellow" />
        </div>
      </div>

      {/* Danger & Watch — Navy 100% */}
      <div className="bg-navy rounded-xl p-6 flex items-start justify-between shadow-[0_10px_28px_rgba(28,47,58,0.10)]">
        <div className="space-y-2.5">
          <p className="text-white/70 text-micro font-bold uppercase tracking-wider">관심 및 이탈 위험군</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-number-xl font-extrabold text-white tracking-tight font-mono">{dangerAndWatch}</h3>
            <span className="text-white/80 text-body-sm font-semibold">명</span>
            <span className="text-micro font-semibold text-white/70 ml-1.5">
              (주의 {churnSummary?.watch || 0} / 위험 {churnSummary?.danger || 0})
            </span>
          </div>
          <p className="text-white/70 text-caption font-medium leading-normal">재방문 유도 및 타겟 마케팅 대상</p>
        </div>
        <div className="w-11 h-11 rounded-lg bg-white flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5 text-yellow" />
        </div>
      </div>
    </div>
  );
}

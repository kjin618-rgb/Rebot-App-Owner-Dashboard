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
      {/* Total Customers */}
      <div className="bg-white rounded-xl border border-border-soft p-6 flex items-start gap-4 shadow-card">
        <div className="w-11 h-11 rounded-lg bg-orange flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div className="space-y-2.5">
          <p className="text-navy text-body-sm font-semibold">전체 등록 고객</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-number-xl font-extrabold text-orange tracking-tight font-mono">{totalCustomers}</h3>
            <span className="text-muted text-body-sm font-semibold">명</span>
          </div>
          <p className="text-muted text-caption font-medium leading-normal">매장에 등록된 누적 단골 수</p>
        </div>
      </div>

      {/* Marketing Consent */}
      <div className="bg-white rounded-xl border border-border-soft p-6 flex items-start gap-4 shadow-card">
        <div className="w-11 h-11 rounded-lg bg-yellow flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div className="space-y-2.5">
          <p className="text-navy text-body-sm font-semibold">마케팅 동의 고객</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-number-xl font-extrabold text-yellow tracking-tight font-mono">{marketingConsentCount}</h3>
            <span className="text-muted text-body-sm font-semibold">명</span>
            <span className="text-micro font-bold text-orange bg-orange/10 px-1.5 py-0.5 rounded-md ml-1.5 font-mono">
              {consentRate}%
            </span>
          </div>
          <p className="text-muted text-caption font-medium leading-normal">메시지 즉시 발송 가능 고객</p>
        </div>
      </div>

      {/* Danger & Watch */}
      <div className="bg-white rounded-xl border border-border-soft p-6 flex items-start gap-4 shadow-card">
        <div className="w-11 h-11 rounded-lg bg-navy flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5 text-white" />
        </div>
        <div className="space-y-2.5">
          <p className="text-navy text-body-sm font-semibold">관심 및 이탈 위험군</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-number-xl font-extrabold text-navy tracking-tight font-mono">{dangerAndWatch}</h3>
            <span className="text-muted text-body-sm font-semibold">명</span>
            <span className="text-micro font-semibold text-muted ml-1.5">
              (주의 {churnSummary?.watch || 0} / 위험 {churnSummary?.danger || 0})
            </span>
          </div>
          <p className="text-muted text-caption font-medium leading-normal">재방문 유도 및 타겟 마케팅 대상</p>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { CustomerRow } from '../types';
import { CHURN_LABEL, CHURN_COLOR } from '../lib/churn';
import { User, Calendar, Check, X, StickyNote } from 'lucide-react';

interface CustomerTableProps {
  storeCode: string;
  customers: CustomerRow[];
  onSelectCustomer?: (customer: CustomerRow) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
}

export default function CustomerTable({
  storeCode, customers, onSelectCustomer,
  selectable = false, selectedIds, onToggleSelect, onToggleSelectAll,
}: CustomerTableProps) {
  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-white rounded-xl border border-border-soft text-center">
        <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center mb-4 text-muted">
          <User className="w-6 h-6" />
        </div>
        <p className="text-navy font-bold text-body-sm">조건에 맞는 고객이 없습니다.</p>
        <p className="text-muted text-caption mt-1">새로운 검색어나 탭을 선택해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border-soft overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface border-b border-border-soft text-muted text-micro font-bold uppercase tracking-wider">
              {selectable && (
                <th className="py-4.5 px-6 w-10">
                  <input
                    type="checkbox"
                    checked={customers.some(c => c.marketing_consent) && customers.filter(c => c.marketing_consent).every(c => selectedIds?.has(c.id))}
                    onChange={() => onToggleSelectAll?.()}
                    className="rounded border-border text-orange focus:ring-orange h-4 w-4 cursor-pointer"
                  />
                </th>
              )}
              <th className="py-4.5 px-6">고객명</th>
              <th className="py-4.5 px-6">전화번호</th>
              <th className="py-4.5 px-6">이탈 위험군</th>
              <th className="py-4.5 px-6">최근 방문일</th>
              <th className="py-4.5 px-6 text-center">총 방문 / 스탬프</th>
              <th className="py-4.5 px-6 text-center">마케팅 동의</th>
              <th className="py-4.5 px-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft text-caption text-navy">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-surface transition-colors duration-200 group">
                {selectable && (
                  <td className="py-4 px-6">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(customer.id) ?? false}
                      disabled={!customer.marketing_consent}
                      onChange={() => onToggleSelect?.(customer.id)}
                      className="rounded border-border text-orange focus:ring-orange h-4 w-4 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title={!customer.marketing_consent ? '마케팅 미동의 고객은 선택할 수 없습니다' : undefined}
                    />
                  </td>
                )}
                <td className="py-4 px-6 font-semibold text-navy">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface text-navy flex items-center justify-center font-bold text-caption border border-border-soft">
                      {customer.name ? customer.name[0] : '고'}
                    </div>
                    <span>{customer.name || '미등록 고객'}</span>
                    {customer.notes && (
                      <StickyNote className="w-3.5 h-3.5 text-yellow shrink-0" aria-label="메모 있음" />
                    )}
                  </div>
                </td>
                <td className="py-4 px-6 font-mono text-muted tracking-wide">{customer.phone_masked}</td>
                <td className="py-4 px-6">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-micro font-semibold border ${CHURN_COLOR[customer.churn_stage]}`}>
                    {CHURN_LABEL[customer.churn_stage]}
                  </span>
                </td>
                <td className="py-4 px-6 text-muted">
                  {customer.last_visit_at ? (
                    <div className="flex items-center gap-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-yellow" />
                      <span>{new Date(customer.last_visit_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                  ) : (
                    <span className="text-muted-soft">-</span>
                  )}
                </td>
                <td className="py-4 px-6 text-center font-medium">
                  <span className="font-bold text-navy font-mono text-body-sm">{customer.total_visits}</span>회 / <span className="font-bold text-orange font-mono text-body-sm">{customer.total_stamps}</span>개
                </td>
                <td className="py-4 px-6">
                  <div className="flex justify-center">
                    {customer.marketing_consent ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface text-navy text-micro font-bold border border-border-soft">
                        <Check className="w-3 h-3 stroke-[2.5] text-yellow" /> 수신동의
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface text-muted text-micro font-bold border border-border-soft">
                        <X className="w-3 h-3 stroke-[2.5]" /> 미동의
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-4 px-6 text-right">
                  <button
                    onClick={() => onSelectCustomer?.(customer)}
                    className="px-3.5 py-1.5 text-caption font-bold rounded-md text-navy bg-surface hover:bg-border-soft transition-all border border-border-soft cursor-pointer"
                  >
                    상세 정보
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

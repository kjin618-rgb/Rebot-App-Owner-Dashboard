import { ChurnStage } from '../types';

export const CHURN_LABEL: Record<ChurnStage, string> = {
  safe: '정상',
  watch: '관심 필요',
  danger: '이탈 위험',
  churned: '장기 미방문',
};

// 디자인 시스템 v2: 이탈 단계는 색상이 아니라 CHURN_LABEL의 문구로만 구분한다
// (Green/Blue/Purple/Red 금지, 상태는 텍스트로 표현).
export const CHURN_COLOR: Record<ChurnStage, string> = {
  safe: 'bg-surface text-navy border-border-soft',
  watch: 'bg-surface text-navy border-border-soft',
  danger: 'bg-surface text-navy border-border-soft',
  churned: 'bg-surface text-navy border-border-soft',
};

export function calcChurn(dates: string[]): ChurnStage {
  if (!dates || dates.length === 0) return 'churned';
  
  // Get latest date
  const sorted = [...dates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const lastVisit = new Date(sorted[0]);
  const now = new Date(); // Using 2026-06-28T23:12:07-07:00 as the reference time in general, or runtime
  const diffTime = Math.abs(now.getTime() - lastVisit.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 14) return 'safe';
  if (diffDays <= 30) return 'watch';
  if (diffDays <= 60) return 'danger';
  return 'churned';
}

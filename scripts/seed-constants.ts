export const STORE_CODES = ['cafe-rebot', 'cafe01', 'sweet-bakery'] as const;

export const SEED_PHONE_PREFIX = '0109999';

export const CHURN_STAGE_DAYS_AGO: Record<'safe' | 'watch' | 'danger' | 'churned', number[]> = {
  safe: [5, 10],
  watch: [18, 25],
  danger: [35, 50],
  churned: [75, 120],
};

export const SAMPLE_NAMES = [
  '김민준', '이서연', '박도윤', '최지우',
  '정하은', '강지호', '윤서아', '임도현',
];

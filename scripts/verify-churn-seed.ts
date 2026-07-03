import 'dotenv/config';
import { getSupabase } from '../src/lib/supabase';
import { calcChurn } from '../src/lib/churn';
import { STORE_CODES, SEED_PHONE_PREFIX, CHURN_STAGE_DAYS_AGO } from './seed-constants';

const EXPECTED_PER_STAGE = 2;
const STAGES = Object.keys(CHURN_STAGE_DAYS_AGO) as Array<keyof typeof CHURN_STAGE_DAYS_AGO>;

async function verifyStore(storeCode: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('store_code', storeCode)
    .single();

  if (!store) {
    console.log(`[FAIL] ${storeCode}: 매장이 존재하지 않음 (시드 실행 전)`);
    return false;
  }

  const { data: customers } = await supabase
    .from('customers')
    .select('phone, last_visit_at')
    .eq('store_id', store.id)
    .like('phone', `${SEED_PHONE_PREFIX}%`);

  const counts: Record<string, number> = { safe: 0, watch: 0, danger: 0, churned: 0 };
  for (const row of customers || []) {
    const stage = calcChurn([row.last_visit_at]);
    counts[stage]++;
  }

  let ok = true;
  for (const stage of STAGES) {
    const actual = counts[stage];
    if (actual !== EXPECTED_PER_STAGE) {
      console.log(`[FAIL] ${storeCode} / ${stage}: 기대 ${EXPECTED_PER_STAGE}건, 실제 ${actual}건`);
      ok = false;
    } else {
      console.log(`[OK]   ${storeCode} / ${stage}: ${actual}건`);
    }
  }
  return ok;
}

async function main() {
  let allOk = true;
  for (const storeCode of STORE_CODES) {
    const ok = await verifyStore(storeCode);
    allOk = allOk && ok;
  }

  if (!allOk) {
    console.error('\n검증 실패: 시드 데이터가 기대와 다릅니다.');
    process.exit(1);
  }
  console.log('\n검증 성공: 모든 매장의 이탈 단계 분포가 기대값과 일치합니다.');
}

main();

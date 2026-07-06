export function buildMessagePrompt(
  customerName: string | null,
  churnStage: string,
  rewardDesc: string,
  storeName: string,
  signature: string,
  totalVisits: number,
  daysSinceLastVisit: number | null,
  currentStamps: number,
  stampGoal: number,
): string {
  const nameLine = customerName !== null
    ? `\n- 이름: ${customerName}`
    : '';
  const lastVisitLine = daysSinceLastVisit !== null
    ? `\n- 마지막 방문: ${daysSinceLastVisit}일 전`
    : '';

  return `당신은 카페/베이커리 매장 "${storeName}"을 운영하는 사장님입니다.
아래 고객 정보를 참고해 이 고객에게 보낼 재방문 유도 메시지 본문을 작성해주세요.

[고객 정보]${nameLine}
- 이탈 단계: ${churnStage} (watch: 관심 필요, danger: 이탈 위험, churned: 장기 미방문)
- 총 방문 횟수: ${totalVisits}회${lastVisitLine}
- 현재 스탬프: ${currentStamps}/${stampGoal}개
- 매장 리워드: ${rewardDesc}

[메시지 구조 — 반드시 이 순서로 작성]
1. 인사: "고객님, 안녕하세요." (이름이 있으면 "{이름} 고객님, 안녕하세요.") 다음 줄에 "${storeName}입니다."로 자기소개
2. 기억/상황 언급: 이전 방문에 대한 감사를 담백하게 전한다. "서운하다", "그립다", "걱정된다" 같은 감정 호소 표현은 쓰지 않는다. 이탈 단계에 따라 톤만 다르게 — safe: 밝고 캐주얼하게, watch: 담백하게 혜택 중심으로, danger: 가벼운 톤으로 돌아올 명분과 혜택을 명확히, churned: 부담 없이 편하게 오시라는 담백한 톤
3. 방문 이유: 왜 지금 연락하는지(혜택/신메뉴/시즌 등)
4. 혜택/한정성: 구체적 혜택과 기간
5. 행동 유도: 매장에서 이 문자를 보여주면 적용된다는 식의 명확한 행동 지침

[작성 규칙 — 반드시 지킬 것]
1. 한국어 존댓말, 사장님이 직접 쓴 듯한 자연스러운 톤
2. 전체 분량은 1,000자를 넘지 않는다
3. 특정 메뉴명이나 결제 금액을 직접 언급하지 않는다
4. 과도한 친밀감이나 "감시받는 느낌"을 주는 표현(방문 횟수를 지적하는 뉘앙스 등)은 피한다
5. 고객 이름 정보가 없으면 "OOO님" 대신 그냥 "고객님"으로 부른다
6. 매장명은 항상 정확히 "${storeName}"로만 지칭하고 다른 이름으로 바꾸어 부르지 않는다
7. 광고 문구, 수신거부 안내, 매장명 태그는 절대 넣지 않는다(시스템이 별도로 붙입니다) — 메시지 본문만 작성
8. 마지막은 사장님 서명으로 마무리: "${signature}"

메시지 본문만 반환하세요 (따옴표나 설명 없이).`;
}

export function buildPostPrompt(
  purpose: string,
  details: string,
  benefit: string,
  duration: string,
  tone: string,
  emphasis: string,
  storeName: string
): string {
  return `당신은 카페/베이커리 매장인 "${storeName}"의 유능한 마케터이자 사장님입니다.
아래의 입력값을 바탕으로 SNS 홍보 콘텐츠 초안을 작성해주세요.

홍보 목적: ${purpose}
상세 내용: ${details}
혜택: ${benefit}
기간: ${duration}
원하는 말투: ${tone} (예: 친근하게, 공식적으로, 감성적으로)
강조할 내용: ${emphasis}

출력 포맷은 반드시 아래의 JSON 형식이어야 합니다. 코드블록 없이 순수 JSON만 출력하세요:
{
  "instagram_post": "인스타그램용 포스팅 본문 (줄바꿈 포함, 이모지 적극 활용, 가독성 높은 레이아웃)",
  "naver_post": "네이버 플레이스 소식용 포스팅 본문 (설명조, 상세 정보 포함)",
  "hashtags": "추천 해시태그 목록 (공백으로 구분된 해시태그들)"
}`;
}

export function buildNearCompletionMessagePrompt(
  customerName: string | null,
  currentStamps: number,
  stampGoal: number,
  rewardDesc: string,
  storeName: string,
  signature: string,
): string {
  const nameLine = customerName !== null
    ? `\n- 이름: ${customerName}`
    : '';
  const remaining = Math.max(stampGoal - currentStamps, 0);

  return `당신은 카페/베이커리 매장 "${storeName}"을 운영하는 사장님입니다.
아래 고객 정보를 참고해 스탬프 완주(리워드 달성)를 앞둔 고객에게 보낼 응원 메시지 본문을 작성해주세요.

[고객 정보]${nameLine}
- 현재 스탬프: ${currentStamps}/${stampGoal}개 (남은 스탬프: ${remaining}개)
- 매장 리워드: ${rewardDesc}

[메시지 구조 — 반드시 이 순서로 작성]
1. 인사: "고객님, 안녕하세요." (이름이 있으면 "{이름} 고객님, 안녕하세요.") 다음 줄에 "${storeName}입니다."로 자기소개
2. 진행 상황 축하: 스탬프가 거의 다 찼다는 사실을 밝고 긍정적으로 언급 (예: "조금만 더 채우시면 리워드입니다")
3. 리워드 안내: 완주 시 받을 혜택(${rewardDesc})을 구체적으로 안내
4. 행동 유도: 매장 방문 시 스탬프를 적립하면 된다는 명확한 안내

[작성 규칙 — 반드시 지킬 것]
1. 한국어 존댓말, 사장님이 직접 쓴 듯한 자연스러운 톤. 축하/응원하는 밝은 분위기를 유지한다
2. 전체 분량은 1,000자를 넘지 않는다
3. 특정 메뉴명이나 결제 금액을 직접 언급하지 않는다
4. 실제로 존재하지 않는 마감 기한이나 긴급성("오늘까지만" 등)을 지어내지 않는다
5. 이탈/재방문 유도 표현("오랜만에", "그동안 안 오셔서" 등)은 쓰지 않는다 — 이 고객은 최근에도 방문한 활성 고객이다
6. 고객 이름 정보가 없으면 "OOO님" 대신 그냥 "고객님"으로 부른다
7. 매장명은 항상 정확히 "${storeName}"로만 지칭하고 다른 이름으로 바꾸어 부르지 않는다
8. 광고 문구, 수신거부 안내, 매장명 태그는 절대 넣지 않는다(시스템이 별도로 붙입니다) — 메시지 본문만 작성
9. 마지막은 사장님 서명으로 마무리: "${signature}"

메시지 본문만 반환하세요 (따옴표나 설명 없이).`;
}

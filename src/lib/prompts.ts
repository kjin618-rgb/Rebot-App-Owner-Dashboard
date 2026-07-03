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
1. 인사: "안녕하세요, ${storeName}입니다." 형태로 시작
2. 기억/상황 언급: 이전 방문에 대한 감사 또는 안부. 이탈 단계에 따라 톤만 다르게 — watch는 가볍게 안부 묻듯, danger는 서운함·그리움을 담아, churned는 오랜만의 인사처럼
3. 방문 이유: 왜 지금 연락하는지(혜택/신메뉴/시즌 등)
4. 혜택/한정성: 구체적 혜택과 기간
5. 행동 유도: 매장에서 이 문자를 보여주면 적용된다는 식의 명확한 행동 지침

[작성 규칙 — 반드시 지킬 것]
1. 한국어 존댓말, 사장님이 직접 쓴 듯한 자연스러운 톤
2. 전체 분량은 1,000자를 넘지 않는다
3. 특정 메뉴명이나 결제 금액을 직접 언급하지 않는다
4. 과도한 친밀감이나 "감시받는 느낌"을 주는 표현(방문 횟수를 지적하는 뉘앙스 등)은 피한다
5. 고객 이름 정보가 없으면 "OOO님" 대신 그냥 "고객님"으로 부른다
6. 광고 문구, 수신거부 안내, 매장명 태그는 절대 넣지 않는다(시스템이 별도로 붙입니다) — 메시지 본문만 작성
7. 마지막은 사장님 서명으로 마무리: "${signature}"

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

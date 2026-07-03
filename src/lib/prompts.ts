export function buildMessagePrompt(
  customerName: string,
  churnStage: string,
  rewardDesc: string,
  storeName: string,
  signature: string,
  totalVisits: number,
  daysSinceLastVisit: number | null,
  currentStamps: number,
  stampGoal: number,
): string {
  const lastVisitLine = daysSinceLastVisit !== null
    ? `\n- 마지막 방문: ${daysSinceLastVisit}일 전`
    : '';

  return `당신은 카페/베이커리 매장 "${storeName}"을 운영하는 사장님입니다.
아래 고객 정보를 참고해 이 고객에게 보낼 재방문 유도 메시지를 작성해주세요.

[고객 정보]
- 이름: ${customerName}
- 이탈 단계: ${churnStage} (safe: 최근 방문, watch: 관심 필요, danger: 이탈 위험, churned: 장기 미방문)
- 총 방문 횟수: ${totalVisits}회${lastVisitLine}
- 현재 스탬프: ${currentStamps}/${stampGoal}개
- 매장 리워드: ${rewardDesc}

[작성 규칙 — 반드시 지킬 것]
1. 한국어 존댓말, 사장님이 직접 안부를 묻는 듯한 자연스러운 톤으로 작성한다.
2. 전체 분량은 2~3문장 이내로 작성한다 (카카오 알림톡 발송을 고려).
3. 특정 메뉴명이나 결제 금액을 직접 언급하지 않는다.
4. 과도한 친밀감이나 "감시받는 느낌"을 주는 표현(예: 방문 횟수를 지적하는 뉘앙스)은 피한다.
5. 마지막은 매장명 또는 아래 서명으로 마무리한다: "${signature}"

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

import React from 'react';
import { UserCheck, UserPlus, FileText, Send, Clock } from 'lucide-react';
import { ActivityItem } from '../lib/mock';

interface ActivityFeedProps {
  activities: ActivityItem[];
}

function formatTimeAgo(isoString: string): string {
  try {
    const past = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - past.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));

    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}일 전`;
  } catch {
    return '최근';
  }
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
  if (!activities || activities.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border-soft shadow-card p-6 text-center text-muted">
        최근 활동 내역이 없습니다.
      </div>
    );
  }

  const iconMap = {
    stamp: { icon: UserCheck, text: '스탬프 적립' },
    new_customer: { icon: UserPlus, text: '신규 고객 등록' },
    draft_created: { icon: FileText, text: 'AI 메시지 초안 생성' },
    message_sent: { icon: Send, text: '메시지 발송 완료' },
  };

  return (
    <div className="bg-white rounded-xl border border-border-soft shadow-card p-6 space-y-4 h-full">
      <div className="flex items-center justify-between border-b border-border-soft pb-3">
        <h4 className="font-semibold text-navy text-heading-3">실시간 매장 활동 피드</h4>
        <span className="flex items-center gap-1 text-micro font-semibold text-navy bg-surface px-2 py-0.5 rounded-full border border-border-soft">
          <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" /> LIVE
        </span>
      </div>

      <div className="relative pl-4 space-y-6 before:absolute before:left-[21px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border-soft">
        {activities.map((activity, idx) => {
          const config = iconMap[activity.type] || iconMap.stamp;
          const Icon = config.icon;
          return (
            <div key={idx} className="relative flex items-start gap-4 group">
              {/* Icon Container */}
              <div className="w-9 h-9 rounded-lg flex items-center justify-center border border-border-soft shrink-0 z-10 bg-white">
                <Icon className="w-4 h-4 text-yellow" />
              </div>

              {/* Content Box */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption font-semibold text-muted">{config.text}</span>
                  <span className="text-micro text-muted font-medium flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-muted-soft" />
                    {formatTimeAgo(activity.occurred_at)}
                  </span>
                </div>

                <p className="text-body-sm text-navy mt-1 leading-snug">
                  {activity.type === 'stamp' && (
                    <span>
                      <strong className="font-semibold text-navy">{activity.customer_name || '미등록'}</strong> 고객님에게 스탬프가 적립되었습니다.
                    </span>
                  )}
                  {activity.type === 'new_customer' && (
                    <span>
                      신규 고객 <strong className="font-semibold text-navy">{activity.customer_name || '미등록'}</strong>님이 등록되었습니다. ({activity.phone_masked})
                    </span>
                  )}
                  {activity.type === 'draft_created' && (
                    <span>
                      <strong className="font-semibold text-navy">{activity.customer_name}</strong> 고객용 맞춤 재방문 AI 메시지 초안이 생성되었습니다.
                    </span>
                  )}
                  {activity.type === 'message_sent' && (
                    <span>
                      <strong className="font-semibold text-navy">{activity.customer_name}</strong> 고객님에게 재방문 혜택 메시지가 전송되었습니다.
                    </span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { isToday, isFuture, parseISO } from 'date-fns';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { MeetingCard } from './MeetingCard';

export function HomeDashboard() {
  const router = useRouter();
  const { meetings, setCurrentMeeting } = useSidebar();

  const sortedMeetings = useMemo(
    () =>
      [...meetings]
        .filter((m) => m.id && !m.id.startsWith('intro-call'))
        .sort((a, b) => {
          const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bDate - aDate;
        }),
    [meetings]
  );

  const todayMeetings = sortedMeetings.filter((m) => {
    if (!m.created_at) return false;
    try {
      return isToday(parseISO(m.created_at));
    } catch {
      return isToday(new Date(m.created_at));
    }
  });

  const upcomingMeetings = sortedMeetings.filter((m) => {
    if (!m.created_at) return false;
    try {
      return isFuture(parseISO(m.created_at));
    } catch {
      return false;
    }
  });

  const recentMeetings = sortedMeetings.filter(
    (m) => !todayMeetings.includes(m) && !upcomingMeetings.includes(m)
  );

  const openMeeting = (id: string, title: string) => {
    setCurrentMeeting({ id, title });
    router.push(`/meeting-details?id=${id}`);
  };

  const renderSection = (
    title: string,
    items: typeof sortedMeetings,
    variant: 'today' | 'upcoming' | 'default',
    emptyMessage: string
  ) => (
    <section className="rounded-2xl bg-muted/40 p-5 border border-border/40">
      <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {items.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              id={meeting.id}
              title={meeting.title}
              createdAt={meeting.created_at}
              variant={variant}
              onClick={() => openMeeting(meeting.id, meeting.title)}
            />
          ))}
        </div>
      )}
    </section>
  );

  if (sortedMeetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center mb-4">
          <Calendar className="w-8 h-8 text-brand-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No meetings yet</h2>
        <p className="text-muted-foreground max-w-md">
          Start a new recording to capture transcripts and summaries. Your meetings will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-4xl mx-auto w-full">
      {upcomingMeetings.length > 0 &&
        renderSection('Coming up', upcomingMeetings, 'upcoming', 'No upcoming meetings')}
      {todayMeetings.length > 0 &&
        renderSection('Today', todayMeetings, 'today', 'No meetings today')}
      {recentMeetings.length > 0 &&
        renderSection('Recent', recentMeetings, 'default', 'No recent meetings')}
    </div>
  );
}

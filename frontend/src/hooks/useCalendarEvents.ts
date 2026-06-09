'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarEvent,
  getCalendarIntegrationEnabled,
  getUpcomingCalendarEvents,
} from '@/services/calendarService';

export function useCalendarEvents() {
  const [enabled, setEnabled] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isEnabled = await getCalendarIntegrationEnabled();
      setEnabled(isEnabled);
      if (!isEnabled) {
        setEvents([]);
        return;
      }
      const upcoming = await getUpcomingCalendarEvents();
      setEvents(upcoming);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load calendar events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { enabled, events, loading, error, refresh };
}

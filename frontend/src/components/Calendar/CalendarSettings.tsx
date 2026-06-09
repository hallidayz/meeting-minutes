'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, ExternalLink, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  CalendarInfo,
  CalendarPermissionStatus,
  CalendarSettings as CalendarSettingsType,
  getCalendarIntegrationEnabled,
  getCalendarPermissionStatus,
  getCalendarSettings,
  listCalendars,
  openSystemCalendarSettings,
  requestCalendarPermission,
  setCalendarIntegrationEnabled,
  setCalendarSettings,
} from '@/services/calendarService';

const PERMISSION_LABELS: Record<CalendarPermissionStatus, string> = {
  granted: 'Access granted',
  denied: 'Access denied',
  not_determined: 'Not requested yet',
  restricted: 'Restricted by system policy',
  unsupported_platform: 'Not supported on this platform',
};

export function CalendarSettings() {
  const [integrationEnabled, setIntegrationEnabled] = useState(false);
  const [permission, setPermission] = useState<CalendarPermissionStatus | null>(null);
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [enabledIds, setEnabledIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const enabled = await getCalendarIntegrationEnabled();
      setIntegrationEnabled(enabled);
      if (!enabled) {
        setPermission(null);
        setCalendars([]);
        setEnabledIds([]);
        return;
      }
      const settings: CalendarSettingsType = await getCalendarSettings();
      setEnabledIds(settings.enabled_calendar_ids);
      try {
        const status = await getCalendarPermissionStatus();
        setPermission(status);
        if (status === 'granted') {
          const list = await listCalendars();
          setCalendars(list);
          if (settings.enabled_calendar_ids.length === 0 && list.length > 0) {
            setEnabledIds(list.map((c) => c.id));
          }
        } else {
          setCalendars([]);
        }
      } catch (e) {
        setPermission('unsupported_platform');
        setCalendars([]);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load calendar settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleIntegration = async (checked: boolean) => {
    setSaving(true);
    try {
      await setCalendarIntegrationEnabled(checked);
      setIntegrationEnabled(checked);
      if (checked) {
        await load();
        toast.success('Calendar integration enabled');
      } else {
        setPermission(null);
        setCalendars([]);
        toast.success('Calendar integration disabled');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update calendar setting');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPermission = async () => {
    setSaving(true);
    try {
      const status = await requestCalendarPermission();
      setPermission(status);
      if (status === 'granted') {
        const list = await listCalendars();
        setCalendars(list);
        if (enabledIds.length === 0 && list.length > 0) {
          await persistEnabledIds(list.map((c) => c.id));
        }
        toast.success('Calendar access granted');
      } else {
        toast.error('Calendar access was not granted');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to request calendar access');
    } finally {
      setSaving(false);
    }
  };

  const persistEnabledIds = async (ids: string[]) => {
    const settings = await getCalendarSettings();
    await setCalendarSettings({
      ...settings,
      enabled_calendar_ids: ids,
    });
    setEnabledIds(ids);
  };

  const handleCalendarToggle = async (calendarId: string, checked: boolean) => {
    const next = checked
      ? [...enabledIds, calendarId]
      : enabledIds.filter((id) => id !== calendarId);
    setSaving(true);
    try {
      await persistEnabledIds(next);
    } catch (e) {
      toast.error('Failed to save calendar selection');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <Calendar className="w-5 h-5 text-brand-primary mt-0.5" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">Calendar Integration</h3>
          <p className="text-sm text-gray-600 mt-1">
            Read upcoming meetings from calendars you already use in macOS Calendar, Windows
            Calendar, or GNOME Calendar. No account linking inside AI Guardian.
          </p>
        </div>
        <Switch
          checked={integrationEnabled}
          onCheckedChange={handleToggleIntegration}
          disabled={saving || loading}
        />
      </div>

      {integrationEnabled && (
        <div className="space-y-4 border-t border-gray-100 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-700">
              Permission:{' '}
              <strong>
                {permission ? PERMISSION_LABELS[permission] : loading ? 'Checking…' : 'Unknown'}
              </strong>
            </span>
            {permission !== 'granted' && permission !== 'unsupported_platform' && (
              <Button size="sm" onClick={handleRequestPermission} disabled={saving}>
                Grant calendar access
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => openSystemCalendarSettings().catch(console.error)}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              System calendar settings
            </Button>
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {permission === 'granted' && calendars.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-800">Calendars to include</p>
              {calendars.map((cal) => (
                <label
                  key={cal.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium">{cal.title}</p>
                    {cal.source && (
                      <p className="text-xs text-gray-500">{cal.source}</p>
                    )}
                  </div>
                  <Switch
                    checked={enabledIds.includes(cal.id)}
                    onCheckedChange={(checked) => handleCalendarToggle(cal.id, checked)}
                    disabled={saving}
                  />
                </label>
              ))}
            </div>
          )}

          {permission === 'granted' && calendars.length === 0 && !loading && (
            <p className="text-sm text-gray-600">
              No calendars found. Add accounts in your system calendar app, then refresh.
            </p>
          )}

          {permission === 'unsupported_platform' && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Native calendar read is not available on this platform yet. Disable integration to
              hide calendar features.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

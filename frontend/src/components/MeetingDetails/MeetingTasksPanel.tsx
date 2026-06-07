'use client';

import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GuardianTask } from '@/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface MeetingTasksPanelProps {
  meetingId: string;
  actionItems?: string[];
}

export function MeetingTasksPanel({ meetingId, actionItems = [] }: MeetingTasksPanelProps) {
  const [tasks, setTasks] = useState<GuardianTask[]>([]);

  const loadTasks = async () => {
    const all = await invoke<GuardianTask[]>('list_tasks');
    setTasks(all.filter((t) => t.meeting_id === meetingId));
  };

  useEffect(() => {
    loadTasks().catch(console.error);
  }, [meetingId]);

  const handlePromote = async () => {
    if (actionItems.length === 0) {
      toast.info('No action items to promote');
      return;
    }
    await invoke('promote_action_items', {
      request: { meeting_id: meetingId, items: actionItems },
    });
    await loadTasks();
    toast.success('Action items promoted to tasks');
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-brand-primary">Meeting Tasks</h3>
        {actionItems.length > 0 && (
          <Button size="sm" onClick={handlePromote} className="bg-brand-accent text-brand-primary">
            Promote Action Items ({actionItems.length})
          </Button>
        )}
      </div>
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="p-2 border rounded bg-gray-50 text-sm">{task.title}</li>
        ))}
        {tasks.length === 0 && <p className="text-sm text-gray-500">No tasks linked to this meeting.</p>}
      </ul>
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GuardianTask } from '@/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface MeetingTasksPanelProps {
  meetingId: string;
  actionItems?: string[];
  refreshTrigger?: number;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return value;
  }
}

export function MeetingTasksPanel({ meetingId, actionItems = [], refreshTrigger = 0 }: MeetingTasksPanelProps) {
  const [tasks, setTasks] = useState<GuardianTask[]>([]);

  const loadTasks = async () => {
    const all = await invoke<GuardianTask[]>('list_tasks');
    setTasks(all.filter((t) => t.meeting_id === meetingId));
  };

  useEffect(() => {
    loadTasks().catch(console.error);
  }, [meetingId, refreshTrigger]);

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

  const handleStatusChange = async (task: GuardianTask, status: GuardianTask['status']) => {
    await invoke('update_task', { request: { id: task.id, status } });
    await loadTasks();
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full w-full">
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
          <li key={task.id} className="p-3 border rounded bg-white text-sm space-y-2">
            <div className="flex items-start gap-2">
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(task, e.target.value as GuardianTask['status'])}
                className="text-xs border rounded px-2 py-1 shrink-0"
              >
                <option value="todo">To Do</option>
                <option value="inprogress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <span className={`flex-1 ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>
                {task.title}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 pl-1">
              <span>Due: {task.due_date ? formatDateTime(task.due_date) : '—'}</span>
              <span>Created: {formatDateTime(task.created_at)}</span>
            </div>
            {task.notes && (
              <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{task.notes}</p>
            )}
          </li>
        ))}
        {tasks.length === 0 && <p className="text-sm text-gray-500">No tasks linked to this meeting.</p>}
      </ul>
    </div>
  );
}

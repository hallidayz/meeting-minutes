'use client';

import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GuardianTask } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Bell, Mail, Trash2 } from 'lucide-react';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

function formatDueDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return value;
  }
}

export function TaskManager() {
  const [tasks, setTasks] = useState<GuardianTask[]>([]);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<GuardianTask['priority']>('medium');
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const loadTasks = async () => {
    const data = await invoke<GuardianTask[]>('list_tasks');
    setTasks(data);
    setNoteDrafts((prev) => {
      const next = { ...prev };
      for (const task of data) {
        if (next[task.id] === undefined) {
          next[task.id] = task.notes ?? '';
        }
      }
      return next;
    });
  };

  useEffect(() => {
    loadTasks().catch(console.error);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await invoke('create_task', {
      request: {
        title: title.trim(),
        priority,
        status: 'todo',
        due_date: dueDate || null,
      },
    });
    setTitle('');
    setDueDate('');
    await loadTasks();
    toast.success('Task created');
  };

  const handleUpdate = async (task: GuardianTask, patch: Partial<GuardianTask>) => {
    await invoke('update_task', {
      request: {
        id: task.id,
        ...patch,
      },
    });
    await loadTasks();
  };

  const handleStatusChange = async (task: GuardianTask, status: GuardianTask['status']) => {
    await handleUpdate(task, { status });
  };

  const handleDueDateChange = async (task: GuardianTask, due_date: string) => {
    await handleUpdate(task, { due_date: due_date || null });
  };

  const handleSaveNotes = async (task: GuardianTask) => {
    const notes = noteDrafts[task.id] ?? '';
    await handleUpdate(task, { notes });
    toast.success('Notes saved');
  };

  const handleNotify = async (task: GuardianTask) => {
    try {
      await invoke('notify_task', { taskId: task.id });
      toast.success('Desktop notification sent');
    } catch (e) {
      toast.error('Failed to send notification', { description: String(e) });
    }
  };

  const handleEmail = async (task: GuardianTask) => {
    try {
      await invoke('email_task', { taskId: task.id, recipient: null });
      toast.success('Opening your default mail app…');
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleDelete = async (id: string) => {
    await invoke('delete_task', { id });
    await loadTasks();
  };

  const toggleNotes = (id: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Tasks</h1>
        <p className="text-sm text-gray-600">
          Track action items with meeting context, notes, due dates, reminders, and email.
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex flex-wrap gap-2 items-end bg-white border rounded-lg p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-gray-500 mb-1 block">Task</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New task…" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Due date</label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as GuardianTask['priority'])}
            className="px-3 py-2 border rounded-md h-10"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <Button type="submit" className="bg-brand-primary">Add Task</Button>
      </form>

      <div className="hidden md:grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <span>Task</span>
        <span>Meeting</span>
        <span>Meeting Date</span>
        <span>Due Date</span>
        <span>Actions</span>
      </div>

      <ul className="space-y-3">
        {tasks.map((task) => {
          const notesOpen = expandedNotes.has(task.id);
          return (
            <li key={task.id} className="bg-white border rounded-lg overflow-hidden">
              <div className="p-3 grid md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-3 items-start">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task, e.target.value as GuardianTask['status'])}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="todo">To Do</option>
                      <option value="inprogress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                    <span className={`text-xs uppercase font-semibold text-brand-accent`}>{task.priority}</span>
                  </div>
                  <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {task.title}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleNotes(task.id)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {notesOpen ? 'Hide notes' : 'Add / edit notes'}
                  </button>
                </div>

                <div className="text-sm text-gray-700">
                  <span className="md:hidden text-xs text-gray-500 block">Meeting</span>
                  {task.meeting_name ?? '—'}
                </div>

                <div className="text-sm text-gray-600">
                  <span className="md:hidden text-xs text-gray-500 block">Meeting date</span>
                  {formatDateTime(task.meeting_date)}
                </div>

                <div className="text-sm">
                  <span className="md:hidden text-xs text-gray-500 block">Due date</span>
                  <Input
                    type="date"
                    value={task.due_date ? task.due_date.slice(0, 10) : ''}
                    onChange={(e) => handleDueDateChange(task, e.target.value)}
                    className="h-8 text-sm"
                  />
                  {!task.due_date && (
                    <p className="text-xs text-gray-400 mt-1 md:hidden">{formatDueDate(task.due_date)}</p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" title="Send desktop notification" onClick={() => handleNotify(task)}>
                    <Bell className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Email via OS mail app" onClick={() => handleEmail(task)}>
                    <Mail className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Delete task" onClick={() => handleDelete(task.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>

              {notesOpen && (
                <div className="px-3 pb-3 border-t bg-gray-50 pt-3 space-y-2">
                  <Textarea
                    value={noteDrafts[task.id] ?? ''}
                    onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                    placeholder="Add notes for this task…"
                    rows={3}
                    className="text-sm"
                  />
                  <Button size="sm" variant="outline" onClick={() => handleSaveNotes(task)}>
                    Save notes
                  </Button>
                </div>
              )}
            </li>
          );
        })}
        {tasks.length === 0 && <p className="text-gray-500 text-sm">No tasks yet.</p>}
      </ul>
    </div>
  );
}

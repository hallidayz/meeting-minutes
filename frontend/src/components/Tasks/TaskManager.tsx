'use client';

import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GuardianTask } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function TaskManager() {
  const [tasks, setTasks] = useState<GuardianTask[]>([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<GuardianTask['priority']>('medium');

  const loadTasks = async () => {
    const data = await invoke<GuardianTask[]>('list_tasks');
    setTasks(data);
  };

  useEffect(() => {
    loadTasks().catch(console.error);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await invoke('create_task', {
      request: { title: title.trim(), priority, status: 'todo' },
    });
    setTitle('');
    await loadTasks();
    toast.success('Task created');
  };

  const handleStatusChange = async (task: GuardianTask, status: GuardianTask['status']) => {
    await invoke('update_task', { request: { id: task.id, status } });
    await loadTasks();
  };

  const handleDelete = async (id: string) => {
    await invoke('delete_task', { id });
    await loadTasks();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Tasks</h1>
        <p className="text-sm text-gray-600">Manage action items across meetings.</p>
      </div>

      <form onSubmit={handleCreate} className="flex flex-wrap gap-2 items-end">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New task..." className="max-w-md" />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as GuardianTask['priority'])}
          className="px-3 py-2 border rounded-md"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <Button type="submit" className="bg-brand-primary">Add Task</Button>
      </form>

      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-3 p-3 bg-white border rounded-lg">
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(task, e.target.value as GuardianTask['status'])}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="todo">To Do</option>
              <option value="inprogress">In Progress</option>
              <option value="done">Done</option>
            </select>
            <span className={`flex-1 ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>{task.title}</span>
            <span className="text-xs uppercase text-brand-accent font-semibold">{task.priority}</span>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(task.id)}>Delete</Button>
          </li>
        ))}
        {tasks.length === 0 && <p className="text-gray-500 text-sm">No tasks yet.</p>}
      </ul>
    </div>
  );
}

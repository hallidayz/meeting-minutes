'use client';

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Plus, Check, ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SummaryActionItemsProps {
  meetingId: string;
  actionItems: string[];
  onTaskAdded?: () => void;
}

export function SummaryActionItems({
  meetingId,
  actionItems,
  onTaskAdded,
}: SummaryActionItemsProps) {
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);

  if (actionItems.length === 0) return null;

  const handleAddTask = async (item: string) => {
    if (added.has(item)) return;
    setAdding(item);
    try {
      await invoke('create_task', {
        request: {
          title: item,
          meeting_id: meetingId,
          priority: 'medium',
          status: 'todo',
        },
      });
      setAdded((prev) => new Set(prev).add(item));
      toast.success('Added to task list');
      onTaskAdded?.();
    } catch (e) {
      toast.error('Failed to add task', { description: String(e) });
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="border-b border-gray-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <ListTodo className="w-4 h-4 text-gray-600" />
        <h4 className="text-sm font-semibold text-gray-800">Action Items</h4>
        <span className="text-xs text-gray-500">Click + to add to your task list</span>
      </div>
      <ul className="space-y-1.5">
        {actionItems.map((item, i) => {
          const isAdded = added.has(item);
          return (
            <li
              key={`${i}-${item.slice(0, 24)}`}
              className="flex items-start gap-2 text-sm text-gray-800 group"
            >
              <span className="flex-1 leading-snug pt-0.5">{item}</span>
              <Button
                type="button"
                size="icon"
                variant={isAdded ? 'ghost' : 'outline'}
                className={`h-7 w-7 shrink-0 ${
                  isAdded ? 'text-green-600' : 'opacity-80 group-hover:opacity-100'
                }`}
                disabled={isAdded || adding === item}
                onClick={() => handleAddTask(item)}
                title={isAdded ? 'Already in task list' : 'Add to task list'}
              >
                {isAdded ? (
                  <Check className="w-4 h-4" />
                ) : adding === item ? (
                  <span className="text-xs">…</span>
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

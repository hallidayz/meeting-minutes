'use client';

import React, { useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';

export function ImportAiNotes() {
  const [pin, setPin] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setImporting(true);
    try {
      const bundleJson = await file.text();
      const result = await invoke<{ meetings_imported: number; tasks_imported: number }>(
        'import_ai_notes_bundle',
        { request: { bundle_json: bundleJson, pin: pin || null } }
      );
      toast.success(`Imported ${result.meetings_imported} meetings and ${result.tasks_imported} tasks`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">Import from ai-notes</h3>
      <p className="text-sm text-gray-600">
        Import sessions and tasks from a legacy ai-notes export bundle (.json). Enter your ai-notes PIN if the export is encrypted.
      </p>
      <Input
        type="password"
        placeholder="ai-notes PIN (if encrypted)"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className="max-w-sm"
      />
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button onClick={() => fileRef.current?.click()} disabled={importing} className="bg-brand-primary">
        {importing ? 'Importing...' : 'Select Bundle & Import'}
      </Button>
    </div>
  );
}

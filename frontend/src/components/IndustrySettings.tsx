'use client';

import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { INDUSTRIES } from '@/config/branding';
import { toast } from 'sonner';

export function IndustrySettings() {
  const [industry, setIndustry] = useState<string>('General');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invoke<string>('get_industry_setting')
      .then(setIndustry)
      .catch(console.error);
  }, []);

  const handleSave = async (value: string) => {
    setSaving(true);
    try {
      await invoke('set_industry_setting', { industry: value });
      setIndustry(value);
      toast.success('Industry context updated');
    } catch (e) {
      toast.error('Failed to save industry setting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">Industry Context</h3>
      <p className="text-sm text-gray-600">
        Tailor summary structure and tone for your field. Summaries use this when generating meeting reports.
      </p>
      <select
        value={industry}
        disabled={saving}
        onChange={(e) => handleSave(e.target.value)}
        className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md bg-white"
      >
        {INDUSTRIES.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </div>
  );
}

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Plus, Trash2, Copy, Save, FileText, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  EMPTY_TEMPLATE,
  SummaryTemplate,
  TemplateFull,
  TemplateInfo,
  TemplateSection,
  buildTemplatePreview,
} from '@/lib/summaryTemplates';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'custom_template';
}

export function TemplateArtifactSettings() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SummaryTemplate>(EMPTY_TEMPLATE);
  const [draftId, setDraftId] = useState('');
  const [isEditable, setIsEditable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);

  const previewMarkdown = useMemo(() => buildTemplatePreview(draft), [draft]);

  const loadTemplates = useCallback(async () => {
    const list = await invoke<TemplateInfo[]>('api_list_templates');
    setTemplates(list);
    return list;
  }, []);

  const loadTemplate = useCallback(async (id: string) => {
    const full = await invoke<TemplateFull>('api_get_template', { templateId: id });
    setSelectedId(id);
    setDraftId(id);
    setDraft({
      name: full.name,
      description: full.description,
      sections: full.sections,
    });
    setIsEditable(full.is_editable);
    setIsNew(false);
  }, []);

  useEffect(() => {
    loadTemplates()
      .then((list) => {
        if (list.length > 0) {
          loadTemplate(list[0].id).catch(console.error);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [loadTemplates, loadTemplate]);

  const handleNew = () => {
    const id = `custom_${Date.now()}`;
    setSelectedId(null);
    setDraftId(id);
    setDraft({ ...EMPTY_TEMPLATE, name: 'My Meeting Notes' });
    setIsEditable(true);
    setIsNew(true);
  };

  const handleDuplicate = async () => {
    if (!selectedId) return;
    const newId = `${selectedId}_copy_${Date.now().toString(36).slice(-4)}`;
    try {
      const info = await invoke<TemplateInfo>('api_duplicate_template', {
        sourceId: selectedId,
        newId,
      });
      await loadTemplates();
      await loadTemplate(info.id);
      toast.success('Template duplicated — customize and save');
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleSave = async () => {
    const id = draftId.trim() || slugify(draft.name);
    setSaving(true);
    try {
      await invoke('api_validate_template', {
        templateJson: JSON.stringify(draft),
      });
      const info = await invoke<TemplateInfo>('api_save_template', {
        templateId: id,
        template: draft,
      });
      await loadTemplates();
      await loadTemplate(info.id);
      toast.success('Template saved');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId || !isEditable) return;
    if (!confirm(`Delete template "${draft.name}"?`)) return;
    try {
      await invoke('api_delete_template', { templateId: selectedId });
      toast.success('Template deleted');
      const list = await loadTemplates();
      if (list.length > 0) {
        await loadTemplate(list[0].id);
      } else {
        handleNew();
      }
    } catch (e) {
      toast.error(String(e));
    }
  };

  const updateSection = (index: number, patch: Partial<TemplateSection>) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  };

  const addSection = () => {
    setDraft((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        { title: 'New Section', instruction: 'What should the AI extract?', format: 'paragraph' },
      ],
    }));
  };

  const removeSection = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return <div className="p-8 text-gray-500">Loading templates…</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Summary Templates</h2>
        <p className="text-sm text-gray-600 mt-1">
          Design AI summary and meeting-note structures like Claude Artifacts — edit sections on the left, preview output on the right.
        </p>
      </div>

      <div className="flex gap-4 min-h-[520px] border border-gray-200 rounded-xl overflow-hidden bg-white">
        {/* Template list */}
        <aside className="w-56 border-r border-gray-200 bg-gray-50 flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <Button size="sm" className="w-full gap-1" onClick={handleNew}>
              <Plus className="w-4 h-4" /> New
            </Button>
          </div>
          <ul className="flex-1 overflow-y-auto p-2 space-y-1">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => loadTemplate(t.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedId === t.id && !isNew
                      ? 'bg-blue-100 text-blue-900 font-medium'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <span className="block truncate">{t.name}</span>
                  {t.is_custom && (
                    <span className="text-xs text-gray-500">Custom</span>
                  )}
                </button>
              </li>
            ))}
            {isNew && (
              <li className="px-3 py-2 text-sm text-blue-700 font-medium">+ Unsaved draft</li>
            )}
          </ul>
        </aside>

        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-gray-200 bg-gray-50">
            <FileText className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Editor</span>
            <div className="ml-auto flex gap-2">
              {selectedId && !isNew && (
                <Button size="sm" variant="outline" onClick={handleDuplicate}>
                  <Copy className="w-3 h-3 mr-1" /> Duplicate
                </Button>
              )}
              {isEditable && selectedId && !isNew && (
                <Button size="sm" variant="outline" onClick={handleDelete}>
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="w-3 h-3 mr-1" /> {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {(isNew || isEditable) && (
              <div>
                <Label className="text-xs text-gray-500">Template ID</Label>
                <Input
                  value={draftId}
                  onChange={(e) => setDraftId(e.target.value)}
                  disabled={!isNew && !!selectedId}
                  className="mt-1 font-mono text-sm"
                  placeholder="my_template_id"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                  disabled={!isEditable && !isNew}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={draft.description}
                  onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                  disabled={!isEditable && !isNew}
                  className="mt-1"
                />
              </div>
            </div>

            {!isEditable && !isNew && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
                Built-in templates are read-only. Use <strong>Duplicate</strong> to create an editable copy.
              </p>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Sections</Label>
                {(isEditable || isNew) && (
                  <Button type="button" size="sm" variant="outline" onClick={addSection}>
                    <Plus className="w-3 h-3 mr-1" /> Section
                  </Button>
                )}
              </div>

              {draft.sections.map((section, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/50">
                  <div className="flex gap-2 items-start">
                    <Input
                      value={section.title}
                      onChange={(e) => updateSection(index, { title: e.target.value })}
                      disabled={!isEditable && !isNew}
                      placeholder="Section title"
                      className="flex-1 font-medium"
                    />
                    <Select
                      value={section.format}
                      onValueChange={(v) =>
                        updateSection(index, { format: v as TemplateSection['format'] })
                      }
                      disabled={!isEditable && !isNew}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paragraph">Paragraph</SelectItem>
                        <SelectItem value="list">List</SelectItem>
                        <SelectItem value="string">String</SelectItem>
                      </SelectContent>
                    </Select>
                    {(isEditable || isNew) && draft.sections.length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeSection(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                  <Textarea
                    value={section.instruction}
                    onChange={(e) => updateSection(index, { instruction: e.target.value })}
                    disabled={!isEditable && !isNew}
                    placeholder="Instructions for the AI…"
                    rows={2}
                    className="text-sm"
                  />
                  {section.format === 'list' && (
                    <Input
                      value={section.item_format || ''}
                      onChange={(e) => updateSection(index, { item_format: e.target.value })}
                      disabled={!isEditable && !isNew}
                      placeholder="List item format hint (optional)"
                      className="text-xs font-mono"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live preview (Artifacts-style) */}
        <aside className="w-72 border-l border-gray-200 bg-slate-950 text-slate-100 flex flex-col">
          <div className="flex items-center gap-2 p-3 border-b border-slate-800">
            <Eye className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium">Live preview</span>
          </div>
          <pre className="flex-1 overflow-y-auto p-4 text-xs leading-relaxed whitespace-pre-wrap font-sans text-slate-200">
            {previewMarkdown}
          </pre>
        </aside>
      </div>
    </div>
  );
}

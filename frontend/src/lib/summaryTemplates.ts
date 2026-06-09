export interface TemplateSection {
  title: string;
  instruction: string;
  format: 'paragraph' | 'list' | 'string';
  item_format?: string;
  example_item_format?: string;
}

export interface SummaryTemplate {
  name: string;
  description: string;
  sections: TemplateSection[];
}

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  is_custom: boolean;
  is_editable: boolean;
}

export interface TemplateFull extends SummaryTemplate {
  id: string;
  is_editable: boolean;
  preview_markdown: string;
}

export const EMPTY_TEMPLATE: SummaryTemplate = {
  name: 'New Template',
  description: 'Custom summary structure',
  sections: [
    {
      title: 'Summary',
      instruction: 'Provide a brief executive summary of the meeting.',
      format: 'paragraph',
    },
    {
      title: 'Action Items',
      instruction: 'List actionable tasks with owners and due dates.',
      format: 'list',
      item_format: '- **[Owner]** Task — due date',
    },
  ],
};

/** Build a live preview markdown structure (Claude Artifacts-style). */
export function buildTemplatePreview(template: SummaryTemplate): string {
  let md = '# [AI-Generated Title]\n\n';
  for (const section of template.sections) {
    md += `**${section.title || 'Section'}**\n\n`;
    if (section.format === 'list') {
      const hint = section.item_format || '- Item';
      md += `${hint}\n`;
      if (section.title.toLowerCase().includes('action')) {
        md += `${hint.replace('Item', 'Follow up with client')}\n`;
      }
      md += '\n';
    } else if (section.format === 'paragraph') {
      md += '_Paragraph content generated here._\n\n';
    } else {
      md += '_Content_\n\n';
    }
  }
  return md.trim();
}

/** Extract action items from markdown summaries for task promotion. */
export function extractActionItemsFromMarkdown(markdown: string): string[] {
  if (!markdown?.trim()) return [];

  const lines = markdown.split('\n');
  let inSection = false;
  const items: string[] = [];
  const seen = new Set<string>();

  const isActionHeader = (line: string) =>
    /^#+\s*action\s*items/i.test(line) ||
    /^\*\*action\s*items\*\*/i.test(line) ||
    /^action\s*items\s*$/i.test(line.replace(/\*/g, '').trim());

  const isOtherSectionHeader = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || isActionHeader(trimmed)) return false;
    return (
      /^#+\s+\S/.test(trimmed) ||
      (/^\*\*[^*]+\*\*\s*$/.test(trimmed) && !/action/i.test(trimmed))
    );
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isActionHeader(trimmed)) {
      inSection = true;
      continue;
    }

    if (inSection && isOtherSectionHeader(trimmed)) {
      break;
    }

    if (!inSection) continue;

    if (/^\|?\s*[-:]+/.test(trimmed)) continue;

    const listMatch = trimmed.match(/^[-*]\s+(.+)/) || trimmed.match(/^\d+\.\s+(.+)/);
    if (listMatch) {
      const text = cleanActionItemText(listMatch[1]);
      if (text && !seen.has(text)) {
        seen.add(text);
        items.push(text);
      }
      continue;
    }

    const tableMatch = trimmed.match(/^\|(.+)\|$/);
    if (tableMatch) {
      const cells = trimmed
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length >= 2 && !cells[0].toLowerCase().includes('owner')) {
        const taskCell = cells.find((c, i) => i > 0 && c.length > 2) || cells[1];
        const text = cleanActionItemText(taskCell);
        if (text && !seen.has(text)) {
          seen.add(text);
          items.push(text);
        }
      }
    }
  }

  return items;
}

function cleanActionItemText(raw: string): string {
  return raw
    .replace(/\*\*/g, '')
    .replace(/^\[x\]\s*/i, '')
    .replace(/^[-*]\s+/, '')
    .trim();
}

/** Resolve action items from any summary shape. */
export function extractActionItemsFromSummary(summary: unknown): string[] {
  if (!summary || typeof summary !== 'object') return [];

  const data = summary as Record<string, unknown>;

  if (typeof data.markdown === 'string') {
    return extractActionItemsFromMarkdown(data.markdown);
  }

  const legacy = data.ActionItems as { blocks?: Array<{ content?: string }> } | undefined;
  if (legacy?.blocks) {
    return legacy.blocks.map((b) => b.content).filter(Boolean) as string[];
  }

  for (const key of Object.keys(data)) {
    if (/action/i.test(key)) {
      const section = data[key] as { blocks?: Array<{ content?: string }> } | undefined;
      if (section?.blocks) {
        return section.blocks.map((b) => b.content).filter(Boolean) as string[];
      }
    }
  }

  return [];
}

import type { TranscriptionErrorPayload } from '@/services/transcriptService';

let lastReportedError = '';
let lastReportedAt = 0;
const DEDUP_WINDOW_MS = 8000;

/** Suppress duplicate transcription-error events from multiple UI listeners. */
export function shouldReportTranscriptionError(errorKey: string): boolean {
  const now = Date.now();
  if (errorKey === lastReportedError && now - lastReportedAt < DEDUP_WINDOW_MS) {
    return false;
  }
  lastReportedError = errorKey;
  lastReportedAt = now;
  return true;
}

export function parseTranscriptionErrorPayload(
  payload: unknown
): TranscriptionErrorPayload | null {
  if (payload == null) return null;

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) return null;
    return {
      error: trimmed,
      userMessage: trimmed,
      actionable: false,
    };
  }

  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const error =
      typeof record.error === 'string' ? record.error : '';
    const userMessage =
      typeof record.userMessage === 'string'
        ? record.userMessage
        : typeof record.user_message === 'string'
          ? record.user_message
          : error;
    const actionable = record.actionable === true;

    if (!error && !userMessage) return null;

    return {
      error: error || userMessage,
      userMessage: userMessage || error,
      actionable,
    };
  }

  return null;
}

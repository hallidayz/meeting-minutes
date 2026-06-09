/**
 * useTranscriptRecovery Hook
 *
 * Orchestrates transcript recovery operations for interrupted meetings.
 * Provides functionality to detect, preview, and recover meetings from IndexedDB.
 */

import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { indexedDBService, MeetingMetadata, StoredTranscript } from '@/services/indexedDBService';
import { storageService } from '@/services/storageService';
import { Transcript } from '@/types';

interface DiskTranscriptSegment {
  id: string;
  text: string;
  audio_start_time: number;
  audio_end_time: number;
  duration: number;
  display_time: string;
  confidence: number;
  sequence_id: number;
  speaker?: string;
}

function formatTranscriptsForSave(
  transcripts: StoredTranscript[],
  source: 'indexeddb' | 'disk'
): Transcript[] {
  return transcripts.map((t, index) => ({
    id: t.id?.toString() || `${Date.now()}-${index}`,
    text: t.text,
    timestamp:
      source === 'disk'
        ? (t as StoredTranscript & { display_time?: string }).display_time || t.timestamp
        : t.timestamp,
    sequence_id: t.sequenceId ?? (t as { sequence_id?: number }).sequence_id ?? index,
    chunk_start_time: (t as { chunk_start_time?: number }).chunk_start_time,
    is_partial: (t as { is_partial?: boolean }).is_partial || false,
    confidence: t.confidence,
    audio_start_time: t.audio_start_time,
    audio_end_time: t.audio_end_time,
    duration: t.duration,
    speaker: (t as { speaker?: string }).speaker,
  }));
}

async function loadDiskTranscripts(folderPath: string): Promise<StoredTranscript[]> {
  const segments = await invoke<DiskTranscriptSegment[]>('load_transcripts_from_folder', {
    meetingFolder: folderPath,
  });

  return segments.map((segment) => ({
    text: segment.text,
    timestamp: segment.display_time,
    confidence: segment.confidence,
    sequenceId: segment.sequence_id,
    audio_start_time: segment.audio_start_time,
    audio_end_time: segment.audio_end_time,
    duration: segment.duration,
    speaker: segment.speaker,
    display_time: segment.display_time,
    meetingId: '',
    storedAt: Date.now(),
  }));
}

interface AudioRecoveryStatus {
  status: string; // "success" | "partial" | "failed" | "none"
  chunk_count: number;
  estimated_duration_seconds: number;
  audio_file_path?: string;
  message: string;
}

export interface UseTranscriptRecoveryReturn {
  recoverableMeetings: MeetingMetadata[];
  isLoading: boolean;
  isRecovering: boolean;
  checkForRecoverableTranscripts: () => Promise<void>;
  recoverMeeting: (meetingId: string) => Promise<{ success: boolean; audioRecoveryStatus?: AudioRecoveryStatus | null; meetingId?: string }>;
  loadMeetingTranscripts: (meetingId: string) => Promise<StoredTranscript[]>;
  deleteRecoverableMeeting: (meetingId: string) => Promise<void>;
}

export function useTranscriptRecovery(): UseTranscriptRecoveryReturn {
  const [recoverableMeetings, setRecoverableMeetings] = useState<MeetingMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  /**
   * Check for recoverable meetings in IndexedDB
   */
  const checkForRecoverableTranscripts = useCallback(async () => {
    setIsLoading(true);
    try {
      const meetings = await indexedDBService.getAllMeetings();

      // Filter out meetings older than 7 days and newer than 15 seconds
      // The 15 seconds threshold prevents showing meetings from the current session(jus in case)
      // where recording just stopped but hasn't been fully saved yet
      const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const secondsAgo = Date.now() - (15 * 1000);

      const recentMeetings = meetings.filter(m => {
        const isWithinRetention = m.lastUpdated > cutoffTime; // Not older than 7 days
        const isOldEnough = m.lastUpdated < secondsAgo; // Older than 15 seconds
        return isWithinRetention && isOldEnough;
      });

      // Verify recoverable content: IndexedDB transcripts, on-disk transcripts.json, or audio
      const meetingsWithStatus = await Promise.all(
        recentMeetings.map(async (meeting) => {
          let transcriptCount = await indexedDBService.getTranscriptCount(meeting.meetingId);
          let folderPath = meeting.folderPath;

          if (transcriptCount === 0 && folderPath) {
            try {
              const diskTranscripts = await loadDiskTranscripts(folderPath);
              transcriptCount = diskTranscripts.length;
            } catch (error) {
              console.warn('Failed to load on-disk transcripts for meeting:', error);
            }
          }

          if (folderPath) {
            try {
              const hasAudio = await invoke<boolean>('has_audio_checkpoints', {
                meetingFolder: folderPath,
              });
              if (!hasAudio) {
                folderPath = undefined;
              }
            } catch (error) {
              console.warn('Failed to check audio for meeting:', error);
              folderPath = undefined;
            }
          }

          return {
            ...meeting,
            folderPath,
            transcriptCount,
          };
        })
      );

      // Only show meetings that have transcripts or recoverable audio
      const recoverable = meetingsWithStatus.filter(
        (m) => m.transcriptCount > 0 || !!m.folderPath
      );

      setRecoverableMeetings(recoverable);
    } catch (error) {
      console.error('Failed to check for recoverable transcripts:', error);
      setRecoverableMeetings([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load transcripts for preview
   */
  const loadMeetingTranscripts = useCallback(async (meetingId: string): Promise<StoredTranscript[]> => {
    try {
      let transcripts = await indexedDBService.getTranscripts(meetingId);

      if (transcripts.length === 0) {
        const metadata = await indexedDBService.getMeetingMetadata(meetingId);
        if (metadata?.folderPath) {
          transcripts = await loadDiskTranscripts(metadata.folderPath);
        }
      }

      transcripts.sort((a, b) => (a.sequenceId || 0) - (b.sequenceId || 0));
      return transcripts;
    } catch (error) {
      console.error('Failed to load meeting transcripts:', error);
      return [];
    }
  }, []);

  /**
   * Recover a meeting from IndexedDB
   */
  const recoverMeeting = useCallback(async (meetingId: string): Promise<{ success: boolean; audioRecoveryStatus?: AudioRecoveryStatus | null; meetingId?: string }> => {
    setIsRecovering(true);
    try {
      // 1. Load meeting metadata
      const metadata = await indexedDBService.getMeetingMetadata(meetingId);
      if (!metadata) {
        throw new Error('Meeting metadata not found');
      }

      // 2. Load transcripts from IndexedDB, then fall back to on-disk transcripts.json
      let transcripts = await loadMeetingTranscripts(meetingId);
      let transcriptSource: 'indexeddb' | 'disk' = 'indexeddb';

      if (transcripts.length === 0 && metadata.folderPath) {
        transcripts = await loadDiskTranscripts(metadata.folderPath);
        transcriptSource = 'disk';
      }

      // 3. Check for folder path
      let folderPath = metadata.folderPath;


      if (!folderPath) {
        // Try to get from backend (might exist if only app crashed, not system)
        try {
          folderPath = await invoke<string>('get_meeting_folder_path');
        } catch (error) {
          folderPath = undefined;
        }
      }

      // 4. Attempt audio recovery if folder path exists
      let audioRecoveryStatus: AudioRecoveryStatus | null = null;
      if (folderPath) {
        try {
          audioRecoveryStatus = await invoke<AudioRecoveryStatus>(
            'recover_audio_from_checkpoints',
            { meetingFolder: folderPath, sampleRate: 48000 }
          );
        } catch (error) {
          console.error('Audio recovery failed:', error);
          audioRecoveryStatus = {
            status: 'failed',
            chunk_count: 0,
            estimated_duration_seconds: 0,
            message: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      } else {
        audioRecoveryStatus = {
          status: 'none',
          chunk_count: 0,
          estimated_duration_seconds: 0,
          message: 'No folder path available'
        };
      }

      if (transcripts.length === 0) {
        const hasRecoverableAudio =
          audioRecoveryStatus?.status === 'success' ||
          audioRecoveryStatus?.status === 'partial' ||
          (folderPath &&
            (await invoke<boolean>('has_audio_checkpoints', { meetingFolder: folderPath }).catch(
              () => false
            )));

        if (!hasRecoverableAudio) {
          throw new Error(
            'No transcripts found for this meeting. The recording may have been too short or transcription did not run.'
          );
        }
      }

      // 5. Convert transcripts to the format expected by storageService
      const formattedTranscripts = formatTranscriptsForSave(transcripts, transcriptSource);

      // 6. Save to backend database using existing save utilities
      const saveResponse = await storageService.saveMeeting(
        metadata.title,
        formattedTranscripts,
        folderPath ?? null
      );

      const savedMeetingId = saveResponse.meeting_id;

      // 7. Mark as saved in IndexedDB
      await indexedDBService.markMeetingSaved(meetingId);


      // 8. Clean up checkpoint files
      if (folderPath) {
        try {
          await invoke('cleanup_checkpoints', { meetingFolder: folderPath });
        } catch (error) {
          // Non-fatal - don't fail recovery if cleanup fails
          console.warn('Checkpoint cleanup failed (non-fatal):', error);
        }
      }

      // 9. Remove from recoverable list
      setRecoverableMeetings(prev => prev.filter(m => m.meetingId !== meetingId));

      return {
        success: true,
        audioRecoveryStatus,
        meetingId: savedMeetingId
      };
    } catch (error) {
      console.error('Failed to recover meeting:', error);
      throw error;
    } finally {
      setIsRecovering(false);
    }
  }, [loadMeetingTranscripts]);

  /**
   * Delete a recoverable meeting
   */
  const deleteRecoverableMeeting = useCallback(async (meetingId: string): Promise<void> => {
    try {
      await indexedDBService.deleteMeeting(meetingId);
      setRecoverableMeetings(prev => prev.filter(m => m.meetingId !== meetingId));
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      throw error;
    }
  }, []);

  return {
    recoverableMeetings,
    isLoading,
    isRecovering,
    checkForRecoverableTranscripts,
    recoverMeeting,
    loadMeetingTranscripts,
    deleteRecoverableMeeting
  };
}

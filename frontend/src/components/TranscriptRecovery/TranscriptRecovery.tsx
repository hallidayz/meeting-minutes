/**
 * TranscriptRecovery Component
 *
 * Modal dialog for recovering interrupted meetings from IndexedDB.
 */

import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, CheckCircle2, Clock, FileText, Trash2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MeetingMetadata, StoredTranscript } from '@/services/indexedDBService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TranscriptRecoveryProps {
  isOpen: boolean;
  onClose: () => void;
  recoverableMeetings: MeetingMetadata[];
  onRecover: (meetingId: string) => Promise<any>;
  onDelete: (meetingId: string) => Promise<void>;
  onLoadPreview: (meetingId: string) => Promise<StoredTranscript[]>;
}

export function TranscriptRecovery({
  isOpen,
  onClose,
  recoverableMeetings,
  onRecover,
  onDelete,
  onLoadPreview,
}: TranscriptRecoveryProps) {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [previewTranscripts, setPreviewTranscripts] = useState<StoredTranscript[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedMeetingId(null);
      setPreviewTranscripts([]);
      setConfirmDelete(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && recoverableMeetings.length > 0 && !selectedMeetingId) {
      handleMeetingSelect(recoverableMeetings[0].meetingId);
    }
  }, [isOpen, recoverableMeetings]);

  const handleMeetingSelect = async (meetingId: string) => {
    setSelectedMeetingId(meetingId);
    setIsLoadingPreview(true);

    try {
      const transcripts = await onLoadPreview(meetingId);
      setPreviewTranscripts(transcripts.slice(0, 10));
    } catch (error) {
      console.error('Failed to load preview:', error);
      setPreviewTranscripts([]);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleRecover = async () => {
    if (!selectedMeetingId) return;

    setIsRecovering(true);
    try {
      await onRecover(selectedMeetingId);
      onClose();
    } catch (error) {
      console.error('Recovery failed:', error);
      toast.error('Failed to recover meeting', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsRecovering(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMeetingId) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(selectedMeetingId);
      setSelectedMeetingId(null);
      setPreviewTranscripts([]);
      setConfirmDelete(false);
      toast.success('Interrupted meeting deleted');
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete meeting', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedMeeting = recoverableMeetings.find((m) => m.meetingId === selectedMeetingId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        hideAssistantTrigger
        className="max-w-3xl w-[calc(100vw-2rem)] bottom-[max(1rem,4dvh)] max-h-none h-auto p-0 gap-0"
      >
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3 border-b border-border/60">
          <DialogTitle className="text-lg font-semibold pr-8">
            Recover Interrupted Meetings
          </DialogTitle>
          <DialogDescription>
            We found {recoverableMeetings.length} interrupted meeting
            {recoverableMeetings.length !== 1 ? 's' : ''}. Select one to preview, then recover or
            delete.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body — keeps footer always visible below */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Interrupted Meetings</h3>
            <div className="space-y-2">
              {recoverableMeetings.map((meeting) => (
                <button
                  key={meeting.meetingId}
                  type="button"
                  onClick={() => handleMeetingSelect(meeting.meetingId)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-colors',
                    selectedMeetingId === meeting.meetingId
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-muted border-border/60'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{meeting.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(meeting.lastUpdated), { addSuffix: true })}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <FileText className="w-3 h-3" />
                        {meeting.transcriptCount} transcript
                        {meeting.transcriptCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {meeting.folderPath ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" aria-label="Audio available" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" aria-label="No audio" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedMeeting && (
            <div>
              <h3 className="text-sm font-medium mb-2">Preview</h3>
              <div className="border rounded-lg overflow-hidden">
                <div className="p-3 border-b bg-muted/50 text-sm">
                  <p className="font-semibold">{selectedMeeting.title}</p>
                  <p className="text-muted-foreground mt-1">
                    Started {new Date(selectedMeeting.startTime).toLocaleString()}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <span className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {selectedMeeting.transcriptCount} transcripts
                    </span>
                    {selectedMeeting.folderPath ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        Audio available
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-yellow-600">
                        <AlertCircle className="w-4 h-4" />
                        No audio
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 max-h-48 overflow-y-auto">
                  {isLoadingPreview ? (
                    <p className="text-sm text-muted-foreground">Loading preview…</p>
                  ) : previewTranscripts.length > 0 ? (
                    <div className="space-y-2">
                      <Alert className="py-2">
                        <AlertDescription className="text-xs">
                          Showing first {previewTranscripts.length} of{' '}
                          {selectedMeeting.transcriptCount} segments
                        </AlertDescription>
                      </Alert>
                      {previewTranscripts.map((transcript, index) => (
                        <p key={index} className="text-sm">
                          <span className="text-muted-foreground">
                            [{transcript.audio_start_time !== undefined
                              ? `${Math.floor(transcript.audio_start_time / 60)}:${String(Math.floor(transcript.audio_start_time % 60)).padStart(2, '0')}`
                              : '--:--'}]
                          </span>{' '}
                          {transcript.text}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No transcripts to preview</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 px-5 py-4 border-t border-border/60 bg-background gap-2 sm:gap-2">
          {confirmDelete && (
            <p className="text-sm text-destructive w-full text-left mb-1">
              This permanently deletes the interrupted meeting. Click Confirm delete to proceed.
            </p>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setConfirmDelete(false);
              onClose();
            }}
            disabled={isRecovering || isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!selectedMeetingId || isRecovering || isDeleting}
          >
            {isDeleting ? (
              <>
                <XCircle className="w-4 h-4 mr-2 animate-spin" />
                Deleting…
              </>
            ) : confirmDelete ? (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Confirm delete
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </>
            )}
          </Button>
          <Button
            onClick={handleRecover}
            disabled={
              !selectedMeetingId ||
              isRecovering ||
              isDeleting ||
              (!selectedMeeting?.folderPath && (selectedMeeting?.transcriptCount ?? 0) === 0)
            }
            className="bg-brand-primary hover:opacity-90 text-white"
          >
            {isRecovering ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2 animate-spin" />
                Recovering…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Recover
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

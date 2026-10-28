"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getLiveKitToken,
  updateVoiceConsent,
  dispatchAiModerator,
  type LiveKitTokenResponse,
} from "./livekit-voice-actions";

export interface VoiceModeratorControlsProps {
  roomId: string;
  initialVoiceConsent?: boolean;
  initialFacilitatorActive?: boolean;
  isPresenterOrHost?: boolean;
  onConsentChange?: (hasConsent: boolean) => void;
  onMuteToggle?: (isMuted: boolean) => void;
}

export function VoiceModeratorControls({
  roomId,
  initialVoiceConsent = false,
  initialFacilitatorActive = false,
  isPresenterOrHost = false,
  onConsentChange,
  onMuteToggle,
}: VoiceModeratorControlsProps) {
  const [hasVoiceConsent, setHasVoiceConsent] = useState(initialVoiceConsent);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [facilitatorActive, setFacilitatorActive] = useState(
    initialFacilitatorActive,
  );
  const [tokenData, setTokenData] = useState<LiveKitTokenResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleToggleConsent = async () => {
    setLoading(true);
    const nextConsent = !hasVoiceConsent;
    try {
      const res = await updateVoiceConsent(roomId, nextConsent);
      if (res.data) {
        setHasVoiceConsent(res.data.hasVoiceConsent);
        onConsentChange?.(res.data.hasVoiceConsent);
        if (!res.data.hasVoiceConsent && isConnected) {
          // Consent revoked: immediately cease publishing audio
          setIsMuted(true);
          setStatusMessage("Voice consent withdrawn. Microphone disabled.");
        } else {
          setStatusMessage("Voice consent updated.");
        }
      } else if (res.error) {
        setStatusMessage(res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAudio = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await getLiveKitToken(roomId);
      if (res.data) {
        setTokenData(res.data);
        setIsConnected(true);
        // If server granted publish, default to unmuted; otherwise muted
        setIsMuted(!res.data.canPublishAudio);
        setStatusMessage(
          res.data.canPublishAudio
            ? "Connected to voice room. Microphone active."
            : "Connected in listen-only mode (consent required to speak).",
        );
      } else if (res.error) {
        setStatusMessage(res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectAudio = () => {
    setIsConnected(false);
    setTokenData(null);
    setIsMuted(true);
    setStatusMessage("Disconnected from voice room.");
  };

  const handleToggleMute = () => {
    if (!tokenData?.canPublishAudio) {
      setStatusMessage("Cannot unmute: microphone voice consent is required.");
      return;
    }
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    onMuteToggle?.(nextMute);
    setStatusMessage(nextMute ? "Microphone muted." : "Microphone active.");
  };

  const handleDispatchModerator = async () => {
    setLoading(true);
    try {
      const res = await dispatchAiModerator(roomId);
      if (res.data?.dispatched) {
        setFacilitatorActive(true);
        setStatusMessage("AI Voice Moderator dispatched (Peer-First mode).");
      } else if (res.error) {
        setStatusMessage(res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-label="LiveKit Voice & AI Moderator"
      className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <h3 className="text-base font-semibold">Live Voice Discussion</h3>
          <p className="text-xs text-muted-foreground">
            Zero audio retention: raw PCM frames are processed in streaming
            memory only. No audio is ever written to disk.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge variant="outline" className="border-emerald-600 text-emerald-600">
              Voice Connected
            </Badge>
          ) : (
            <Badge variant="secondary">Voice Inactive</Badge>
          )}

          {facilitatorActive ? (
            <Badge variant="outline" className="border-indigo-600 text-indigo-600">
              AI Facilitator: Active
            </Badge>
          ) : (
            <Badge variant="secondary">AI Facilitator: Idle</Badge>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {/* Consent row */}
        <div className="flex items-center justify-between rounded-md bg-muted/40 p-2.5">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Microphone Voice Consent</span>
            <span className="text-xs text-muted-foreground">
              Explicit consent is required to publish audio tracks to the room.
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant={hasVoiceConsent ? "outline" : "default"}
            onClick={handleToggleConsent}
            disabled={loading}
            aria-pressed={hasVoiceConsent}
          >
            {hasVoiceConsent ? "Revoke Consent" : "Grant Consent"}
          </Button>
        </div>

        {/* Media Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {!isConnected ? (
            <Button
              type="button"
              size="sm"
              onClick={handleConnectAudio}
              disabled={loading}
            >
              Join Voice Room
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant={isMuted ? "secondary" : "default"}
                onClick={handleToggleMute}
                disabled={loading || !tokenData?.canPublishAudio}
                aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
              >
                {isMuted ? "Unmute Mic" : "Mute Mic"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleDisconnectAudio}
                disabled={loading}
              >
                Leave Voice
              </Button>
            </>
          )}

          {/* AI Moderator dispatch (presenter/host only) */}
          {!facilitatorActive && isPresenterOrHost && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDispatchModerator}
              disabled={loading}
            >
              Dispatch AI Moderator
            </Button>
          )}
        </div>

        {/* Status announcement */}
        {statusMessage && (
          <p
            role="status"
            className="text-xs font-medium text-muted-foreground mt-1"
          >
            {statusMessage}
          </p>
        )}
      </div>
    </section>
  );
}

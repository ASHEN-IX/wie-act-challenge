"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  dispatchAiModerator,
  getLiveKitToken,
  updateVoiceConsent,
} from "./livekit-voice-actions";
import type { Room } from "livekit-client";

export function VoiceModeratorControls({
  roomId,
  isPresenterOrHost,
}: {
  roomId: string;
  isPresenterOrHost?: boolean;
}) {
  const room = useRef<Room | null>(null);
  const audio = useRef<HTMLDivElement>(null);
  const attempt = useRef(0);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState("disconnected");
  const [busy, setBusy] = useState(false);
  const [mic, setMic] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [moderatorOnline, setModeratorOnline] = useState(false);

  useEffect(() => () => {
    attempt.current++;
    const current = room.current;
    room.current = null;
    void current?.disconnect();
  }, []);

  async function join() {
    const id = ++attempt.current;
    setBusy(true);
    setMessage("");
    try {
      const { Room, RoomEvent, Track } = await import("livekit-client");
      if (id !== attempt.current) return;
      const saved = await updateVoiceConsent(roomId, consent);
      if (id !== attempt.current) return;
      if (!saved.data) throw new Error(saved.error ?? "Could not save voice consent.");
      const grant = await getLiveKitToken(roomId);
      if (id !== attempt.current) return;
      if (!grant.data) throw new Error(grant.error ?? "Voice is unavailable.");
      const current = new Room();
      room.current = current;
      current.on(RoomEvent.ConnectionStateChanged, (next) => {
        if (room.current === current) setState(next);
      });
      current.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (room.current === current && track.kind === Track.Kind.Audio) {
          audio.current?.append(track.attach());
          if (participant.isAgent && publication.trackName === "Study moderator") setModeratorOnline(true);
        }
      });
      current.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        track.detach().forEach((element) => element.remove());
        if (room.current === current && participant.isAgent && publication.trackName === "Study moderator") setModeratorOnline(false);
      });
      current.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (room.current === current) setPlaybackBlocked(!current.canPlaybackAudio);
      });
      current.on(RoomEvent.Disconnected, () => {
        if (room.current !== current) return;
        room.current = null;
        audio.current?.replaceChildren();
        setState("disconnected");
        setMic(false);
        setPlaybackBlocked(false);
        setModeratorOnline(false);
      });
      setState("connecting");
      await current.connect(grant.data.livekitUrl, grant.data.token);
      if (id !== attempt.current) await current.disconnect();
    } catch (error) {
      if (id === attempt.current) {
        await room.current?.disconnect();
        setState("disconnected");
        setMessage(error instanceof Error ? error.message : "Could not join voice.");
      }
    } finally {
      if (id === attempt.current) setBusy(false);
    }
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Voice action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Voice discussion" className="space-y-3 rounded-lg border bg-card p-4">
      <h3 className="font-semibold">Voice discussion</h3>
      <p className="text-sm text-muted-foreground" role="status">
        {message || (state === "connected" ? (mic ? "Microphone on" : "Microphone muted") : state === "reconnecting" ? "Reconnecting voice…" : state === "connecting" ? "Connecting voice…" : "Join to listen. Your microphone starts muted.")}
      </p>
      {moderatorOnline && <p className="text-sm">Voice moderator joined</p>}
      <div ref={audio} />
      {state === "disconnected" ? (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} />
            Allow microphone use and transcription when a voice moderator joins
          </label>
          <Button size="sm" disabled={busy} onClick={() => void join()}>Join voice</Button>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          {consent && (
            <Button size="sm" disabled={busy || state !== "connected"} onClick={() => void run(async () => {
              const current = room.current;
              if (!current) return;
              await current.localParticipant.setMicrophoneEnabled(!mic);
              if (room.current === current) setMic(!mic);
            })}>{mic ? "Mute microphone" : "Turn on microphone"}</Button>
          )}
          {playbackBlocked && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => {
              await room.current?.startAudio();
            })}>Enable audio playback</Button>
          )}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => {
            await room.current?.disconnect();
            setConsent(false);
            if (consent) {
              const result = await updateVoiceConsent(roomId, false);
              if (!result.data) throw new Error(result.error ?? "Could not clear microphone consent.");
            }
          })}>Leave voice</Button>
          {isPresenterOrHost && state === "connected" && !moderatorOnline && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => {
              const result = await dispatchAiModerator(roomId);
              if (!result.data) throw new Error(result.error ?? "Could not request the moderator.");
              setMessage("Moderator requested. It can speak once its worker joins.");
            })}>Request voice moderator</Button>
          )}
        </div>
      )}
    </section>
  );
}

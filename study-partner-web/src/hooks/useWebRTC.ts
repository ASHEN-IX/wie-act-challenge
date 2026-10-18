import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPeerConnection,
  defaultIceServers,
} from "@/services/webrtcService";

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window === "undefined" ? "" : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`);

export default function useWebRTC({ sessionId, userId, localStream, enabled }: any) {
  const wsRef = useRef<any>(null);
  const peersRef = useRef(new Map());
  const remoteAudioRef = useRef(new Map());

  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);

  const addParticipant = useCallback((participantId: any) => {
    setParticipants((prev: any) =>
      prev.includes(participantId) ? prev : [...prev, participantId],
    );
  }, []);

  const removeParticipant = useCallback((participantId: any) => {
    setParticipants((prev: any) => prev.filter((id: any) => id !== participantId));
    const peer = peersRef.current.get(participantId);
    if (peer) {
      peer.close();
      peersRef.current.delete(participantId);
    }

    const audio = remoteAudioRef.current.get(participantId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      remoteAudioRef.current.delete(participantId);
    }
  }, []);

  const sendSignal = useCallback((signalType: any, signal: any, targetUserId = null) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        type: "voice_signal",
        signalType,
        signal,
        targetUserId,
      }),
    );
  }, []);

  const createOrGetPeer = useCallback(
    (peerUserId: any) => {
      if (peersRef.current.has(peerUserId)) {
        const existing = peersRef.current.get(peerUserId);
        // If localStream became available after peer creation, ensure tracks are added
        if (localStream && existing.getSenders) {
          const senders = existing.getSenders();
          localStream.getTracks().forEach((track: any) => {
            const already = senders.some(
              (s: any) => s.track && s.track.kind === track.kind,
            );
            if (!already) {
              try {
                existing.addTrack(track, localStream);
              } catch (e) {
                // ignore addTrack errors
              }
            }
          });
        }
        return existing;
      }

      const peer = createPeerConnection({
        iceServers: defaultIceServers,
        onIceCandidate: (candidate) => {
          sendSignal("ice-candidate", candidate, peerUserId);
        },
        onTrack: (stream) => {
          let audio = remoteAudioRef.current.get(peerUserId);
          if (!audio) {
            audio = new Audio();
            audio.autoplay = true;
            remoteAudioRef.current.set(peerUserId, audio);
          }
          audio.srcObject = stream;
        },
      });

      // When negotiation is needed (e.g., tracks added), create and send an offer
      peer.onnegotiationneeded = async () => {
        try {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          sendSignal("offer", offer, peerUserId);
        } catch (e) {
          // ignore negotiation errors for now
        }
      };

      if (localStream) {
        try {
          localStream
            .getTracks()
            .forEach((track: any) => peer.addTrack(track, localStream));
        } catch (e) {
          // ignore addTrack errors
        }
      }

      peersRef.current.set(peerUserId, peer);
      return peer;
    },
    [localStream, sendSignal],
  );

  const createOfferTo = useCallback(
    async (peerUserId: any) => {
      if (peerUserId === userId) return;
      const peer = createOrGetPeer(peerUserId);
      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        sendSignal("offer", offer, peerUserId);
      } catch (e) {
        // ignore offer creation errors; negotiation will occur when tracks are added
      }
    },
    [createOrGetPeer, localStream, sendSignal, userId],
  );

  // When localStream becomes available or changes, ensure tracks are attached to existing peers
  useEffect(() => {
    if (!localStream) return;
    const peers = peersRef.current;
    peers.forEach(async (peer: any, peerUserId: any) => {
      try {
        const senders = peer.getSenders();
        localStream.getTracks().forEach((track: any) => {
          const already = senders.some(
            (s: any) => s.track && s.track.kind === track.kind,
          );
          if (!already) {
            try {
              peer.addTrack(track, localStream);
            } catch (e) {
              // ignore
            }
          }
        });

        // Trigger negotiation after adding tracks
        try {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          sendSignal("offer", offer, peerUserId);
        } catch (e) {
          // ignore negotiation errors
        }
      } catch (e) {
        // ignore per-peer errors
      }
    });
  }, [localStream, sendSignal]);

  useEffect(() => {
    // Establish signaling channel even if localStream is not yet available so peers can
    // be discovered and we can negotiate later when media becomes available.
    if (!enabled || !sessionId || !userId) return undefined;

    const ws = new WebSocket(
      `${WS_BASE}/ws/realtime?sessionId=${sessionId}&userId=${userId}`,
    );
    const peers = peersRef.current;
    const remoteAudios = remoteAudioRef.current;
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };

    ws.onmessage = async (event: any) => {
      let payload = null;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      if (payload.type === "participant_joined") {
        const peerUserId = payload.userId;
        if (peerUserId === userId) return;
        addParticipant(peerUserId);
        await createOfferTo(peerUserId);
        return;
      }

      if (payload.type === "participant_left") {
        removeParticipant(payload.userId);
        return;
      }

      if (payload.type !== "voice_signal") return;

      if (payload.targetUserId && payload.targetUserId !== userId) return;
      if (payload.fromUserId === userId) return;

      const peerUserId = payload.fromUserId;
      addParticipant(peerUserId);
      const peer = createOrGetPeer(peerUserId);

      if (payload.signalType === "offer") {
        await peer.setRemoteDescription(
          new RTCSessionDescription(payload.signal),
        );
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        sendSignal("answer", answer, peerUserId);
        return;
      }

      if (payload.signalType === "answer") {
        await peer.setRemoteDescription(
          new RTCSessionDescription(payload.signal),
        );
        return;
      }

      if (payload.signalType === "ice-candidate" && payload.signal) {
        await peer.addIceCandidate(new RTCIceCandidate(payload.signal));
      }
    };

    return () => {
      ws.close();
      peers.forEach((peer) => peer.close());
      peers.clear();
      remoteAudios.forEach((audio) => {
        audio.pause();
        audio.srcObject = null;
      });
      remoteAudios.clear();
      setParticipants([]);
    };
  }, [
    enabled,
    sessionId,
    userId,
    localStream,
    addParticipant,
    removeParticipant,
    createOrGetPeer,
    createOfferTo,
    sendSignal,
  ]);

  const sendMute = useCallback((isMuted: any) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "voice_mute", isMuted }));
  }, []);

  const sendSpeaking = useCallback((speakingStatus: any) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "voice_speaking", speakingStatus }));
  }, []);

  return {
    connected,
    participants,
    sendMute,
    sendSpeaking,
  };
}

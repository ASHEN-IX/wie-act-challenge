export function createPeerConnection({ iceServers, onIceCandidate, onTrack }: { iceServers?: any[]; onIceCandidate?: (candidate: any) => void; onTrack?: (stream: any) => void; }) {
  const peer = new RTCPeerConnection({ iceServers });

  peer.onicecandidate = (event: any) => {
    if (event.candidate && onIceCandidate) {
      onIceCandidate(event.candidate);
    }
  };

  peer.ontrack = (event: any) => {
    if (onTrack) onTrack(event.streams[0]);
  };

  return peer;
}

export const defaultIceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

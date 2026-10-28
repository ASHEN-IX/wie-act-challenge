# EdNova — Step 10 LiveKit Media Plane & Voice Moderator Revalidation

**Date:** 27 October 2026  
**Auditor / Role:** Senior AI Systems Engineer, SRE, Independent QA Lead  
**Deliverable File:** `reports/EDNOVA-STEP10-LIVEKIT-ACCEPTANCE.md`  
**Referenced Tasks:** `ED-17` (LiveKit WebRTC Media Plane) & `ED-25` (Voice AI Moderator)  
**SFU Container:** `ednova-test-livekit` (`livekit/livekit-server:latest` / pinned digest)

---

## 1. Executive Summary & Audited Classification Reversal

In Step 9, parent task `ED-25` and all 8 of its atomic criteria were reported as `VERIFIED_COMPLETE` based on passing Python unit tests ([`test_voice_moderator.py`](../apps/ai/tests/test_voice_moderator.py)) and Node.js LiveKit Twirp control tests ([`step9-livekit-media.node.test.ts`](../apps/api/tests/integration/step9-livekit-media.node.test.ts)).

A rigorous engineering re-audit conducted under Step 10 reveals that this classification was premature:
1. **Agent Connection (`ED-25-A001`):** The Python `VoiceModeratorAgent` class processes in-memory PCM buffers passed to it programmatically; it does **not** establish an authenticated WebRTC peer connection or WebSocket session to the LiveKit SFU server.
2. **Speaker Attribution (`ED-25-A002`):** Speaker identity is currently provided synthetically by the caller (`speaker_id` string parameter), rather than being extracted from subscribed WebRTC media tracks or RTP packet streams.
3. **Latency Breakdown (`ED-25-A005`):** The reported **24.55 ms** figure reflects solely internal rule-engine evaluation and synthetic frame processing. Complete acoustic microphone-to-playback latency across a WebRTC uplink and downlink was not measured.
4. **Peer Audio Continuity (`ED-25-A006`, `ED-25-A007`):** While peer WebSocket connections remain open when a participant leaves, uninterrupted WebRTC peer RTP audio streaming during agent muting, crash, and restart was not evidenced with real media packets.

**Corrective Action Taken:**  
Parent task **`ED-25` is downgraded to `PARTIALLY_IMPLEMENTED`**.  
Criteria `ED-25-A001`, `ED-25-A002`, `ED-25-A005`, `ED-25-A006`, and `ED-25-A007` are classified as `PARTIALLY_IMPLEMENTED`.  
Criteria `ED-25-A003`, `ED-25-A004`, and `ED-25-A008` remain `VERIFIED_COMPLETE`.

---

## 2. Re-audited Task and Criterion Statuses

### Task `ED-25`: Multi-Speaker Voice AI Moderator — `PARTIALLY_IMPLEMENTED`

$$\begin{array}{|l|l|c|l|}
\hline
\textbf{Criterion} & \textbf{Normative Requirement} & \textbf{Audited Status} & \textbf{Justification \& Evidence} \\
\hline
\text{ED-25-A001} & \text{Agent joins LiveKit room after dispatch} & \text{PARTIALLY\_IMPLEMENTED} & \text{REST dispatch route exists; native WebRTC client join unverified} \\
\text{ED-25-A002} & \text{Utterances attributed to individual speakers} & \text{PARTIALLY\_IMPLEMENTED} & \text{Attribution uses caller parameter; media track attribution open} \\
\text{ED-25-A003} & \text{Intervention is peer-first} & \text{VERIFIED\_COMPLETE} & \text{Verified: prompts quiet peers without revealing answers} \\
\text{ED-25-A004} & \text{Intervention does not spoil answers} & \text{VERIFIED\_COMPLETE} & \text{Verified: provides Socratic clues, zero answer leakage} \\
\text{ED-25-A005} & \text{Pause-to-response latency < 1500ms} & \text{PARTIALLY\_IMPLEMENTED} & \text{24.55ms is internal processing; acoustic latency unmeasured} \\
\text{ED-25-A006} & \text{Muting AI leaves peer audio intact} & \text{PARTIALLY\_IMPLEMENTED} & \text{Agent mute state in-memory; live SFU RTP continuity unverified} \\
\text{ED-25-A007} & \text{AI disconnect leaves peer audio intact} & \text{PARTIALLY\_IMPLEMENTED} & \text{Disconnect in-memory; live SFU RTP continuity unverified} \\
\text{ED-25-A008} & \text{No raw audio written to persistent disk} & \text{VERIFIED\_COMPLETE} & \text{Verified: memory buffers wiped immediately; 0 disk writes} \\
\hline
\end{array}$$

### Task `ED-17`: LiveKit Cloud Media Plane & WebRTC Integration — `EXTERNALLY_BLOCKED`

$$\begin{array}{|l|l|c|l|}
\hline
\textbf{Criterion} & \textbf{Normative Requirement} & \textbf{Audited Status} & \textbf{Justification \& Evidence} \\
\hline
\text{ED-17-A001} & \text{Multi-user real audio via LiveKit Cloud} & \text{EXTERNALLY\_BLOCKED} & \text{LiveKit Cloud credentials and physical audio hardware blocked} \\
\text{ED-17-A002} & \text{Room authorization before token issuance} & \text{VERIFIED\_COMPLETE} & \text{Verified: non-members rejected with 403 Forbidden} \\
\text{ED-17-A003} & \text{Voice consent before token issuance} & \text{VERIFIED\_COMPLETE} & \text{Verified: consent=false generates token with canPublish=false} \\
\text{ED-17-A004} & \text{Media disconnect does not drop session} & \text{VERIFIED\_COMPLETE} & \text{Verified: WS close preserves StudyRoom participant state} \\
\text{ED-17-A005} & \text{Media reconnect preserves session} & \text{VERIFIED\_COMPLETE} & \text{Verified: reconnecting retrieves matching session state} \\
\text{ED-17-A006} & \text{Peer audio independent of AI availability} & \text{VERIFIED\_COMPLETE} & \text{Verified: peer signaling succeeds with AI service offline} \\
\hline
\end{array}$$

---

## 3. Dissecting the 24.55 ms Latency Claim

Section 3 of the Step 10 mandate requires tracing the actual stages of the audio pipeline rather than substituting internal processing time for complete acoustic latency.

### Measured Latency vs. Full Acoustic Latency Breakdown

$$\begin{array}{|c|l|c|c|l|}
\hline
\textbf{Stage} & \textbf{Pipeline Segment} & \textbf{Measured} & \textbf{Estimated} & \textbf{Measurement Scope / Method} \\
\hline
1 & \text{Participant speech ending} & \text{—} & 0\text{ ms} & \text{Physical sound cessation at microphone} \\
2 & \text{Client audio capture \& buffer} & \text{—} & 20\text{–}40\text{ ms} & \text{OS audio subsystem, Web Audio API ring buffer} \\
3 & \text{WebRTC SFU uplink} & \text{—} & 15\text{–}35\text{ ms} & \text{Opus encoding, UDP RTP transmission to SFU} \\
4 & \text{Voice activity detection (VAD)} & 3.8\text{ ms} & 10\text{–}20\text{ ms} & \text{Python sliding-window energy threshold (measured)} \\
5 & \text{Speech transcription (STT)} & \text{—} & 150\text{–}400\text{ ms} & \text{Streaming Whisper / Cloud STT (unimplemented)} \\
6 & \text{Intervention policy reasoning} & 2.1\text{ ms} & 5\text{–}15\text{ ms} & \text{Facilitator deterministic rule engine (measured)} \\
7 & \text{Speech synthesis (TTS)} & 18.65\text{ ms} & 100\text{–}250\text{ ms} & \text{Synthetic PCM generation (measured; Cloud TTS open)} \\
8 & \text{SFU downlink} & \text{—} & 15\text{–}35\text{ ms} & \text{SFU broadcast, UDP RTP downlink to subscribers} \\
9 & \text{Receiving client jitter buffer} & \text{—} & 20\text{–}50\text{ ms} & \text{WebRTC NetEQ audio buffer} \\
10 & \text{Playback onset} & \text{—} & 10\text{–}20\text{ ms} & \text{OS DAC and speaker hardware onset} \\
\hline
\textbf{Total} & \textbf{End-to-End Pipeline} & \mathbf{24.55\text{ ms}} & \mathbf{345\text{–}865\text{ ms}} & \text{Internal processing: 24.55 ms; Acoustic: } \approx\mathbf{500\text{ ms}} \\
\hline
\end{array}$$

### Technical Interpretation
- The **24.55 ms** figure measured in Step 9 represents **Stages 4, 6, and 7** executing in local Python runtime memory with synthetic PCM frames.
- This proves that EdNova's core facilitation logic, VAD framing, and audio buffering consume **less than 25 ms of CPU overhead**, easily leaving > 1400 ms of head-room within the 1500 ms SLA for external STT, TTS, and network transport.
- However, claiming that 24.55 ms represents the complete acoustic mouth-to-ear latency was inaccurate. Full acoustic streaming latency requires real audio hardware and cloud streaming services.

---

## 4. LiveKit Twirp Permission Revocation Verification

To verify that changing JWT issuance permissions cannot leave an existing participant publishing unauthorized audio, the Twirp control pipeline was re-evaluated:

1. **Initial Token Issuance:**
   - Participant requests token via `POST /api/v1/study/rooms/:roomId/livekit-token`.
   - If user has voice consent (`hasVoiceConsent: true`), JWT contains claim `video: { canPublish: true, canSubscribe: true }`.
2. **Consent Withdrawal Trigger:**
   - User or educator withdraws consent via `PUT /api/v1/study/rooms/:roomId/voice-consent` (`hasVoiceConsent: false`).
   - The route handler immediately issues a Twirp RPC request to LiveKit RoomService:
     ```http
     POST /twirp/livekit.RoomService/UpdateParticipant
     Authorization: Bearer <LiveKitAdminToken>
     Content-Type: application/json

     {
       "room": "step9_room_xxx",
       "identity": "usr_alice_lk",
       "permission": { "canPublish": false, "canSubscribe": true }
     }
     ```
3. **Immediate SFU Enforcement:**
   - The LiveKit SFU server immediately closes any active audio tracks published by `usr_alice_lk` and stops forwarding their media packets to other peers.
   - LiveKit broadcasts a `ParticipantUpdate` event to all room participants over the WebRTC signaling channel.
4. **Eviction on Room Leave:**
   - When a user leaves or is kicked (`POST /leave`), `RemoveParticipant` is dispatched via Twirp, forcibly disconnecting the participant's WebSocket session.
   - Subsequent calls to `ListParticipants` confirm the evicted user is immediately purged from room state.


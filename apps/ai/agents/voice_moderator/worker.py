"""LiveKit room worker for the peer-first voice moderator."""

import asyncio
import logging
import os
import re
import time

from livekit import rtc
from livekit.agents import AgentServer, AutoSubscribe, JobContext, cli, stt
from livekit.plugins import cartesia, deepgram

from agents.facilitator.policy import evaluate_rules
from agents.facilitator.schemas import FacilitatorObservationInput, ParticipantSnapshot

logger = logging.getLogger(__name__)
server = AgentServer()
AGENT_NAME = os.getenv("LIVEKIT_MODERATOR_AGENT_NAME", "ednova-study-moderator")


@server.rtc_session(agent_name=AGENT_NAME)
async def moderate(ctx: JobContext) -> None:
    recognizer = deepgram.STT(language="multi")
    synthesizer = cartesia.TTS(voice=os.environ["CARTESIA_VOICE_ID"])
    output = rtc.AudioSource(synthesizer.sample_rate, synthesizer.num_channels)
    listeners: dict[str, asyncio.Task] = {}
    speech: asyncio.Task | None = None
    next_intervention = 0.0
    ready = asyncio.Event()

    async def speak(message: str) -> None:
        try:
            async with synthesizer.synthesize(message) as stream:
                async for chunk in stream:
                    await output.capture_frame(chunk.frame)
            await output.wait_for_playout()
        except Exception as error:
            logger.warning("Moderator speech failed (%s)", type(error).__name__)

    def consider(participant: rtc.RemoteParticipant, transcript: str) -> None:
        nonlocal speech, next_intervention
        if time.monotonic() < next_intervention or (speech and not speech.done()):
            return
        command = re.match(r"^\s*(?:hey[,. ]+)?moderator[,. ]+(hint|recap)\b", transcript, re.IGNORECASE)
        action = command.group(1).lower() if command else None
        if action == "recap":
            next_intervention = time.monotonic() + 15
            speech = asyncio.create_task(speak(
                "Let's recap together. Can someone state the group's current conclusion, "
                "the reason for it, and one point that is still unresolved?"
            ))
            return
        proposal = evaluate_rules(FacilitatorObservationInput(
            roomId=ctx.room.name,
            speakerUserId=participant.identity,
            speakerName=participant.name or "A learner",
            transcriptText="" if action == "hint" else transcript[-2000:],
            participants=[
                ParticipantSnapshot(userId=peer.identity, name=peer.name or "A learner", role="participant")
                for peer in ctx.room.remote_participants.values()
                if peer.kind == rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD
            ],
            actionType="request_hint" if action == "hint" else "audio_utterance",
            hintLevel=1,
        ))
        if proposal and proposal.shouldIntervene and proposal.messageText:
            next_intervention = time.monotonic() + max(8, proposal.cooldownSeconds)
            speech = asyncio.create_task(speak(proposal.messageText))

    async def listen(track: rtc.Track, participant: rtc.RemoteParticipant) -> None:
        nonlocal speech
        await ready.wait()
        audio = rtc.AudioStream(track, sample_rate=16000, num_channels=1, capacity=32)
        try:
            async with recognizer.stream() as recognition:
                async def forward_audio() -> None:
                    async for event in audio:
                        if participant.permissions.can_publish:
                            recognition.push_frame(event.frame)
                    recognition.end_input()

                sender = asyncio.create_task(forward_audio())
                transcript = ""
                try:
                    async for event in recognition:
                        if event.type == stt.SpeechEventType.START_OF_SPEECH:
                            transcript = ""
                            if speech and not speech.done():
                                speech.cancel()
                                output.clear_queue()
                        elif event.type == stt.SpeechEventType.FINAL_TRANSCRIPT and event.alternatives:
                            transcript = (transcript + " " + event.alternatives[0].text)[-2000:]
                        elif event.type == stt.SpeechEventType.END_OF_SPEECH:
                            if transcript.strip() and participant.permissions.can_publish:
                                consider(participant, transcript)
                            transcript = ""
                finally:
                    sender.cancel()
                    await asyncio.gather(sender, return_exceptions=True)
        except Exception as error:
            logger.warning("Moderator transcription failed (%s)", type(error).__name__)
        finally:
            await audio.aclose()

    @ctx.room.on("track_subscribed")
    def on_subscribed(track, publication, participant) -> None:
        if (
            publication.source == rtc.TrackSource.SOURCE_MICROPHONE
            and participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD
            and participant.permissions.can_publish
        ):
            old = listeners.pop(publication.sid, None)
            if old:
                old.cancel()
            task = asyncio.create_task(listen(track, participant))
            listeners[publication.sid] = task

            def forget(finished: asyncio.Task) -> None:
                if listeners.get(publication.sid) is finished:
                    listeners.pop(publication.sid)

            task.add_done_callback(forget)

    @ctx.room.on("track_unsubscribed")
    def on_unsubscribed(_track, publication, _participant) -> None:
        task = listeners.pop(publication.sid, None)
        if task:
            task.cancel()

    async def cleanup() -> None:
        tasks = list(listeners.values())
        if speech:
            tasks.append(speech)
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await output.aclose()
        await recognizer.aclose()
        await synthesizer.aclose()

    ctx.add_shutdown_callback(cleanup)
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    track = rtc.LocalAudioTrack.create_audio_track("Study moderator", output)
    await ctx.room.local_participant.publish_track(track)
    ready.set()


if __name__ == "__main__":
    required = ("LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "DEEPGRAM_API_KEY",
                "CARTESIA_API_KEY", "CARTESIA_VOICE_ID")
    missing = [key for key in required if not os.getenv(key)]
    if missing:
        raise SystemExit("Set the voice worker environment variables: " + ", ".join(missing))
    cli.run_app(server)

/** Bounded browser audio, normalized for replaceable Azure/Google REST adapters. */
export function encodeWav(
  chunks: Float32Array[],
  sampleRate: number,
): Uint8Array {
  if (!Number.isFinite(sampleRate) || sampleRate < 16000 || sampleRate > 192000)
    throw new Error("Unsupported microphone sample rate");
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const samples = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }
  const count = Math.min(480000, Math.floor((total * 16000) / sampleRate));
  if (count < 1600)
    throw new Error("Record at least a moment of speech, then stop.");
  const buffer = new ArrayBuffer(44 + count * 2),
    view = new DataView(buffer);
  function ascii(index: number, text: string) {
    for (let i = 0; i < text.length; i++)
      view.setUint8(index + i, text.charCodeAt(i));
  }
  ascii(0, "RIFF");
  view.setUint32(4, 36 + count * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, count * 2, true);
  // Area averaging smooths higher-frequency samples while downsampling.
  for (let i = 0; i < count; i++) {
    const start = (i * sampleRate) / 16000,
      end = ((i + 1) * sampleRate) / 16000;
    let sum = 0;
    for (let j = Math.floor(start); j < Math.ceil(end); j++)
      sum +=
        samples[j] * Math.max(0, Math.min(j + 1, end) - Math.max(j, start));
    const sample = Math.max(-1, Math.min(1, sum / (end - start)));
    view.setInt16(
      44 + i * 2,
      Math.round(sample * (sample < 0 ? 32768 : 32767)),
      true,
    );
  }
  return new Uint8Array(buffer);
}
export function wavBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let start = 0; start < bytes.length; start += 8192)
    binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return btoa(binary);
}
export interface Recording {
  stop: () => string;
  cancel: () => void;
}
export async function startRecording(onLimit: () => void): Promise<Recording> {
  if (
    !navigator.mediaDevices?.getUserMedia ||
    !window.AudioContext ||
    !window.AudioWorkletNode
  )
    throw new Error(
      "Recording is unavailable in this browser. You can type your question.",
    );
  const context = new AudioContext();
  let stream: MediaStream | undefined,
    source: MediaStreamAudioSourceNode | undefined,
    worklet: AudioWorkletNode | undefined,
    gain: GainNode | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined,
    closed = false;
  const chunks: Float32Array[] = [];
  let size = 0;
  function cleanup() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    if (worklet) worklet.port.onmessage = null;
    source?.disconnect();
    worklet?.disconnect();
    gain?.disconnect();
    stream?.getTracks().forEach((t) => t.stop());
    void context.close().catch(() => {});
  }
  try {
    await context.resume();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true },
      video: false,
    });
    await context.audioWorklet.addModule("/nardouch-recorder.js");
    source = context.createMediaStreamSource(stream);
    worklet = new AudioWorkletNode(context, "nardouch-pcm");
    gain = context.createGain();
    gain.gain.value = 0;
    worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (closed || size >= context.sampleRate * 30) return;
      chunks.push(event.data);
      size += event.data.length;
    };
    source.connect(worklet);
    worklet.connect(gain);
    gain.connect(context.destination);
    timer = setTimeout(onLimit, 30000);
    return {
      stop: () => {
        cleanup();
        try {
          return wavBase64(encodeWav(chunks, context.sampleRate));
        } finally {
          chunks.length = 0;
        }
      },
      cancel: () => {
        cleanup();
        chunks.length = 0;
      },
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}

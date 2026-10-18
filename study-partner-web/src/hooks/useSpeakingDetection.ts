import { useEffect } from "react";

export default function useSpeakingDetection({ stream, onSpeakingChange }: any) {
  useEffect(() => {
    if (!stream || !onSpeakingChange) return undefined;

    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf: any = null;
    let currentState = "silent";

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum: any, value: any) => sum + value, 0) / data.length;

      let nextState = "silent";
      if (avg > 35) nextState = "speaking";
      if (avg > 65) nextState = "loud";

      if (nextState !== currentState) {
        currentState = nextState;
        onSpeakingChange(nextState);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      source.disconnect();
      analyser.disconnect();
      context.close();
    };
  }, [stream, onSpeakingChange]);
}

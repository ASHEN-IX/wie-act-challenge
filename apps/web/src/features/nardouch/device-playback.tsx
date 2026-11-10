"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function DevicePlayback({ text }: { text: string }) {
  const speech = useRef<SpeechSynthesisUtterance | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (speech.current) {
      speech.current = null;
      window.speechSynthesis.cancel();
    }
  }, []);

  function toggle() {
    if (speech.current) {
      speech.current = null;
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    setError("");
    if (!("speechSynthesis" in window)) {
      setError("Your browser does not support device playback.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(
      text.replace(/\[doc:[^\]]+\]/g, "").replace(/[*#`]/g, ""),
    );
    const finish = () => {
      if (speech.current !== utterance) return false;
      speech.current = null;
      setPlaying(false);
      return true;
    };
    utterance.onend = finish;
    utterance.onerror = () => {
      if (finish()) setError("Device playback is unavailable.");
    };
    speech.current = utterance;
    setPlaying(true);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div>
      <Button type="button" size="sm" variant="ghost" onClick={toggle}>
        {playing ? "Stop reading" : "Read aloud with browser voice"}
      </Button>
      {error && <p role="status" className="text-xs text-muted-foreground">{error}</p>}
    </div>
  );
}

// Capture layer: CDP screencast (lossless-ish JPEG frames with wall-clock timestamps)
// plus a scene timeline (sections, playback speed, captions) on the same clock.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const now = () => Date.now() / 1000;

/** Records every rendered frame of one page. Survives navigations within the tab. */
export class PageRecorder {
  constructor(page, dir) {
    this.page = page;
    this.dir = dir;
    this.frames = [];
  }

  async start() {
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(path.join(this.dir, 'frames'), { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      const file = `f${String(this.frames.length).padStart(6, '0')}.jpg`;
      writeFileSync(path.join(this.dir, 'frames', file), Buffer.from(data, 'base64'));
      this.frames.push({ file, t: metadata.timestamp ?? now() });
      this.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    const vp = this.page.viewportSize();
    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 92,
      maxWidth: vp.width * 2,
      maxHeight: vp.height * 2,
      everyNthFrame: 1,
    });
  }

  async stop() {
    await this.cdp.send('Page.stopScreencast').catch(() => {});
    writeFileSync(path.join(this.dir, 'frames.json'), JSON.stringify({ frames: this.frames, end: now() }));
  }
}

/** Shared clock for a scene: everything the editor needs to pace and caption it. */
export class Timeline {
  constructor(dir) {
    this.dir = dir;
    this.events = [];
    this.t0 = now();
  }
  /** Named part of the scene; the storyboard decides which parts each cut keeps. */
  section(name) {
    this.events.push({ t: now(), type: 'section', value: name });
  }
  /** Playback speed from now on (1 = real time). */
  speed(value) {
    this.events.push({ t: now(), type: 'speed', value });
  }
  /** On-screen caption from now on (null clears it). */
  caption(text) {
    this.events.push({ t: now(), type: 'caption', value: text });
  }
  save(extra = {}) {
    writeFileSync(path.join(this.dir, 'timeline.json'), JSON.stringify({ t0: this.t0, end: now(), events: this.events, ...extra }, null, 1));
  }
}

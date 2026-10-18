/**
 * Extract dominant color from image URL or canvas
 */
export const extractDominantColor = (imageUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    // For external URLs that block CORS, fall back to sampling the rendered page
    if (!imageUrl.startsWith("data:") && !imageUrl.startsWith("blob:")) {
      // Can't use canvas on cross-origin images — derive a hue from URL hash
      resolve(hashStringToColor(imageUrl));
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 50; // Sample small for perf
        canvas.width = MAX_SIZE;
        canvas.height = MAX_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(hashStringToColor(imageUrl));
          return;
        }
        ctx.drawImage(img, 0, 0, MAX_SIZE, MAX_SIZE);

        const imageData = ctx.getImageData(0, 0, MAX_SIZE, MAX_SIZE);
        const data = imageData.data;

        let r = 0,
          g = 0,
          b = 0,
          count = 0;
        for (let i = 0; i < data.length; i += 16) {
          // Sample every 4th pixel
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // Boost saturation so glow is vivid, not muddy
        const [h, s, l] = rgbToHsl(r, g, b);
        const boostedS = Math.min(1, s + 0.4);
        const boostedL = Math.min(0.7, Math.max(0.4, l));
        const [br, bg, bb] = hslToRgb(h, boostedS, boostedL);

        const hex =
          "#" +
          [br, bg, bb].map((x) => x.toString(16).padStart(2, "0")).join("");
        resolve(hex);
      } catch (err) {
        console.warn("Error extracting color from image canvas:", err);
        resolve(hashStringToColor(imageUrl));
      }
    };
    img.onerror = () => {
      console.warn(
        "Error loading image for color extraction, using hash fallback:",
        imageUrl,
      );
      resolve(hashStringToColor(imageUrl));
    };
    img.src = imageUrl;
  });
};

/**
 * Extract dominant color from video (grab first frame)
 */
export const extractColorFromVideo = (videoUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    if (!videoUrl.startsWith("data:") && !videoUrl.startsWith("blob:")) {
      resolve(hashStringToColor(videoUrl));
      return;
    }

    const video = document.createElement("video");
    video.muted = true;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(video.duration * 0.1, 1);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 50;
        canvas.width = MAX_SIZE;
        canvas.height = MAX_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve("#4fb8ce");
          return;
        }
        ctx.drawImage(video, 0, 0, MAX_SIZE, MAX_SIZE);

        const imageData = ctx.getImageData(0, 0, MAX_SIZE, MAX_SIZE);
        const data = imageData.data;

        let r = 0,
          g = 0,
          b = 0,
          count = 0;
        for (let i = 0; i < data.length; i += 16) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        const [h, s, l] = rgbToHsl(r, g, b);
        const boostedS = Math.min(1, s + 0.4);
        const boostedL = Math.min(0.7, Math.max(0.4, l));
        const [br, bg, bb] = hslToRgb(h, boostedS, boostedL);

        const hex =
          "#" +
          [br, bg, bb].map((x) => x.toString(16).padStart(2, "0")).join("");
        resolve(hex);
      } catch (err) {
        console.warn("Error extracting color from video canvas:", err);
        resolve("#4fb8ce");
      }
    };
    video.onerror = () => {
      console.warn("Error loading video for color extraction:", videoUrl);
      resolve("#4fb8ce");
    };
    video.src = videoUrl;
  });
};

/**
 * Color helpers
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
      default:
        h = 0;
        break;
    }
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Derive a consistent vibrant color from a string (for cross-origin URLs)
 */
function hashStringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  const [r, g, b] = hslToRgb(h / 360, 0.65, 0.55);
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Lighten or darken a hex color
 */
export const adjustColor = (hex: string, percent: number): string => {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  r = Math.min(255, Math.max(0, Math.round(r + (256 - r) * percent)));
  g = Math.min(255, Math.max(0, Math.round(g + (256 - g) * percent)));
  b = Math.min(255, Math.max(0, Math.round(b + (256 - b) * percent)));

  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
};

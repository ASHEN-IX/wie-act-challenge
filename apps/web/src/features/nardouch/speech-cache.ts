/** Browser-session audio only. Single-flight also covers two mounted players. */
const blobs = new Map<string, Blob>();
const pending = new Map<string, Promise<Blob>>();
export function cachedSpeech(key: string) {
  return blobs.get(key);
}
export async function sessionSpeech(
  key: string,
  generate: () => Promise<Blob>,
): Promise<Blob> {
  const cached = blobs.get(key);
  if (cached) return cached;
  const running = pending.get(key);
  if (running) return running;
  const operation = generate()
    .then((blob) => {
      if (blobs.size >= 10) blobs.delete(blobs.keys().next().value!);
      blobs.set(key, blob);
      return blob;
    })
    .finally(() => pending.delete(key));
  pending.set(key, operation);
  return operation;
}

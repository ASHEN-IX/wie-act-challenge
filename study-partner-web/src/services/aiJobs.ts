import type { AxiosInstance } from 'axios';

export async function waitForJob(api: AxiosInstance, poll: string, signal?: AbortSignal) {
  const started = Date.now();
  for (let attempt = 0; Date.now() - started < 90000; attempt++) {
    signal?.throwIfAborted();
    const response = await api.get(poll, { signal });
    if (response.data.status === 'COMPLETED') return response.data.result;
    if (response.data.status === 'FAILED') throw new Error(response.data.error || 'AI request failed');
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, Math.min(5000, 1000 + attempt * 500));
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
  throw new Error('AI request is still processing. Check its status and try again later.');
}

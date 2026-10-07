/** Enlaces de YouTube (el video de presentación del médico). Sin dependencias: se prueba con Node. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be']);
const ID_IN_PATH = new Set(['embed', 'shorts', 'live', 'v']);

/**
 * Id de un video de YouTube a partir de su enlace (la misma regla de la
 * plataforma, solo para avisar antes de enviar: decide el servidor). Sin
 * `URL`: en la app se separa a mano.
 */
export function parseYouTubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (VIDEO_ID.test(raw)) return raw;
  const match = raw.match(/^(?:https?:\/\/)?([^/?#:@]+)(\/[^?#]*)?(?:\?([^#]*))?/i);
  if (!match || /@/.test(raw.split(/[/?#]/)[2] ?? '')) return null;
  const host = match[1].toLowerCase();
  const [, first = '', second = ''] = (match[2] ?? '/').split('/');
  let candidate: string | null = null;
  if (SHORT_HOSTS.has(host)) candidate = first;
  else if (YOUTUBE_HOSTS.has(host)) {
    if (first === 'watch' && !second)
      candidate =
        (match[3] ?? '')
          .split('&')
          .find((p) => p.startsWith('v='))
          ?.slice(2) ?? null;
    else if (ID_IN_PATH.has(first)) candidate = second;
  }
  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}

export const youTubeShortUrl = (videoId: string) => `https://youtu.be/${videoId}`;

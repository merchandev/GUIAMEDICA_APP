import { router } from 'expo-router';

/** Atajos de navegación usados desde varias pantallas. */
export function openLegal(path: string) {
  router.push({ pathname: '/legal/leer', params: { path } });
}

export function openDoctor(slug: string) {
  router.push({ pathname: '/medico/[slug]', params: { slug } });
}

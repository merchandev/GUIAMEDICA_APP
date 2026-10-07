import { useApi } from './data';

/**
 * Funciones que la plataforma enciende o apaga (las mismas de la web): las
 * valoraciones y los récipes digitales. Los menús solo las muestran
 * encendidas. Se guardan en el teléfono para saberlo también sin conexión.
 */
export function useFeatures() {
  const reviews = useApi<{ enabled: boolean; minForAverage: number }>('/reviews/config', {
    cacheKey: 'pub:features:reviews',
  });
  const prescriptions = useApi<{ enabled: boolean; rulesVersion: string; maxItems: number }>('/prescriptions/config', {
    cacheKey: 'pub:features:prescriptions',
  });
  return {
    reviews: !!reviews.data?.enabled,
    prescriptions: !!prescriptions.data?.enabled,
    prescriptionRules: prescriptions.data ?? null,
  };
}

import type { Municipality, Specialty } from './contracts';
import { useApi } from './data';

/** Municipios de Monagas (los mismos de la web), guardados para verlos sin conexión. */
export function useMunicipalities(): Municipality[] {
  return (
    useApi<Municipality[]>('/geo/municipalities', { cacheKey: 'pub:municipalities', topics: ['catalog'] }).data ?? []
  );
}

/** Especialidades del directorio, guardadas para verlas sin conexión. */
export function useSpecialties(): Specialty[] {
  return useApi<Specialty[]>('/specialties', { cacheKey: 'pub:specialties', topics: ['catalog'] }).data ?? [];
}

export function municipalityOptions(list: readonly Municipality[], empty = 'Selecciona') {
  return [{ value: '', label: empty }, ...list.map((m) => ({ value: m.name, label: m.name }))];
}

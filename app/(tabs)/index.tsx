import React, { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { DoctorCard } from '../../src/components/DoctorCard';
import { searchable, type Doctor, type DirectoryPage, type Municipality, type Specialty } from '../../src/contracts';
import { useApi } from '../../src/data';
import { store } from '../../src/offline';
import { useSession } from '../../src/session';
import { Button, Empty, ErrorText, Field, Loading, Muted, Row, Screen, Section, Select, Title } from '../../src/ui';

/** Directorio público: búsqueda, filtros por especialidad y municipio, destacados y páginas. */
export default function DirectoryScreen() {
  const { user } = useSession();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [page, setPage] = useState(1);
  const specialties = useApi<Specialty[]>('/specialties', { cacheKey: 'pub:specialties', topics: ['catalog'] });
  const municipalities = useApi<Municipality[]>('/geo/municipalities', {
    cacheKey: 'pub:municipalities',
    topics: ['catalog'],
  });
  const params = new URLSearchParams({ limit: '12', page: String(page) });
  if (query) params.set('search', query);
  if (specialty) params.set('specialty', specialty);
  if (municipality) params.set('municipality', municipality);
  const directory = useApi<DirectoryPage>(`/professionals?${params}`, {
    cacheKey: `pub:directory:${page}:${query}:${specialty}:${municipality}`,
    topics: ['directory'],
    // Sin conexión y sin esta búsqueda guardada: se busca entre los médicos guardados en el teléfono.
    fallback: () => {
      const found = new Map<string, Doctor>();
      for (const [, entry] of store.list('pub:directory:'))
        (entry.data as DirectoryPage).items.forEach((d) => found.set(d.id, d));
      for (const [, entry] of store.list('pub:doctor:')) found.set((entry.data as Doctor).id, entry.data as Doctor);
      const wanted = searchable(query);
      const items = [...found.values()].filter(
        (d) =>
          searchable(
            `${d.firstName} ${d.lastName} ${d.specialties.map((x) => x.specialty.name).join(' ')} ${d.municipality ?? ''}`,
          ).includes(wanted) &&
          (!specialty || d.specialties.some((x) => x.specialty.slug === specialty)) &&
          (!municipality || d.municipality === municipality),
      );
      return { items, totalPages: 1 };
    },
  });
  // Los médicos entran a su panel (Inicio); el directorio se abre desde allí.
  if (user?.role === 'PROFESSIONAL') return <Redirect href="/inicio" />;

  const result = directory.data;
  const filtered = !!(query || specialty || municipality);
  const open = (d: Doctor) => router.push({ pathname: '/medico/[slug]', params: { slug: d.slug } });
  const apply = () => {
    setPage(1);
    setQuery(search.trim());
  };
  return (
    <Screen refreshing={directory.refreshing} onRefresh={directory.refresh} savedAt={directory.savedAt}>
      <Title>Encuentra a tu médico</Title>
      <Muted>Médicos de Monagas con verificación documental. Busca por nombre, especialidad o código GM.</Muted>
      <Field
        label="Buscar"
        value={search}
        onChangeText={setSearch}
        placeholder="Nombre, especialidad o código"
        autoCapitalize="none"
      />
      <Select
        label="Especialidad"
        value={specialty}
        onChange={(v) => {
          setSpecialty(v);
          setPage(1);
        }}
        options={[
          { value: '', label: 'Todas las especialidades' },
          ...(specialties.data ?? []).map((x) => ({ value: x.slug, label: x.name })),
        ]}
      />
      <Select
        label="Municipio"
        value={municipality}
        onChange={(v) => {
          setMunicipality(v);
          setPage(1);
        }}
        options={[
          { value: '', label: 'Todo Monagas' },
          ...(municipalities.data ?? []).map((x) => ({ value: x.name, label: x.name })),
        ]}
      />
      <Row>
        <Button title="Buscar" onPress={apply} />
        {filtered && (
          <Button
            title="Limpiar filtros"
            variant="secondary"
            onPress={() => {
              setSearch('');
              setQuery('');
              setSpecialty('');
              setMunicipality('');
              setPage(1);
            }}
          />
        )}
      </Row>
      {directory.fromFallback && <Muted>Sin conexión: resultados entre los médicos guardados en este teléfono.</Muted>}
      <ErrorText message={directory.error} />
      {!filtered && page === 1 && !!result?.featured?.length && (
        <Section title="Destacados" description="Espacio patrocinado. No es una recomendación médica.">
          {result.featured.map((d) => (
            <DoctorCard key={`f-${d.id}`} doctor={d} sponsored onPress={() => open(d)} />
          ))}
        </Section>
      )}
      {directory.loading && !result ? (
        <Loading label="Buscando médicos…" />
      ) : (
        <Section title={filtered ? 'Resultados' : 'Directorio'}>
          {result?.items.map((d) => (
            <DoctorCard key={d.id} doctor={d} onPress={() => open(d)} />
          ))}
          {!result?.items.length && (
            <Empty
              title="No encontramos médicos con esos filtros"
              description={filtered ? 'Prueba con otra especialidad, otro municipio o sin filtros.' : undefined}
            />
          )}
        </Section>
      )}
      {(result?.totalPages ?? 1) > 1 && (
        <Row style={{ justifyContent: 'space-between' }}>
          <Button
            title="Anterior"
            variant="secondary"
            small
            disabled={page <= 1}
            onPress={() => setPage((p) => p - 1)}
          />
          <Muted>
            Página {page} de {result?.totalPages}
          </Muted>
          <Button
            title="Siguiente"
            variant="secondary"
            small
            disabled={page >= (result?.totalPages ?? 1)}
            onPress={() => setPage((p) => p + 1)}
          />
        </Row>
      )}
    </Screen>
  );
}

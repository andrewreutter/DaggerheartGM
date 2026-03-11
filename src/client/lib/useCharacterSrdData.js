import { useState, useEffect, useRef } from 'react';

let cachedSrdData = null;
let fetchPromise = null;

async function fetchSrdCollection(collection) {
  const res = await fetch(`/api/srd/${collection}?limit=500`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.items || [];
}

function buildLookup(items) {
  const byId = {};
  for (const item of items) {
    if (item.id) byId[item.id] = item;
  }
  return byId;
}

async function loadAllSrdData() {
  const [classes, subclasses, ancestries, communities, armor, weapons, abilities, domains] = await Promise.all([
    fetchSrdCollection('classes'),
    fetchSrdCollection('subclasses'),
    fetchSrdCollection('ancestries'),
    fetchSrdCollection('communities'),
    fetchSrdCollection('armor'),
    fetchSrdCollection('weapons'),
    fetchSrdCollection('abilities'),
    fetchSrdCollection('domains'),
  ]);

  return {
    classes,
    subclasses,
    ancestries,
    communities,
    armor,
    weapons,
    abilities,
    domains,
    classesById: buildLookup(classes),
    subclassesById: buildLookup(subclasses),
    ancestriesById: buildLookup(ancestries),
    communitiesById: buildLookup(communities),
    armorById: buildLookup(armor),
    weaponsById: buildLookup(weapons),
    abilitiesById: buildLookup(abilities),
    domainsById: buildLookup(domains),
  };
}

/**
 * Hook that fetches and caches all SRD collections needed for the character builder.
 * Returns { srdData, loading, error }.
 */
export function useCharacterSrdData() {
  const [srdData, setSrdData] = useState(cachedSrdData);
  const [loading, setLoading] = useState(!cachedSrdData);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (cachedSrdData) {
      setSrdData(cachedSrdData);
      setLoading(false);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = loadAllSrdData();
    }

    fetchPromise
      .then(data => {
        cachedSrdData = data;
        if (mounted.current) {
          setSrdData(data);
          setLoading(false);
        }
      })
      .catch(err => {
        fetchPromise = null;
        if (mounted.current) {
          setError(err);
          setLoading(false);
        }
      });

    return () => { mounted.current = false; };
  }, []);

  return { srdData, loading, error };
}

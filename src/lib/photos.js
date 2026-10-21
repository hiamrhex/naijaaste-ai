// Free dish photos via Wikimedia Commons (no key, no card).
// Returns { url, author, license } or null. Results are cached in memory;
// when Save-Data is on we skip the network entirely and use gradient art.
import { readJson } from './api.js';

const cache = new Map();

const saveDataOn = () =>
  typeof navigator !== 'undefined' && !!navigator.connection?.saveData;

export const commonsPhoto = async (query) => {
  if (!query || saveDataOn()) return null;
  const key = query.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key);
  const promise = (async () => {
    try {
      const search = new URL('https://commons.wikimedia.org/w/api.php');
      search.searchParams.set('action', 'query');
      search.searchParams.set('format', 'json');
      search.searchParams.set('origin', '*');
      search.searchParams.set('list', 'search');
      search.searchParams.set('srsearch', `${query} food dish`);
      search.searchParams.set('srnamespace', '6');
      search.searchParams.set('srlimit', '1');
      const r1 = await fetch(search.toString());
      const j1 = await readJson(r1);
      const title = j1?.query?.search?.[0]?.title;
      if (!title) return null;
      const info = new URL('https://commons.wikimedia.org/w/api.php');
      info.searchParams.set('action', 'query');
      info.searchParams.set('format', 'json');
      info.searchParams.set('origin', '*');
      info.searchParams.set('formatversion', '2');
      info.searchParams.set('prop', 'pageimages|imageinfo');
      info.searchParams.set('piprop', 'thumbnail');
      info.searchParams.set('pithumbsize', '640');
      info.searchParams.set('iiprop', 'user|extmetadata');
      info.searchParams.set('titles', title);
      const r2 = await fetch(info.toString());
      const j2 = await readJson(r2);
      const page = j2?.query?.pages?.[0];
      const url = page?.thumbnail?.source;
      if (!url) return null;
      const meta = page?.imageinfo?.[0]?.extmetadata || {};
      return {
        url,
        author: (meta.Artist?.value || '').replace(/<[^>]+>/g, '').slice(0, 80) || 'Wikimedia Commons',
      };
    } catch {
      return null;
    }
  })();
  cache.set(key, promise);
  return promise;
};

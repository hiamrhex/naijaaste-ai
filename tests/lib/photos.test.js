// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { commonsPhoto } from '../../src/lib/photos.js';

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => body,
});

const searchHit = (title) => ({ query: { search: [{ title }] } });

const imageInfo = ({ url = 'https://upload.example/jollof.jpg', artist = '<a href="#">Ada</a>' } = {}) => ({
  query: {
    pages: [
      {
        thumbnail: { source: url },
        imageinfo: [{ extmetadata: { Artist: { value: artist } } }],
      },
    ],
  },
});

const stubFetch = (...responses) => {
  const mock = vi.fn();
  for (const response of responses) mock.mockResolvedValueOnce(response);
  globalThis.fetch = mock;
  return mock;
};

beforeEach(() => {
  delete navigator.connection;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete navigator.connection;
});

describe('commonsPhoto', () => {
  it('returns null for an empty query without touching the network', async () => {
    const fetchMock = stubFetch();

    expect(await commonsPhoto('')).toBeNull();
    expect(await commonsPhoto(null)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null and skips the network when Save-Data is on', async () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: true },
    });
    const fetchMock = stubFetch();

    expect(await commonsPhoto('jollof')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the image url and a plain-text author', async () => {
    stubFetch(jsonResponse(searchHit('File:Egusi soup.jpg')), jsonResponse(imageInfo()));

    const photo = await commonsPhoto('egusi');

    expect(photo.url).toBe('https://upload.example/jollof.jpg');
    expect(photo.author).toBe('Ada');
  });

  it('falls back to a generic author when the metadata is empty', async () => {
    stubFetch(
      jsonResponse(searchHit('File:Amala.jpg')),
      jsonResponse(imageInfo({ artist: '' }))
    );

    const photo = await commonsPhoto('amala');

    expect(photo.author).toBe('Wikimedia Commons');
  });

  it('returns null when the search has no results', async () => {
    stubFetch(jsonResponse({ query: { search: [] } }));

    expect(await commonsPhoto('nothing-found-dish')).toBeNull();
  });

  it('returns null when the page has no thumbnail', async () => {
    stubFetch(
      jsonResponse(searchHit('File:Banga soup.jpg')),
      jsonResponse({ query: { pages: [{}] } })
    );

    expect(await commonsPhoto('banga')).toBeNull();
  });

  it('serves concurrent and repeat calls from one cache entry', async () => {
    const fetchMock = stubFetch(
      jsonResponse(searchHit('File:Suya.jpg')),
      jsonResponse(imageInfo())
    );

    const [a, b] = await Promise.all([commonsPhoto('Suya'), commonsPhoto('  suya  ')]);
    const c = await commonsPhoto('SUYA');

    expect(a).toBe(b);
    expect(c).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries after a failed lookup instead of caching the failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse(searchHit('File:Pepper soup.jpg')))
      .mockResolvedValueOnce(jsonResponse(imageInfo()));

    globalThis.fetch = fetchMock;

    expect(await commonsPhoto('pepper-soup')).toBeNull();

    const photo = await commonsPhoto('pepper-soup');

    expect(photo?.url).toBe('https://upload.example/jollof.jpg');
  });

  it('accepts a non-string dish name instead of throwing', async () => {
    stubFetch();

    await expect(commonsPhoto(123)).resolves.toBeNull();
  });
});

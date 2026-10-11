import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger.js';

// Check-in ratings (C): 1–5 stars + optional note, stored server-side so
// they can feed recommendations later. JSON-file store, same seam as users.
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
const FILE = join(DATA_DIR, 'ratings.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const load = () => {
  try {
    if (!existsSync(FILE)) return [];
    const parsed = JSON.parse(readFileSync(FILE, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

let ratings = load();

const persist = () => {
  try {
    writeFileSync(FILE, JSON.stringify(ratings, null, 2), 'utf-8');
  } catch (err) {
    logger.error({ err }, 'ratings persist failed');
  }
};

export const createRating = ({ userId, restaurantId, stars, note, context }) => {
  const rating = {
    id: randomUUID(),
    user_id: userId,
    restaurant_id: restaurantId,
    stars,
    note: note || null,
    context: context || 'saved',
    at: new Date().toISOString(),
  };
  ratings.push(rating);
  persist();
  return rating;
};

export const listRatingsByUser = (userId) => ratings.filter((r) => r.user_id === userId);

export const listAllRatings = () => [...ratings];

export const countRatings = () => ratings.length;

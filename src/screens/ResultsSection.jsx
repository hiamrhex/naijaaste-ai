import { memo } from 'react';
import { Utensils, RefreshCw, BarChart3, MessageSquare, Clock } from 'lucide-react';
import { RestaurantCard } from '../components/RestaurantCard.jsx';
import { PersonaCard } from '../components/PersonaCard.jsx';
import { NearbyPanel } from '../components/NearbyPanel.jsx';
import { haversineKm } from '../utils/geo.js';

export const ResultsSection = memo(({ recs, persona, showNearby, nearbyLoading, nearbyError, nearby, findNearby, setShowNearby, favorites, toggleFavorite, generateReview, geoCache, nearbyOrigin, reset }) => {
  if (!recs && !persona && !showNearby) return null;

  return (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {showNearby && (
        <NearbyPanel
          loading={nearbyLoading}
          error={nearbyError}
          nearby={nearby}
          onRetry={findNearby}
          onClose={() => setShowNearby(false)}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {persona && <PersonaCard persona={persona} />}

      {recs && (
        <div>
          <div className="results-head">
            <h2 className="results-title">
              <Utensils size={15} color="var(--orange)" aria-hidden="true" />
              {recs.length} spot{recs.length === 1 ? '' : 's'} worth eating at
            </h2>
            <span className="results-ready">Ready</span>
          </div>

          <div className="results-grid">
            {recs.map((r, i) => {
              const geo = geoCache[r.restaurant_id];
              const distanceKm = geo && nearbyOrigin
                ? Math.round(haversineKm(nearbyOrigin.lat, nearbyOrigin.lng, geo.lat, geo.lng) * 10) / 10
                : undefined;
              return (
                <RestaurantCard
                  key={r.restaurant_id || i}
                  rec={r}
                  index={i}
                  onReview={generateReview}
                  distanceKm={distanceKm}
                  directionsUrl={geo?.directions_url}
                  isFavorite={favorites.includes(r.restaurant_id)}
                  onToggleFavorite={toggleFavorite}
                />
              );
            })}
          </div>

          {recs.meta && (
            <div className="results-meta">
              {recs.meta.after_hard_filter != null && (
                <span>
                  <BarChart3 size={11} aria-hidden="true" />{recs.meta.after_hard_filter} restaurants filtered
                </span>
              )}
              {recs.meta.candidates_sent_to_llm != null && (
                <span>
                  <MessageSquare size={11} aria-hidden="true" />{recs.meta.candidates_sent_to_llm} ranked by AI
                </span>
              )}
              <span>
                <Clock size={11} aria-hidden="true" />{recs.meta.latency_ms}ms
              </span>
            </div>
          )}

          <button
            onClick={reset}
            style={{ marginTop: 12, background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s', minHeight: 44, width: '100%' }}
          >
            <RefreshCw size={13} /> Start a new search
          </button>
        </div>
      )}
    </div>
  );
});

ResultsSection.displayName = 'ResultsSection';
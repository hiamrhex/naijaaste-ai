import { MapPin, DollarSign, Flame, Users, Utensils, ShieldCheck, Sparkles } from 'lucide-react';
import { Tag } from './Tag';
import { SpiceBar } from './SpiceBar';
import { BUDGET_MAP, SPICE_MAP } from '../constants';

export function PersonaCard({ persona }) {
  if (!persona) return null;
  const budgetLevel = BUDGET_MAP[persona.budget_level?.toLowerCase()] || 1;
  const spice = SPICE_MAP[persona.spice_tolerance?.toLowerCase()] || 2;

  return (
    <div className="slide-in-right" style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 16, padding: "16px 18px", marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, background: "rgba(249,115,22,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Users size={16} color="var(--orange)" />
          </div>
          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>Your Taste Profile</span>
        </div>
        <Tag variant={persona.user_state === "warm" ? "green" : "blue"}>
          {persona.user_state === "warm" ? <ShieldCheck size={10} /> : <Sparkles size={10} />}
          {persona.user_state === "warm" ? "Warm User" : "Cold Start"}
        </Tag>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {persona.city && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={13} color="var(--orange)" />
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>City</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{persona.city}</div>
            </div>
          </div>
        )}
        {persona.budget_level && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <DollarSign size={13} color="var(--green)" />
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Budget</div>
              <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} style={{
                    fontSize: 12, fontWeight: 700,
                    color: i < budgetLevel ? "var(--green)" : "var(--border)",
                  }}>₦</span>
                ))}
              </div>
            </div>
          </div>
        )}
        {persona.spice_tolerance && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Flame size={13} color="var(--orange)" />
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Spice</div>
              <SpiceBar level={spice} max={5} />
            </div>
          </div>
        )}
        {persona.social_context && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={13} color="#60a5fa" />
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Occasion</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", textTransform: "capitalize" }}>
                {persona.social_context.replace(/_/g, " ")}
              </div>
            </div>
          </div>
        )}
        {persona.preferred_ambience && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Utensils size={13} color="var(--amber)" />
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Ambience</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", textTransform: "capitalize" }}>
                {persona.preferred_ambience.replace(/_/g, " ")}
              </div>
            </div>
          </div>
        )}
        {persona.cuisine_preferences?.length > 0 && (
          <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
            {persona.cuisine_preferences.slice(0, 4).map((c) => (
              <Tag key={c} variant="orange">{c}</Tag>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { useNavigate } from "react-router";
import type { ListingCard } from "../lib/types";

const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = import.meta.env.VITE_MAP_ATTRIBUTION || "&copy; contributeurs OpenStreetMap";
export const DAKAR: [number, number] = [14.7167, -17.4677];

function shortPrice(listing: ListingCard) {
  const p = listing.price;
  const text = p >= 1_000_000 ? `${(p / 1_000_000).toFixed(p >= 10_000_000 ? 0 : 1).replace(".", ",")} M` : `${Math.round(p / 1000)} k`;
  return `${text} F`;
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 15);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
  }, [map, points]);
  return null;
}

export function ResultsMap({ listings, activeId, onSelect }: { listings: ListingCard[]; activeId?: string | null; onSelect?: (id: string) => void }) {
  const navigate = useNavigate();
  const located = listings.filter((l) => l.latitude !== null && l.longitude !== null);
  const points = useMemo(() => located.map((l) => [l.latitude!, l.longitude!] as [number, number]), [located]);
  return (
    <MapContainer center={DAKAR} zoom={12} scrollWheelZoom className="size-full" aria-label="Carte des résultats">
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
      <FitBounds points={points} />
      {located.map((l) => (
        <Marker
          key={l.id}
          position={[l.latitude!, l.longitude!]}
          title={l.title}
          keyboard
          icon={L.divIcon({ className: "", html: `<span class="price-marker${l.id === activeId ? " is-active" : ""}">${shortPrice(l)}</span>`, iconSize: [64, 28], iconAnchor: [32, 14] })}
          eventHandlers={{ click: () => (onSelect ? onSelect(l.id) : navigate(`/logements/${l.id}`)), keypress: () => navigate(`/logements/${l.id}`) }}
        />
      ))}
    </MapContainer>
  );
}

/** Localisation approximative (cercle ~200 m) : l'adresse exacte n'est jamais déduite de la carte. */
export function ApproxLocationMap({ lat, lng }: { lat: number; lng: number }) {
  return (
    <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} className="size-full" aria-label="Localisation approximative">
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
      <Circle center={[lat, lng]} radius={200} pathOptions={{ color: "#6d5df5", fillOpacity: 0.2 }} />
    </MapContainer>
  );
}

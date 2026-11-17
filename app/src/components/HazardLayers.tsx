import { Layer, Source } from "react-map-gl/maplibre";
import { floodOverlay } from "../lib/data";

export type Hazard = "flood" | "liquefaction" | "faults";
export type HazardSet = Record<Hazard, boolean>;

export const NO_HAZARDS: HazardSet = {
  flood: false,
  liquefaction: false,
  faults: false,
};

// PHIVOLCS doesn't allow downloading fault lines as data, only viewing them, so the map asks
// their server for a picture of each tile. Loaded only while the toggle is on.
const FAULT_TILES =
  "https://ulap-hazards.georisk.gov.ph/arcgis/rest/services/PHIVOLCSPublic/ActiveFault/MapServer/export" +
  "?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image";

const LIQ_COLORS = { high: "#F97316", moderate: "#FBBF24", low: "#FDE68A" };

const BUTTONS: { id: Hazard; label: string }[] = [
  { id: "flood", label: "🌊 Flood zones" },
  { id: "liquefaction", label: "🫨 Liquefaction" },
  { id: "faults", label: "⚡ Fault lines" },
];

const LEGENDS: Record<Hazard, { items: [string, string][]; source: string }> =
  {
    flood: {
      items: [
        ["#EF4444", "High: over 1.5 m"],
        ["#FACC15", "Medium: 0.5–1.5 m"],
        ["#38BDF8", "Low: up to 0.5 m"],
      ],
      source: "100-year rain · Project NOAH",
    },
    liquefaction: {
      items: [
        [LIQ_COLORS.high, "High potential"],
        [LIQ_COLORS.moderate, "Moderate potential"],
        [LIQ_COLORS.low, "Low potential"],
      ],
      source: "Ground softening in a quake · PHIVOLCS",
    },
    faults: {
      items: [
        ["#DC2626", "Active fault"],
        ["#1B1340", "Potentially active fault"],
      ],
      source: "PHIVOLCS",
    },
  };

/** The map layers; render inside <Map>. */
export function HazardSources({ on }: { on: HazardSet }) {
  return (
    <>
      {on.liquefaction && (
        <Source
          id="liquefaction"
          type="geojson"
          data="/liquefaction.geojson"
          attribution="Liquefaction: PHIVOLCS"
        >
          <Layer
            id="liquefaction"
            type="fill"
            paint={{
              "fill-color": [
                "match",
                ["get", "level"],
                "high",
                LIQ_COLORS.high,
                "moderate",
                LIQ_COLORS.moderate,
                LIQ_COLORS.low,
              ],
              "fill-opacity": 0.45,
            }}
          />
        </Source>
      )}
      {on.flood && (
        // Image sources can't carry attribution; the legend credits Project NOAH.
        <Source id="flood" type="image" {...floodOverlay}>
          <Layer
            id="flood"
            type="raster"
            paint={{ "raster-opacity": 0.75, "raster-fade-duration": 0 }}
          />
        </Source>
      )}
      {on.faults && (
        <Source
          id="faults"
          type="raster"
          tiles={[FAULT_TILES]}
          tileSize={256}
          attribution="Active faults: PHIVOLCS"
        >
          <Layer id="faults" type="raster" />
        </Source>
      )}
    </>
  );
}

/** Toggle buttons and a legend for each layer that's on; render over the map. */
export function HazardControls({
  on,
  setOn,
}: {
  on: HazardSet;
  setOn: (s: HazardSet) => void;
}) {
  return (
    <div className="absolute right-3 top-28 flex max-w-[60vw] flex-col items-end gap-2">
      {BUTTONS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => setOn({ ...on, [id]: !on[id] })}
          aria-pressed={on[id]}
          className={`rounded-full border-2 border-[#1B1340] px-3 py-1.5 text-sm font-extrabold shadow-[2px_2px_0_0_#1B1340] transition hover:-translate-y-0.5 ${
            on[id] ? "bg-[#1B1340] text-white" : "bg-white text-[#1B1340]"
          }`}
        >
          {label}
        </button>
      ))}
      {BUTTONS.filter(({ id }) => on[id]).map(({ id }) => (
        <div
          key={id}
          className="rounded-xl border-2 border-[#1B1340] bg-white px-3 py-2 text-xs font-bold text-[#1B1340] shadow-[2px_2px_0_0_#1B1340]"
        >
          {LEGENDS[id].items.map(([c, t]) => (
            <p key={t} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm border border-[#1B1340]"
                style={{ background: c }}
              />
              {t}
            </p>
          ))}
          <p className="mt-1 font-semibold text-[#1B1340]/60">
            {LEGENDS[id].source}
          </p>
        </div>
      ))}
    </div>
  );
}

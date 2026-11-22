import { peso, short } from "../../../lib/format";
import {
  KINDS,
  KIND_EMOJI,
  KIND_LABEL,
  type Listing,
} from "../../../lib/listings";
import { field, label, note } from "../../ui";

/** Property dropdown grouped by type, plus a one-line summary of the pick. */
export default function PropertyPicker({
  listings,
  listing,
  onPick,
}: {
  listings: Listing[];
  listing: Listing;
  onPick: (id: string) => void;
}) {
  return (
    <>
      <label className={label}>
        Property
        <select
          value={listing.id}
          onChange={(e) => onPick(e.target.value)}
          className={`${field} mb-1 mt-0.5 text-[#1B1340]`}
        >
          {KINDS.map((k) => {
            const group = listings.filter((l) => l.kind === k);
            return group.length ? (
              <optgroup key={k} label={KIND_LABEL[k]}>
                {group.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.city}
                    {l.priceLow ? `, from ${short(l.priceLow)}` : ""})
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
      </label>
      <p className={`mb-3 ${note}`}>
        {KIND_EMOJI[listing.kind]} {KIND_LABEL[listing.kind]} by{" "}
        {listing.developer} in {listing.city}
        {listing.status === "preselling" ? " · Preselling" : ""}
        <br />
        Published price:{" "}
        {listing.priceLow
          ? priceRange(listing)
          : listing.monthlyFrom
            ? `not listed (ads say from ${peso(listing.monthlyFrom)}/mo)`
            : "not listed"}
        .{" "}
        <a
          href={listing.url}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Project page
        </a>
      </p>
    </>
  );
}

function priceRange(l: Listing) {
  if (!l.priceLow) return "";
  return l.priceHigh && l.priceHigh > l.priceLow
    ? `${peso(l.priceLow)} to ${peso(l.priceHigh)}`
    : `from ${peso(l.priceLow)}`;
}

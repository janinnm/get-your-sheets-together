import { z } from "zod";
import projectsRaw from "../../data/projects.json";
import floodOverlayRaw from "../../data/flood-overlay.json";
import { Project } from "../types/data";
import { fromProject, type Listing } from "./listings";

export const listings: Listing[] = z
  .array(Project)
  .parse(projectsRaw)
  .map(fromProject);

const Corner = z.tuple([z.number(), z.number()]);

/** Project NOAH 100-year flood zones as one image (see pipelines/hazards.py), corners
 * in MapLibre's order: top-left, top-right, bottom-right, bottom-left. */
export const floodOverlay = z
  .object({
    url: z.string(),
    coordinates: z.tuple([Corner, Corner, Corner, Corner]),
  })
  .parse(floodOverlayRaw);

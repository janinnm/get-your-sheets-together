import { z } from "zod";
import projectsRaw from "../../data/projects.json";
import { Project } from "../types/data";
import { fromProject, type Listing } from "./listings";

export const listings: Listing[] = z
  .array(Project)
  .parse(projectsRaw)
  .map(fromProject);

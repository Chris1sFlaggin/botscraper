// Bot-scoring fields live on UserNode (see model/user.ts). This module re-exports
// the Enrichment shape so the scoring engine and its tests have a stable import path.
export type { Enrichment } from "./user";

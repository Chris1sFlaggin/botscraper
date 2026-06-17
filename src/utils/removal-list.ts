import { UserNode } from "../model/user";

export interface RemovalBot {
  readonly id: string;
  readonly username: string;
  readonly full_name: string;
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface RemovalList {
  readonly schemaVersion: 1;
  readonly app: "botscraper";
  readonly target: { readonly id: string; readonly username: string };
  readonly scannedAt: string;
  readonly bots: readonly RemovalBot[];
}

export function buildRemovalList(
  target: { readonly id: string; readonly username: string },
  bots: readonly UserNode[],
  scannedAt: string,
): RemovalList {
  return {
    schemaVersion: 1,
    app: "botscraper",
    target: { id: target.id, username: target.username },
    scannedAt,
    bots: bots.map(b => ({
      id: b.id,
      username: b.username,
      full_name: b.full_name,
      score: b.score ?? 0,
      reasons: [...(b.reasons ?? [])],
    })),
  };
}

export function parseRemovalList(
  text: string,
): { ok: true; list: RemovalList } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "File non valido: JSON non leggibile." };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = raw as any;
  if (!o || typeof o !== "object") return { ok: false, error: "File non valido: oggetto atteso." };
  if (o.schemaVersion !== 1) return { ok: false, error: "Versione schema non supportata." };
  if (o.app !== "botscraper") return { ok: false, error: "File non riconosciuto (app)." };
  if (!o.target || typeof o.target.id !== "string" || typeof o.target.username !== "string") {
    return { ok: false, error: "File non valido: target mancante." };
  }
  if (!Array.isArray(o.bots)) return { ok: false, error: "File non valido: lista bot mancante." };
  const botsOk = o.bots.every(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b: any) => b && typeof b.id === "string" && typeof b.username === "string",
  );
  if (!botsOk) return { ok: false, error: "File non valido: bot senza id/username." };
  return { ok: true, list: o as RemovalList };
}

export function bindCheck(
  list: RemovalList,
  dsUserId: string | null,
): { ok: true } | { ok: false; error: string } {
  if (dsUserId !== null && dsUserId === list.target.id) {
    return { ok: true };
  }
  return {
    ok: false,
    error:
      `Questa lista è stata generata per @${list.target.username} (id ${list.target.id}). ` +
      `Sei loggato come id ${dsUserId ?? "sconosciuto"}. Accedi all'account corretto prima di importare.`,
  };
}

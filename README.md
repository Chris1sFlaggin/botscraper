# BotScraper

Fork di [davidarroyo1234/InstagramUnfollowers](https://github.com/davidarroyo1234/InstagramUnfollowers)
che estende il tool originale da "chi non ti segue indietro" a una **suite di analisi e pulizia
follower/commenti** per account che gestisci.

Come l'originale, gira interamente nel browser: incolli lo script nella console di
instagram.com loggato, usa la sessione corrente e **nessun dato esce dal tuo PC**.

> ⚠️ Da usare **solo** su account che gestisci con autorizzazione.

---

## Cosa aggiunge rispetto a upstream

Upstream risponde a una domanda sola: chi non ti segue indietro. BotScraper aggiunge:

- **Bot-score 0–100** su ogni follower, dai dati base (username, nome, foto, privato),
  con esclusione automatica di verificati e mutual.
- **Deep-scan** opzionale sui soli candidati sospetti: rapporto follower/following,
  numero di post, account recente (`is_joined_recently`), bio.
- **Rimozione bulk** dei bot via `remove_follower`, con delay anti-block.
- **Scraping e scoring dei commenti** su tutti i post di un account, con eliminazione
  e azioni opzionali sull'autore (restrict/block/remove).
- **Monitor read-only**: ricerca lead e monitoraggio clienti, con tabella HOT/WARM/COLD.
- **Account health report**: health score, stima follower bot, risk flag e azione consigliata.
- **Liste di rimozione** importabili/esportabili, con re-verifica live.

## I tre tool

| Tool | Entry point | Bundle | Guida |
|---|---|---|---|
| Follower / bot cleanup | `src/main.tsx` | `dist/dist.js` | [USAGE_BOTSCRAPER.md](USAGE_BOTSCRAPER.md) |
| Commenti | `src/main-comments.tsx` | `dist/comments.js` | [USAGE_COMMENTS.md](USAGE_COMMENTS.md) |
| Monitor / lead (read-only) | `src/main-monitor.tsx` | `dist/monitor.js` | [USAGE_MONITOR.md](USAGE_MONITOR.md) |

Ogni guida parte con un **pre-flight degli endpoint**: Instagram cambia spesso le API,
verifica sempre che rispondano prima di usare il tool.

## Sviluppo

- Node 16.14.0 (`nvm use`)
- `npm run build` — compila i tre bundle e aggiorna gli HTML in `public/`
- `npm test` — vitest

## Sincronizzare con upstream

Il repo è agganciato all'originale, quindi gli aggiornamenti si tirano normalmente:

```sh
git fetch upstream
git merge upstream/master
```

Il punto di stacco è il commit upstream `1b840ec` (7 giugno 2026); la parentela è stata
stabilita con un merge una-tantum, dato che la storia locale era nata da uno snapshot
squashato senza antenato comune.

## Licenza e crediti

Basato su [InstagramUnfollowers](https://github.com/davidarroyo1234/InstagramUnfollowers)
di **David Arroyo**, distribuito con licenza MIT. Il copyright originale è mantenuto
in [LICENSE](LICENSE); questo fork resta sotto la stessa licenza MIT.

**Disclaimer:** questo strumento non è affiliato, associato, autorizzato o approvato da
Instagram, né ufficialmente collegato a Instagram. Usalo a tuo rischio.

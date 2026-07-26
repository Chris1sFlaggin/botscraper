# BotScraper

Fork di [davidarroyo1234/InstagramUnfollowers](https://github.com/davidarroyo1234/InstagramUnfollowers)
che estende il tool originale da "chi non ti segue indietro" a una **suite di analisi e pulizia
follower/commenti** per account che gestisci.

Come l'originale, gira interamente nel browser: incolli lo script nella console di
instagram.com loggato, usa la sessione corrente e **nessun dato esce dal tuo PC**.
Niente da installare, niente server intermedi.

> ⚠️ Da usare **solo** su account che gestisci con autorizzazione. Rimuovere follower
> e cancellare commenti sono azioni irreversibili.

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

| Tool | Cosa fa | Entry point | Bundle |
|---|---|---|---|
| **Bot scanner** | Analizza i follower, assegna il bot-score, rimuove in blocco | `src/main.tsx` | `dist/dist.js` |
| **Commenti** | Punteggio bot/spam sui commenti di tutti i post, poi elimina | `src/main-comments.tsx` | `dist/comments.js` |
| **Monitor** | Lead e monitoraggio account nel tempo — **sola lettura** | `src/main-monitor.tsx` | `dist/monitor.js` |

Solo il Monitor non esegue nessuna azione su Instagram: gli altri due agiscono
sull'account, quindi vanno usati loggati **come** il titolare.

## Come si usa

Il codice pronto da incollare sta su **<https://chris1sflaggin.it/botscraper/>**:
scegli il tool e premi *Copia il codice*.

![Come copiare il codice dalla pagina](assets/copia-codice.png)

Poi:

1. Apri **instagram.com** ed entra con l'account da analizzare.
2. Apri la console del browser — `Ctrl + Shift + J` su Windows e Linux, `⌘ + ⌥ + I` su macOS.
3. Incolla il codice e premi Invio. Se Chrome chiede di scrivere `allow pasting`, fallo:
   è una sua protezione, va scritto una volta sola.
4. Compare l'interfaccia sopra Instagram: premi **RUN** e aspetta la scansione.

In alternativa puoi compilare tu i bundle con `npm run build` e incollare il contenuto
di `dist/`.

### Prima di iniziare

Instagram cambia spesso le proprie API interne, e quando succede il tool smette di
funzionare finché non viene aggiornato. Il controllo che ti dice subito se puoi
procedere è nella pagina qui sopra: dura due secondi, fallo sempre.

## Come funziona il bot-score

Il punteggio è una **stima basata su segnali pubblici, non una sentenza**. La revisione
manuale prima di rimuovere è parte del flusso, non un optional:

1. **Scan** — punteggio a tutti i follower dai dati che arrivano già con la lista.
2. **Deep-scan** — solo i candidati sopra soglia vengono approfonditi scaricandone il
   profilo, così le richieste restano poche e il rate-limit non si arrabbia.
3. **Revisione** — lista ordinata per punteggio, sposti la soglia, controlli e metti in
   whitelist i falsi positivi. La whitelist persiste tra le sessioni.
4. **Rimozione** — in blocco, con pause tra le azioni.

Account nuovi, senza foto o con pochi post non sono automaticamente bot: sono solo
i segnali più comuni tra i bot.

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

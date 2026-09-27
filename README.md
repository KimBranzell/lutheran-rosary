# Luthers Rosenkrans

En svensk, offline-först PWA för att be den lutherska rosenkransen. Byggd med
vanilla JavaScript, Webpack 5 och Workbox. Installerbar på telefon och fungerar
helt offline efter första laddningen – inga analyser, inga konton, inga anrop
till tredje part vid körtid.

## Innehåll

- **86 steg**: korsets tecken, trosbekännelsen, Fader Vår, tre inledande pärlor,
  fem hemligheter med bibeltext, därefter Magnificat, Ave Maria och korsets tecken.
- **Fyra hemlighetsserier** (glädjefylld, lysande, sorgfull, härlig) med
  veckodagsstyrning; dagens serie är förvald och går att byta.
- **Två böner på pärlorna**: Martin Luthers Ave Maria eller Jesusbönen.
- **Rosenkransen som bild**: en fullständig krans med kors, emblem, fem
  årtionden och markering av aktuell pärla.
- **Liturgisk färgsättning** efter Svenska kyrkans kyrkoår, med kyrkoårstid och
  dagens namn i sidhuvudet.
- **Påminnelser** via lokala aviseringar (bästa ansträngning – se nedan).
- **WCAG 2.2 AA**: tangentbord, skärmläsare, kontrast i alla tema, reducerad rörelse.

## Skaffa bibeltexten (krävs för att bygga)

Bibeltexten ingår **inte** i det här repot. Appen läser utvalda verser ur
**Svenska Kärnbibeln** i Digital Bible Library-formatet USX 3.0. Den texten är
licensierad separat (CC BY-NC-SA, icke-kommersiell) och måste hämtas av den som
bygger. Koden som extraherar och hanterar texterna finns i repot:
`scripts/extract-scriptures.mjs` och `src/data/scripture-references.js`.

1. Skaffa USX-paketet för Svenska Kärnbibeln (t.ex. via Digital Bible Library
   eller förlaget).
2. Lägg filerna så här:
   ```
   resources/SKB/metadata.xml
   resources/SKB/release/USX_1/GEN.usx
   resources/SKB/release/USX_1/EXO.usx
   ...            (66 böcker, en fil per bok)
   ```
3. `npm run build` kör automatiskt `npm run extract:scriptures`, som plockar ut
   bara de 20 avsnitt appen behöver till
   `src/data/generated/scripture-passages.json` (gitignorerad). Den fullständiga
   bibeln buntas aldrig med i appen.

Saknas `resources/SKB/` avbryter bygget med ett förklarande felmeddelande.

Bibeltexten bevaras ordagrant. Förklarande tillägg, korsreferenser och
alternativa formuleringar inom hakparenteser eller parenteser tas bort vid
extraktionen, och endast de konfigurerade versavsnitten läses in.

## Kom igång

```bash
npm ci                 # kräver Node 24 (se .nvmrc)
npm run dev            # utvecklingsserver på :8080
npm run build          # produktionsbygge till dist/
```

### Testning

```bash
npm run test:unit      # enhetstester (node --test)
npx playwright install chromium
npm run test:e2e       # Playwright, inkl. axe-skanner
npm run test:a11y      # endast tillgänglighetstesterna
npm run check          # enhetstester + produktionsbygge
```

### Övriga skript

```bash
npm run extract:scriptures   # generera src/data/generated/scripture-passages.json
npm run icons                # generera public/icons/*.png på nytt
```

## Publicering

`dist/` är statiska filer och kan läggas i vilken webbrot som helst. Tre saker
måste stämma:

1. **HTTPS.** Utan säker kontext registreras ingen service worker, och då
   fungerar varken offline eller installation. En IP-adress över `http://` duger
   alltså inte.
2. **Domänroten.** `start_url`, `scope` och ikonvägarna är root-relativa (`/…`),
   så appen måste ligga i roten – inte i en underkatalog. Ska den ligga i en
   underkatalog måste `output.publicPath` i `webpack.config.cjs`, manifestets
   `start_url`/`scope` och ikonvägarna ändras tillsammans.
3. **`service-worker.js` får aldrig cachas länge** – sätt `Cache-Control:
   no-cache`. Annars upptäcker webbläsaren inte nya versioner av appen.

Dessutom bör `.webmanifest` serveras som `application/manifest+json` och
`.woff2` som `font/woff2`. Efter uppladdning, kontrollera:

```bash
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" https://din-domän.se/manifest.webmanifest
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" https://din-domän.se/service-worker.js
curl -sSI https://din-domän.se/service-worker.js | grep -i cache-control
```

Första gången appen öppnas måste den vara online, så att service workern hinner
installera offlinecachen. Därefter fungerar den utan nät.

### Android-APK (valfritt)

```bash
PWA_ORIGIN=https://din-domän.se ./scripts/init-twa.sh
PWA_ORIGIN=https://din-domän.se ./scripts/build-apk.sh
```
Kräver JDK 17 och Android SDK. APK:n är ett tunt skal (Bubblewrap TWA) runt den
publicerade webbappen – den innehåller inte appens filer.

## Arkitektur

- **Vanilla JavaScript ES-moduler**, semantisk HTML och SCSS via Webpack 5.
- `src/prayer/` bygger den platta stegsekvensen; `src/calendar/` räknar ut
  kyrkoårets dagar (datumaritmetik utan tidszoner); `src/ui/` renderar vyerna.
- **Workbox InjectManifest** precachar appskalet, typsnitten, ikonerna och den
  genererade bibeltexten så att allt fungerar offline.
- **Lokala typsnitt**: Fraunces och Alegreya Sans (SIL Open Font License).

## Tillgänglighet

Appen följer WCAG 2.2 AA: semantisk struktur, tangentbordsnavigering, synlig
fokusmarkering, 44 px minsta tryckyta, statusmeddelanden via `aria-live`,
kontrastkontrollerade liturgiska färger i ljust och mörkt läge, stöd för
`prefers-reduced-motion` och `forced-colors`. Liturgisk färg är aldrig enda
sättet att visa en kyrkoårstid – namnet står alltid i klartext.

## Påminnelser

Påminnelser är **bästa ansträngning**. Appen kan schemalägga medan den är öppen
och kontrollera missade tillfällen när den startas igen. Är appen stängd eller
avstängd av systemet kan aviseringen utebli eller komma sent. Det står också i
gränssnittet. Ingen server, ingen push, inga native Android-larm.

## Licens

- **Appkoden**: MIT, se [LICENSE](LICENSE).
- **Bibeltexten** (Svenska Kärnbibeln): CC BY-NC-SA. Ingår inte i repot.
- **Typsnitt**: Fraunces och Alegreya Sans, SIL Open Font License 1.1
  (licenstexterna ligger i `public/fonts/`).

## Sekretess

- Inga analyser eller spårning.
- Inga tredjepartsförfrågningar vid körtid.
- All data (inställningar, påminnelser) stannar lokalt i `localStorage`.
- Aviseringar begärs bara efter att du tryckt på knappen, och kräver ditt tillstånd.

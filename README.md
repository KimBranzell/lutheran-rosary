# Luthers Rosenkrans

En svensk, offline-först PWA för att be den lutherska versionen av den romersk-katolska rosenkransen. Byggd med
vanilla JavaScript, Webpack 5 och Workbox. Installerbar på telefon och fungerar
helt offline efter första laddningen – inga analyser, inga konton, inga anrop
till tredje part vid körtid.

## Innehåll

- **86 steg**: korsets tecken, trosbekännelsen, Fader Vår, tre inledande pärlor,
  fem mysterier med bibeltext, därefter Magnificat, Ave Maria och korsets tecken.
- **Fyra mysterier** (glädjerika, ljusets, smärtorika, ärorika) med
  veckodagsstyrning; dagens serie är förvald och går att byta.
- **Två böner på pärlorna**: Martin Luthers Ave Maria eller Jesusbönen.
- **Rosenkransen som bild**: en fullständig krans med kors, emblem, fem
  årtionden och markering av aktuell pärla.
- **Liturgisk färgsättning** efter Svenska kyrkans kyrkoår, med kyrkoårstid och
  dagens namn i sidhuvudet.
- **Påminnelser** via lokala aviseringar (bästa ansträngning – se nedan).
- **Fortsätt där du slutade**: pågående session sparas lokalt och erbjuder
  "Fortsätt på steg N" – även efter en omladdning mitt i böneprocessen.
- **Navigering som i webbläsaren**: varje vy har sin egen `#`-adress (`/#prayer`,
  `/#settings`, `/#sources`), så Back-knappen lämnar böneprocessen i stället för
  att stänga appen, och länkar kan peka rakt på en vy.
- **Textstorlek** i tre steg (Normal / Stor / Mycket stor), ovanpå webbläsarens
  eller operativsystemets egen skalning.
- **Skärmen stannar vaken** medan en session pågår (Screen Wake Lock, där webbläsaren
  stöder det).
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

### CI och platshållartexten

Eftersom bibeltexten **inte** får ligga i repot kan en ren klon inte köra
extraheringen – och därmed inte bygga. För att ändå kunna köra testerna i CI finns
en syntetisk platshållare i `scripts/fixtures/scripture-passages.fixture.json`
samt ett alternativt grensnitt i `scripts/extract-scriptures.mjs`:

```bash
CI=true USE_SCRIPTURE_FIXTURE=1 npm run build
```

Tre saker att veta:

1. **Grenen avvisas om `CI=true` saknas.** Det ska vara omöjligt att råka bygga
   mot platshållaren – en riktig byggnad kräver `resources/SKB/`.
2. **Platshållartexten är inte bibeltext.** Den är uppdiktad och märkt som sådan.
3. **En platsbyggnad är aldrig publicerbar.** Repot har inget deploy-steg, och
   `dist/` som byggs i CI används enbart för att köra Playwright-testerna.

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
npm run lint           # ESLint (flat config, eslint:recommended)
npm run check          # lint + enhetstester + produktionsbygge
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

Varje avisering har två knappar: **Be rosenkransen**, som öppnar appen direkt i
böneprocessen, och **Påminn senare**, som upprepar påminnelsen efter 10 minuter.

Kända begränsningar, i samma anda som "bästa ansträngning" ovan:

- **Safari visar inte knapparna alls** (varken macOS eller iOS) – webbläsaren
  saknar stöd för `actions`. Att trycka på själva aviseringen fungerar ändå på
  macOS.
- **På iOS öppnar inte en tryckt avisering appen.** iOS stöder inte händelsen
  `notificationclick` i webbappar, så varken knappar eller tryck kan kopplas till
  en åtgärd. Appen schemalägger och visar alltså aviseringar, men själva
  tryckhanteringen saknas.
- **"Påminn senare" kräver att appen är öppen.** En service worker kan inte hålla
  en lång timer tillförlitligt, så fördröjningen schemaläggs i det öppna
  fönstret. Är appen stängd gör knappen ingenting.

## Beroenden och säkerhetsaviseringar

Appen har inga produktionsberoenden i npm – allt i `package.json` är
utvecklingsverktyg.

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

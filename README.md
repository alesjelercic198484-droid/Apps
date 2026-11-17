# SloPromet GPS — Slovenske prometne kamere v živo & avto GPS

Full-stack aplikacija za voznike v Sloveniji: **vpogled v vse slovenske prometne kamere v živo** (DARS / DRSI prek portala promet.si), **delujoč GPS merilnik hitrosti**, **interaktivni zemljevid Slovenije**, **razmere na cestah** ter **poročanje v realnem času** o policiji / policijskih kontrolah, prometnih nesrečah in zastojih.

## Funkcije

- **Kamere v živo** — 53 uradnih kamer (DARS + DRSI), posnetki se osvežijo vsako minuto, iskanje + filter po regiji/cesti, priljubljene kamere, podrobnosti (hitrost, promet, vozišče, temperatura), dodajanje/urejanje/brisanje lastnih kamer.
- **GPS merilnik hitrosti** — pravi GPS prek Geolocation API (hitrost, smer, koordinate, natančnost), zvočno opozorilo pri prekoračitvi, demo vožnja po A1, če GPS ni na voljo.
- **Interaktivni zemljevid** — Leaflet + OpenStreetMap, markerji kamer in dogodkov, vaša GPS lokacija, letenje do izbrane kamere.
- **Poročanje dogodkov (CRUD)** — policija, nesreče, zastoji, dela na cesti, nevarnosti; potrjevanje/oviranje glasov, označevanje razrešenih, urejanje in brisanje lastnih poročil.
- **Razmere na cestah (CRUD)** — 12 koridorjev (A1, A2, A4, A5, H3, H4, G2, G9, G11 …) s hitrostjo, gostoto, zamudo, vremenom.
- **Moje poti (CRUD)** — shranjene relacije s prednastavitvami (Ljubljana → Maribor, Koper, Bled …), obvestila o policiji/nesrečah/zastojih, pripenjanje.
- **Avtentikacija** — registracija, prijava, odjava, demo uporabnik (`demo@slopromet.si` / `demo1234`), nastavitve vozila in tolerance.
- **V živo** — SSE pretok za takojšnje posodobitve (novi dogodki, spremembe kamer in odsekov), optimistične posodobitve, toast obvestila, prazna in nalagalna stanja, odziven dizajn s stransko navigacijo.

## Zagon

```bash
npm install
npm run dev      # razvojni strežnik na http://localhost:3000
```

Produkcija:

```bash
npm run build
npm start        # streže zgrajen frontend + API na http://localhost:3000
```

## Android APK

Android različica uporablja Capacitor in ima **samostojni način**: demo račun, kamere, dogodki, odseki, poti in vse CRUD spremembe se shranjujejo lokalno v telefonu. Za slike kamer in OpenStreetMap je še vedno potrebna internetna povezava, GPS pa uporablja izvorni Android vtičnik.

```bash
VITE_STANDALONE=true npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

GitHub Actions workflow `.github/workflows/build-apk.yml` samodejno preveri tipe in lokalni podatkovni sloj, zgradi, podpiše ter preveri APK. Demo uporabnik je v mobilnem testnem APK-ju ob prvem zagonu že prijavljen; po odjavi se lahko znova prijavite z `demo@slopromet.si` / `demo1234`.

## Tehnologije

- **Backend:** Node.js + Express + SQLite (`node:sqlite`, WAL), JWT v httpOnly piškotku, bcrypt, Zod validacija, SSE.
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4, Leaflet, Lucide ikone.
- **Podatki:** uradni posnetki DARS / DRSI prek promet.si (avtorske pravice: promet.si), zemljevid OpenStreetMap.

Baza se ustvari samodejno v `data/slopromet.db` in se napolni z realističnimi demo podatki ob prvem zagonu.

# Envinova Doklady

Kompletný systém na generovanie a ukladanie **faktúr, cenových ponúk a objednávok**
(inšpirované [flowii.com](https://www.flowii.com)). Beží ako statická webová aplikácia
bez backendu – všetky údaje sú uložené v prehliadači (localStorage).

## Funkcie

- **Prehľad (dashboard)** – fakturované sumy za rok, neuhradené a po splatnosti,
  otvorené ponuky a nevybavené objednávky, graf fakturácie za 6 mesiacov,
  naposledy upravené doklady.
- **Tri typy dokladov** – faktúra (s DPH, bez DPH, zálohová, proforma),
  cenová ponuka, objednávka. Každý typ má vlastný číselný rad a stavy
  (koncept / odoslaná / zaplatená / stornovaná, resp. prijatá / odmietnutá,
  potvrdená / vybavená / zrušená). Faktúry po splatnosti a expirované ponuky sa
  označujú automaticky.
- **Prevod dokladov** – z cenovej ponuky vytvoríte objednávku alebo faktúru
  jedným klikom, z objednávky faktúru; pôvodný doklad zostáva prepojený.
- **Zoznamy s filtrami** – fulltextové hľadanie, filter stavu a dátumu,
  zoraďovanie, súčet zobrazených dokladov, export do CSV.
- **Kontakty** – adresár odberateľov s počtom dokladov a obratom, predvyplnenie
  do dokladu.
- **Cenník položiek** – opakujúce sa produkty/služby vložíte do dokladu z ponuky.
- **Nastavenia** – údaje dodávateľa, banka, logo, farba dokladov, predvolená DPH,
  splatnosť, platnosť ponuky, zaokrúhľovanie a vzory číselných radov
  (`{YYYY}`, `{YY}`, `{MM}`, `{NNNN}`).
- **PDF** – doklad sa vygeneruje do PDF vrátane rozpisu DPH, zľavy,
  zaokrúhlenia, loga a platobných údajov. Diakritika je riešená načítaním
  Unicode fontu (pri offline použití sa nahradí bez diakritiky).
- **Záloha údajov** – export/import celej databázy do JSON, prípadne vymazanie údajov.

## Spustenie

Stačí otvoriť `index.html` v prehliadači, alebo spustiť ľubovoľný statický server:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Štruktúra

| Súbor | Účel |
| --- | --- |
| `index.html` | shell aplikácie (menu, editor dokladu, modálne okná) |
| `css/app.css` | štýly aplikácie (sidebar, zoznamy, prehľad) |
| `style.css` | štýly formulárov, tabuliek položiek a náhľadu |
| `js/store.js` | ukladanie dokladov, kontaktov, cenníka a nastavení (localStorage) |
| `js/calc.js` | výpočty DPH, zľavy, zaokrúhlenia a formátovanie |
| `js/pdf.js` | generovanie PDF dokladov |
| `js/editor.js` | editor dokladu |
| `js/views.js` | prehľad, zoznamy, kontakty, cenník, nastavenia |
| `js/app.js` | router a obsluha akcií |

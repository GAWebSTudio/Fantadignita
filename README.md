# Fantadignità PWA

PWA React + Vite collegata a Supabase.

## Avvio locale

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Supabase

1. Apri Supabase > SQL Editor.
2. Incolla ed esegui tutto il file `schema.sql`.
3. Verifica che `.env.local` contenga:

```env
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
VITE_ADMIN_PIN=0000
```

`VITE_ADMIN_PIN` è opzionale. Se manca, il PIN Redazione resta `0000`.

## Funzioni collegate al database

- Creazione profilo giocatore su tabella `players`.
- Lista prove da tabella `game_events`.
- Invio prove su tabella `submissions`.
- Approvazione/rifiuto Redazione su Supabase.
- Feed approvati live.
- Reazioni feed su tabella `feed_reactions`.
- Classifica calcolata dalle prove approvate.
- Realtime su `players`, `submissions`, `feed_reactions`.

## Vercel

Imposta le stesse variabili in Project Settings > Environment Variables:

```env
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_ADMIN_PIN
```

Poi deploy normale da GitHub/Vercel.

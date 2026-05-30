# Fantadignità PWA

MVP React + TypeScript + Vite.

## Avvio locale
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Deploy consigliato
Vercel.

## Note
- Intro video: `public/intro/intro.mp4`
- Logo: `public/icons/logo.png`
- PIN demo Redazione: `0000`
- Dati salvati in localStorage per MVP/demo.
- Step successivo: collegamento Supabase per utenti, prove, approvazioni, feed e notifiche push reali.

---

## Supabase

Il progetto è già configurato in `.env.local`.

### Avvio locale

```bash
npm install
npm run dev
```

### Database

1. Vai su Supabase → SQL Editor.
2. Apri il file `schema.sql`.
3. Incolla tutto.
4. Premi `Run`.

### Note

- `package-lock.json` è stato rimosso se conteneva registry interni non raggiungibili.
- Il client Supabase è in `src/lib/supabase.ts`.

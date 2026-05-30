import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Plus, Crown, ScrollText, User, ShieldCheck, Flame, Bell, Heart, MessageCircle, Send, X, Check, Camera, Upload, RotateCcw } from 'lucide-react';
import './styles.css';

type Player = { id: string; nickname: string; avatarUrl?: string; createdAt: string };
type EventDef = { id: string; title: string; points: number | null; category: 'Consumazioni' | 'Eventi speciali' | 'Eventi leggendari' | 'Malus'; legendary?: boolean; description?: string };
type Submission = { id: string; playerId: string; eventId: string; note?: string; status: 'pending' | 'approved' | 'rejected'; pointsAwarded: number; createdAt: string; approvedAt?: string; reactions: string[]; comments: string[] };

const PLAYER_KEY = 'fantadignita_player';
const SUBMISSIONS_KEY = 'fantadignita_submissions';
const ADMIN_PIN = '0000';

const events: EventDef[] = [
  { id: 'cocktail', title: 'Cocktail', points: 5, category: 'Consumazioni' },
  { id: 'shot', title: 'Shot', points: 2, category: 'Consumazioni' },
  { id: 'tequila', title: 'Tequila', points: 3, category: 'Consumazioni' },
  { id: 'calice', title: 'Calice', points: 3, category: 'Consumazioni' },
  { id: 'birra', title: 'Birra', points: 3, category: 'Consumazioni' },
  { id: 'ombrello', title: "Perdere l'ombrello", points: 40, category: 'Eventi speciali' },
  { id: 'bagno', title: 'Bagno senza costume', points: 25, category: 'Eventi speciali' },
  { id: 'banco-ketty', title: 'Salire sul banco del Ketty', points: 15, category: 'Eventi speciali' },
  { id: 'tamponamento', title: 'Tamponamento', points: 50, category: 'Eventi speciali' },
  { id: 'posto-blocco', title: 'Posto di blocco', points: 30, category: 'Eventi speciali' },
  { id: 'ritiro-patente', title: 'Ritiro patente per tasso alcolemico elevato', points: null, category: 'Eventi leggendari', legendary: true, description: 'Vittoria a tavolino' },
  { id: 'bacio-andrea', title: 'Bacio con Andrea Ketty', points: 30, category: 'Eventi speciali' },
  { id: 'vomito-appartato', title: 'Vomito alcolico appartato', points: 15, category: 'Eventi speciali' },
  { id: 'vomito-pubblico', title: 'Vomito alcolico in pubblico davanti a 2 o più estranei', points: 30, category: 'Eventi speciali' },
  { id: 'caduta', title: 'Caduta alcolica', points: 10, category: 'Eventi speciali' },
  { id: 'sonno-ketty', title: 'Addormentarsi al Ketty', points: 10, category: 'Eventi speciali' },
  { id: 'sonno-locale', title: 'Addormentarsi al locale (no Ketty)', points: 5, category: 'Eventi speciali' },
  { id: 'ztl', title: 'Passare dalla ZTL attiva', points: 38, category: 'Eventi speciali' },
  { id: 'barista-ketty', title: 'Fare il barista al Ketty', points: 15, category: 'Eventi speciali' },
  { id: 'morte', title: 'Morte', points: 5, category: 'Eventi leggendari', legendary: true, description: 'Funerale a carico dei partecipanti' },
  { id: 'sobrio', title: 'Sobrietà del sabato sera', points: -5, category: 'Malus' }
];

const demoPlayers: Player[] = [
  { id: 'demo-andrea', nickname: 'Andrea Ketty', avatarUrl: '/icons/logo.png', createdAt: new Date().toISOString() },
  { id: 'demo-redazione', nickname: 'La Redazione', avatarUrl: '/icons/logo.png', createdAt: new Date().toISOString() }
];

function uid() { return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; }
function read<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; } }
function write<T>(key: string, value: T) { localStorage.setItem(key, JSON.stringify(value)); }
function compressImage(file: File, maxSize = 512, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = String(reader.result); };
    reader.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas non disponibile'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    reader.readAsDataURL(file);
  });
}

function App() {
  const [introDone, setIntroDone] = useState(false);
  const [player, setPlayer] = useState<Player | null>(() => read<Player | null>(PLAYER_KEY, null));
  const [submissions, setSubmissions] = useState<Submission[]>(() => read<Submission[]>(SUBMISSIONS_KEY, []));
  const [tab, setTab] = useState<'home' | 'submit' | 'feed' | 'leaderboard' | 'rules' | 'admin' | 'profile'>('home');
  const players = useMemo(() => player ? [player, ...demoPlayers] : demoPlayers, [player]);

  const saveSubmissions = (next: Submission[]) => { setSubmissions(next); write(SUBMISSIONS_KEY, next); };

  return (
    <div className="app-shell">
      <AnimatePresence>{!introDone && <Intro onDone={() => setIntroDone(true)} />}</AnimatePresence>
      {introDone && !player && <Onboarding onDone={(p) => { setPlayer(p); write(PLAYER_KEY, p); }} />}
      {introDone && player && (
        <MainApp player={player} players={players} submissions={submissions} saveSubmissions={saveSubmissions} tab={tab} setTab={setTab} setPlayer={setPlayer} />
      )}
    </div>
  );
}

function Intro({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const enableAudio = async () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = false;
    video.volume = 1;
    setAudioEnabled(true);

    try {
      await video.play();
    } catch {
      // Alcuni browser richiedono un secondo tap se il sistema blocca l'audio.
      setAudioEnabled(false);
    }
  };

  return (
    <motion.div className="intro" exit={{ opacity: 0 }} transition={{ duration: .55 }}>
      <video
        ref={videoRef}
        className="intro-video"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={onDone}
      >
        <source src="/intro/intro.mp4" type="video/mp4" />
      </video>

      <div className="intro-actions">
        {!audioEnabled && (
          <button className="audio-button" onClick={enableAudio}>
            ATTIVA AUDIO
          </button>
        )}
        <button className="skip" onClick={onDone}>SKIP →</button>
      </div>
    </motion.div>
  );
}

function Onboarding({ onDone }: { onDone: (p: Player) => void }) {
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<string>('/icons/logo.png');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    try { setAvatar(await compressImage(file)); } finally { setLoading(false); }
  };
  return <div className="screen onboarding">
    <img src="/icons/logo.png" className="onboard-logo" />
    <h1>Entra nel Fantadignità</h1>
    <p className="muted">Una sola lega ufficiale. Una sola Redazione. Dignità non garantita.</p>
    <button className="avatar-pick" onClick={() => inputRef.current?.click()}>
      <img src={avatar} />
      <span><Upload size={16}/> {loading ? 'Compressione...' : 'Carica foto profilo'}</span>
    </button>
    <input ref={inputRef} hidden type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} />
    <input className="text-input" placeholder="Nickname ufficiale" value={nickname} onChange={(e) => setNickname(e.target.value)} />
    <button className="primary" disabled={nickname.trim().length < 2} onClick={() => onDone({ id: uid(), nickname: nickname.trim(), avatarUrl: avatar, createdAt: new Date().toISOString() })}>ENTRA NELLA LEGA</button>
  </div>;
}

function MainApp(props: { player: Player; players: Player[]; submissions: Submission[]; saveSubmissions: (s: Submission[]) => void; tab: string; setTab: (t: any) => void; setPlayer: (p: Player|null)=>void }) {
  const { player, players, submissions, saveSubmissions, tab, setTab } = props;
  const approved = submissions.filter(s => s.status === 'approved');
  const points = approved.filter(s => s.playerId === player.id).reduce((a, s) => a + s.pointsAwarded, 0);
  const ranking = players.map(p => ({ player: p, points: approved.filter(s => s.playerId === p.id).reduce((a, s) => a + s.pointsAwarded, 0) })).sort((a,b)=>b.points-a.points);
  const position = ranking.findIndex(r => r.player.id === player.id) + 1;
  return <>
    <header className="topbar"><img src="/icons/logo.png"/><div><strong>Fantadignità</strong><span>Lega ufficiale 2026</span></div><button onClick={()=>setTab('profile')}><User size={18}/></button></header>
    <main className="content">
      {tab === 'home' && <Home player={player} points={points} position={position} ranking={ranking} submissions={submissions} setTab={setTab} />}
      {tab === 'submit' && <Submit player={player} submissions={submissions} saveSubmissions={saveSubmissions} />}
      {tab === 'feed' && <Feed submissions={submissions} players={players} saveSubmissions={saveSubmissions} />}
      {tab === 'leaderboard' && <Leaderboard ranking={ranking} />}
      {tab === 'rules' && <Rules />}
      {tab === 'admin' && <Admin submissions={submissions} players={players} saveSubmissions={saveSubmissions} />}
      {tab === 'profile' && <Profile player={player} points={points} submissions={submissions} reset={()=>{localStorage.clear(); location.reload();}} />}
    </main>
    <nav className="bottom-nav">
      <Nav icon={<Crown/>} label="Home" active={tab==='home'} onClick={()=>setTab('home')} />
      <Nav icon={<Plus/>} label="Prova" active={tab==='submit'} onClick={()=>setTab('submit')} />
      <Nav icon={<Flame/>} label="Feed" active={tab==='feed'} onClick={()=>setTab('feed')} />
      <Nav icon={<Trophy/>} label="Classifica" active={tab==='leaderboard'} onClick={()=>setTab('leaderboard')} />
      <Nav icon={<ShieldCheck/>} label="Redazione" active={tab==='admin'} onClick={()=>setTab('admin')} />
    </nav>
  </>;
}
function Nav({ icon, label, active, onClick }: any) { return <button className={active?'active':''} onClick={onClick}>{React.cloneElement(icon,{size:20})}<span>{label}</span></button> }

function Home({ player, points, position, ranking, submissions, setTab }: any) {
  const last = submissions.filter((s: Submission)=>s.status==='approved').at(-1);
  const ev = last ? events.find(e=>e.id===last.eventId) : null;
  return <section className="page"><div className="hero-card"><div className="eyebrow">Bentornato, {player.nickname}</div><h2>{points} pt</h2><p>#{position} nella classifica generale</p><button className="primary" onClick={()=>setTab('submit')}>REGISTRA PROVA</button></div>
  <div className="card"><h3>Ultimo scandalo approvato</h3>{ev ? <p><b>{ev.title}</b> <span className="gold">{last.pointsAwarded > 0 ? '+' : ''}{last.pointsAwarded}</span></p> : <p className="muted">La Redazione è in attesa del primo evento.</p>}</div>
  <div className="card"><h3>Classifica live</h3>{ranking.slice(0,10).map((r:any,i:number)=><div className="rank-row" key={r.player.id}><span>#{i+1}</span><img src={r.player.avatarUrl}/><b>{r.player.nickname}</b><em>{r.points} pt</em></div>)}</div></section>
}
function Submit({ player, submissions, saveSubmissions }: any) {
  const [eventId,setEventId]=useState(events[0].id); const [note,setNote]=useState(''); const [sent,setSent]=useState(false);
  const ev=events.find(e=>e.id===eventId)!;
  const submit=()=>{ const s:Submission={id:uid(),playerId:player.id,eventId,note,status:'pending',pointsAwarded:ev.points??9999,createdAt:new Date().toISOString(),reactions:[],comments:[]}; saveSubmissions([s,...submissions]); setSent(true); setNote(''); };
  return <section className="page"><h1>Registra prova</h1><p className="muted">Ci fidiamo. Ma decide sempre la Redazione.</p><div className="event-grid">{events.map(e=><button key={e.id} className={eventId===e.id?'selected':''} onClick={()=>setEventId(e.id)}><span>{e.title}</span><b>{e.points===null?e.description:`${e.points>0?'+':''}${e.points} pt`}</b></button>)}</div><textarea className="text-area" placeholder="Nota opzionale per la Redazione" value={note} onChange={e=>setNote(e.target.value)} /><button className="primary" onClick={submit}><Send size={18}/> INVIA ALLA REDAZIONE</button>{sent&&<p className="success">Prova inviata. In attesa di approvazione.</p>}</section>
}
function Feed({ submissions, players, saveSubmissions }: any) { const list=submissions.filter((s:Submission)=>s.status==='approved'); return <section className="page"><h1>Feed live</h1>{list.length===0&&<p className="muted">Nessun evento approvato.</p>}{list.map((s:Submission)=>{const p=players.find((x:Player)=>x.id===s.playerId);const e=events.find(x=>x.id===s.eventId); return <div className="feed-card" key={s.id}><img src={p?.avatarUrl}/><div><b>{p?.nickname}</b><p>ha completato: <strong>{e?.title}</strong> <span className="gold">{s.pointsAwarded>0?'+':''}{s.pointsAwarded}</span></p><small>{new Date(s.createdAt).toLocaleString('it-IT')}</small><div className="actions"><button onClick={()=>saveSubmissions(submissions.map((x:Submission)=>x.id===s.id?{...x,reactions:[...x.reactions,'🔥']}:x))}><Heart size={16}/> {s.reactions.length}</button><button><MessageCircle size={16}/> {s.comments.length}</button></div></div></div>})}</section> }
function Leaderboard({ ranking }: any) { return <section className="page"><h1>Classifica generale</h1><div className="card">{ranking.map((r:any,i:number)=><div className="rank-row big" key={r.player.id}><span>#{i+1}</span><img src={r.player.avatarUrl}/><b>{r.player.nickname}</b><em>{r.points} pt</em></div>)}</div></section> }
function Rules(){ const cats=[...new Set(events.map(e=>e.category))]; return <section className="page"><h1>Regolamento</h1><div className="card"><h3>Finestre valide</h3><p>Weekend: venerdì 18:00 → domenica 21:00.</p><p>Festivi e prefestivi: 18:00 → 24:00.</p><p className="gold">Ferragosto, 14 agosto: doppio punteggio.</p></div>{cats.map(c=><div className="card" key={c}><h3>{c}</h3>{events.filter(e=>e.category===c).map(e=><div className="rule-row" key={e.id}><span>{e.title}</span><b>{e.points===null?e.description:`${e.points>0?'+':''}${e.points}`}</b></div>)}</div>)}</section> }
function Admin({ submissions, players, saveSubmissions }: any){ const [pin,setPin]=useState(''); const [ok,setOk]=useState(false); if(!ok)return <section className="page"><h1>Redazione</h1><input className="text-input" placeholder="PIN Redazione" value={pin} onChange={e=>setPin(e.target.value)} type="password"/><button className="primary" onClick={()=>setOk(pin===ADMIN_PIN)}>ENTRA</button><p className="muted">PIN demo: 0000. Da cambiare quando colleghiamo Supabase.</p></section>; const pending=submissions.filter((s:Submission)=>s.status==='pending'); const upd=(id:string,status:'approved'|'rejected')=>saveSubmissions(submissions.map((s:Submission)=>s.id===id?{...s,status,approvedAt:new Date().toISOString()}:s)); return <section className="page"><h1>Pannello Redazione</h1>{pending.length===0&&<p className="muted">Nessuna prova in attesa.</p>}{pending.map((s:Submission)=>{const p=players.find((x:Player)=>x.id===s.playerId);const e=events.find(x=>x.id===s.eventId);return <div className="admin-card" key={s.id}><div><b>{p?.nickname}</b><p>{e?.title} <span className="gold">{s.pointsAwarded>0?'+':''}{s.pointsAwarded}</span></p>{s.note&&<small>{s.note}</small>}</div><button className="approve" onClick={()=>upd(s.id,'approved')}><Check/></button><button className="reject" onClick={()=>upd(s.id,'rejected')}><X/></button></div>})}</section> }
function Profile({player,points,submissions,reset}:any){return <section className="page"><h1>Profilo</h1><div className="profile-card"><img src={player.avatarUrl}/><h2>{player.nickname}</h2><p className="gold">{points} punti</p><small>{submissions.filter((s:Submission)=>s.playerId===player.id).length} prove inviate</small></div><button className="ghost" onClick={reset}><RotateCcw size={16}/> Reset demo locale</button></section>}

createRoot(document.getElementById('root')!).render(<App />);

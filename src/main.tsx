import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Plus, Crown, User, ShieldCheck, Flame, Heart, MessageCircle, Send, X, Check, Upload, RotateCcw, Wifi, WifiOff, Lock, LogIn, UserPlus, FileText, AlertTriangle, Eye, Gavel } from 'lucide-react';
import { supabase } from './lib/supabase';
import './styles.css';

type Player = { id: string; nickname: string; avatarUrl?: string; createdAt: string; totalPoints: number };
type EventDef = { id: string; title: string; points: number; category: string; legendary: boolean; description?: string | null };
type Submission = { id: string; playerId: string; reporterId: string | null; assignedToId: string | null; eventId: string; quantity: number; note?: string | null; status: 'pending' | 'approved' | 'rejected'; pointsAwarded: number; createdAt: string; approvedAt?: string | null; reactions: string[]; comments: string[] };
type VarReview = { id: string; submissionId: string; openedBy: string | null; reason: string | null; status: 'open' | 'confirmed' | 'cancelled'; officialNote: string | null; createdAt: string; resolvedAt: string | null };

type DbPlayer = { id: string; nickname: string; avatar_url: string | null; total_points: number | null; created_at: string };
type DbEvent = { id: string; title: string; points: number; category: string; is_legendary: boolean; special_effect: string | null };
type DbSubmission = { id: string; player_id: string; reported_by: string | null; assigned_to: string | null; event_id: string; quantity: number | null; note: string | null; status: 'pending' | 'approved' | 'rejected'; points_awarded: number | null; created_at: string; approved_at: string | null };
type DbReaction = { submission_id: string; emoji: string };
type DbVarReview = { id: string; submission_id: string; opened_by: string | null; reason: string | null; status: 'open' | 'confirmed' | 'cancelled'; official_note: string | null; created_at: string; resolved_at: string | null };

const PLAYER_KEY = 'fantadignita_player_id';
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '0000';
const DEFAULT_AVATAR = '/icons/logo.png';

function mapPlayer(p: DbPlayer): Player {
  return { id: p.id, nickname: p.nickname, avatarUrl: p.avatar_url || DEFAULT_AVATAR, totalPoints: p.total_points ?? 0, createdAt: p.created_at };
}

function mapEvent(e: DbEvent): EventDef {
  return { id: e.id, title: e.title, points: e.points, category: labelCategory(e.category), legendary: e.is_legendary, description: e.special_effect };
}

function mapSubmission(s: DbSubmission, reactions: DbReaction[] = []): Submission {
  const targetId = s.assigned_to || s.player_id;
  return {
    id: s.id,
    playerId: targetId,
    reporterId: s.reported_by || s.player_id,
    assignedToId: targetId,
    eventId: s.event_id,
    quantity: s.quantity ?? 1,
    note: s.note,
    status: s.status,
    pointsAwarded: s.points_awarded ?? 0,
    createdAt: s.created_at,
    approvedAt: s.approved_at,
    reactions: reactions.filter(r => r.submission_id === s.id).map(r => r.emoji),
    comments: []
  };
}

function mapVarReview(v: DbVarReview): VarReview {
  return {
    id: v.id,
    submissionId: v.submission_id,
    openedBy: v.opened_by,
    reason: v.reason,
    status: v.status,
    officialNote: v.official_note,
    createdAt: v.created_at,
    resolvedAt: v.resolved_at
  };
}

function labelCategory(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes('consum')) return 'Consumazioni';
  if (normalized.includes('leggend')) return 'Eventi leggendari';
  if (normalized.includes('malus')) return 'Malus';
  return 'Eventi speciali';
}

function readStoredPlayerId(): string | null {
  try { return localStorage.getItem(PLAYER_KEY); } catch { return null; }
}
function writeStoredPlayerId(id: string) { localStorage.setItem(PLAYER_KEY, id); }
function clearStoredPlayerId() { localStorage.removeItem(PLAYER_KEY); }

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

async function loadAll() {
  const [playersRes, eventsRes, submissionsRes, reactionsRes, varRes] = await Promise.all([
    supabase.from('players').select('id,nickname,avatar_url,total_points,created_at').order('total_points', { ascending: false }),
    supabase.from('game_events').select('id,title,points,category,is_legendary,special_effect').order('category', { ascending: true }),
    supabase.from('submissions').select('id,player_id,reported_by,assigned_to,event_id,quantity,note,status,points_awarded,created_at,approved_at').order('created_at', { ascending: false }),
    supabase.from('feed_reactions').select('submission_id,emoji'),
    supabase.from('var_reviews').select('id,submission_id,opened_by,reason,status,official_note,created_at,resolved_at').order('created_at', { ascending: false })
  ]);

  if (playersRes.error) throw playersRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (submissionsRes.error) throw submissionsRes.error;
  if (reactionsRes.error) throw reactionsRes.error;
  if (varRes.error) throw varRes.error;

  return {
    players: (playersRes.data || []).map(mapPlayer),
    events: (eventsRes.data || []).map(mapEvent),
    submissions: (submissionsRes.data || []).map(s => mapSubmission(s, reactionsRes.data || [])),
    varReviews: (varRes.data || []).map(mapVarReview)
  };
}

function App() {
  const [introDone, setIntroDone] = useState(false);
  const [player, setPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<EventDef[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [varReviews, setVarReviews] = useState<VarReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'home' | 'submit' | 'feed' | 'leaderboard' | 'rules' | 'admin' | 'profile'>('home');

  const refresh = async () => {
    setError(null);
    const data = await loadAll();
    setPlayers(data.players);
    setEvents(data.events);
    setSubmissions(data.submissions);
    setVarReviews(data.varReviews);
    const storedId = readStoredPlayerId();
    setPlayer(storedId ? data.players.find(p => p.id === storedId) || null : null);
  };

  useEffect(() => {
    refresh().catch(() => setError('Impossibile collegarsi a Supabase. Controlla variabili env e schema.sql.')).finally(() => setLoading(false));

    const channel = supabase
      .channel('fantadignita-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => refresh().catch(() => undefined))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => refresh().catch(() => undefined))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_reactions' }, () => refresh().catch(() => undefined))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'var_reviews' }, () => refresh().catch(() => undefined))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAuthSuccess = async (nextPlayer: Player) => {
    writeStoredPlayerId(nextPlayer.id);
    setPlayer(nextPlayer);
    setIntroDone(false);
    await refresh();
  };

  return (
    <div className="app-shell">
      {loading && <LoadingScreen />}
      {!loading && error && <ErrorScreen message={error} retry={() => refresh().catch(() => undefined)} />}
      {!loading && !error && !player && <AuthScreen onDone={handleAuthSuccess} refresh={refresh} />}
      {!loading && !error && player && (
        <>
          <AnimatePresence>{!introDone && <Intro onDone={() => setIntroDone(true)} />}</AnimatePresence>
          {introDone && <MainApp player={player} players={players} events={events} submissions={submissions} varReviews={varReviews} refresh={refresh} tab={tab} setTab={setTab} setPlayer={setPlayer} />}
        </>
      )}
    </div>
  );
}

function makeCaptcha() {
  const a = Math.floor(Math.random() * 8) + 2;
  const b = Math.floor(Math.random() * 8) + 2;
  return { label: `${a} + ${b}`, result: String(a + b) };
}


const SILLY_CONTRACT_TEXT = [
  'CONTRATTO UFFICIALE DI INGRESSO NEL FANTADIGNITÀ',
  'Io, concorrente dotato di nome utente e discutibile senso dell’onore, dichiaro di voler partecipare alla lega più inutile e solenne del pianeta.',
  'Accetto che ogni prova inviata venga giudicata dalla Redazione con severità, ironia, sospetto e una quantità variabile di cattiveria artistica.',
  'Accetto che i punti non rappresentino valore morale, valore economico, valore atletico o valore sociale, ma soltanto Fantadignità, che è molto peggio.',
  'Prometto di non prendermi troppo sul serio, salvo quando sarò primo in classifica: in quel caso potrò vantarmi con moderazione insopportabile.',
  'Dichiaro di sapere che la Redazione può approvare, rifiutare o ridere silenziosamente davanti alle mie prove.',
  'Accetto che gli screenshot, le note e le prove testuali siano trattate come reperti goliardici e non come documenti storici dell’umanità.',
  'Mi impegno a non piangere se una prova viene respinta, a non corrompere la Redazione con arancini freddi e a non invocare il VAR del Fantadignità.',
  'Accetto che il tasto Skip dell’intro non sia un segno di debolezza, ma una scelta legittima per chi ha cose poco dignitose da fare.',
  'Confermo di aver letto questo contratto stupidissimo fino in fondo, anche se il mio istinto mi suggeriva di premere subito Accetta.',
  'Firma morale: io, utente registrato, entro ufficialmente nella lega e mi assumo la responsabilità della mia futura perdita di dignità.'
];

function AuthScreen({ onDone, refresh }: { onDone: (p: Player) => void; refresh: () => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR);
  const [captcha, setCaptcha] = useState(makeCaptcha);
  const [captchaValue, setCaptchaValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [contractOpen, setContractOpen] = useState(false);
  const [contractRead, setContractRead] = useState(false);
  const contractRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetCaptcha = () => {
    setCaptcha(makeCaptcha());
    setCaptchaValue('');
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try { setAvatar(await compressImage(file)); } finally { setBusy(false); }
  };

  const validateBase = () => {
    const cleanName = nickname.trim();
    const cleanPassword = password.trim();
    setMessage(null);

    if (cleanName.length < 2) { setMessage('Inserisci un nome utente valido.'); return null; }
    if (cleanPassword.length < 4) { setMessage('La password deve avere almeno 4 caratteri.'); return null; }
    if (captchaValue.trim() !== captcha.result) {
      resetCaptcha();
      setMessage('Captcha errato. Riprova.');
      return null;
    }

    return { cleanName, cleanPassword };
  };

  const openContract = () => {
    const valid = validateBase();
    if (!valid) return;
    setContractRead(false);
    setContractOpen(true);
    setTimeout(() => { if (contractRef.current) contractRef.current.scrollTop = 0; }, 0);
  };

  const onContractScroll = () => {
    const el = contractRef.current;
    if (!el) return;
    const reachedBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    if (reachedBottom) setContractRead(true);
  };

  const completeAuth = async () => {
    const valid = validateBase();
    if (!valid) return;
    if (mode === 'register' && !contractRead) return setMessage('Devi leggere tutto il contratto prima di accettare.');

    setBusy(true);
    try {
      const rpcName = mode === 'register' ? 'register_player' : 'login_player';
      const payload = mode === 'register'
        ? { player_nickname: valid.cleanName, player_password: valid.cleanPassword, player_avatar_url: avatar, player_contract_version: 'contratto-stupidissimo-v1' }
        : { player_nickname: valid.cleanName, player_password: valid.cleanPassword };
      const { data, error } = await supabase.rpc(rpcName, payload);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.id) throw new Error('Credenziali non valide.');
      const nextPlayer = mapPlayer(row as DbPlayer);
      await refresh();
      await onDone(nextPlayer);
    } catch (err: any) {
      setMessage(err?.message || 'Accesso non riuscito.');
      resetCaptcha();
      setContractOpen(false);
      setContractRead(false);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (mode === 'register') return openContract();
    return completeAuth();
  };

  return <div className="screen onboarding auth-screen">
    <img src={DEFAULT_AVATAR} className="onboard-logo" />
    <div>
      <p className="eyebrow">Accesso obbligatorio</p>
      <h1>{mode === 'login' ? 'Entra nel Fantadignità' : 'Registrati alla lega'}</h1>
      <p className="muted">Dopo il click su Entra partirà l’intro con audio e potrai skippare quando vuoi.</p>
    </div>

    <div className="auth-toggle">
      <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setMessage(null); setContractOpen(false); setContractRead(false); }}>Login</button>
      <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setMessage(null); setContractOpen(false); setContractRead(false); }}>Registrazione</button>
    </div>

    {mode === 'register' && <>
      <button className="avatar-pick" onClick={() => inputRef.current?.click()}>
        <img src={avatar} />
        <span><Upload size={16}/> Carica foto profilo</span>
      </button>
      <input ref={inputRef} hidden type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} />
    </>}

    <label className="field-label">Nome utente</label>
    <input className="text-input" placeholder="Es. KettyLegend" value={nickname} onChange={(e) => setNickname(e.target.value)} autoComplete="username" />

    <label className="field-label">Password</label>
    <input className="text-input" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />

    <div className="captcha-box">
      <span>Captcha</span>
      <strong>{captcha.label} = ?</strong>
      <input className="text-input" inputMode="numeric" placeholder="Risultato" value={captchaValue} onChange={(e) => setCaptchaValue(e.target.value)} />
    </div>

    {message && <p className="form-error">{message}</p>}
    <button className="primary" disabled={busy} onClick={submit}>{mode === 'login' ? <LogIn size={18}/> : <FileText size={18}/>} {busy ? 'CONTROLLO...' : mode === 'register' ? 'LEGGI CONTRATTO' : 'ENTRA'}</button>

    {contractOpen && <div className="contract-panel">
      <div className="contract-head">
        <div><p className="eyebrow">Passaggio obbligatorio</p><h3>Contratto stupidissimo</h3></div>
        <button onClick={() => { setContractOpen(false); setContractRead(false); }}>×</button>
      </div>
      <div className="contract-scroll" ref={contractRef} onScroll={onContractScroll}>
        {SILLY_CONTRACT_TEXT.map((line, index) => index === 0 ? <h3 key={line}>{line}</h3> : <p key={line}>{line}</p>)}
        <p className="contract-end">Fine del documento. Ora puoi accettare senza disonorare il protocollo.</p>
      </div>
      {!contractRead && <p className="contract-warning">Scorri fino in fondo per sbloccare l’accettazione.</p>}
      <button className="primary" disabled={busy || !contractRead} onClick={completeAuth}><UserPlus size={18}/> ACCETTO ED ENTRO</button>
    </div>}

    <small className="muted">Il captcha è locale: serve a bloccare invii casuali, non sostituisce una protezione anti-bot professionale.</small>
  </div>;
}

function Intro({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    video.currentTime = 0;
    video.play().catch(() => {
      // Se il browser blocca comunque l'audio, il video resta visibile e l'utente può skippare.
    });
  }, []);

  return (
    <motion.div className="intro" exit={{ opacity: 0 }} transition={{ duration: .55 }}>
      <video ref={videoRef} className="intro-video" autoPlay playsInline preload="auto" onEnded={onDone}>
        <source src="/intro/intro.mp4" type="video/mp4" />
      </video>
      <button className="skip skip-fixed" onClick={onDone}>SKIP →</button>
    </motion.div>
  );
}

function LoadingScreen() {
  return <div className="screen onboarding"><Wifi size={42}/><h1>Collegamento alla lega</h1><p className="muted">Caricamento dati live da Supabase...</p></div>;
}

function ErrorScreen({ message, retry }: { message: string; retry: () => void }) {
  return <div className="screen onboarding"><WifiOff size={42}/><h1>Connessione non riuscita</h1><p className="muted">{message}</p><button className="primary" onClick={retry}>RIPROVA</button></div>;
}

function Onboarding({ onDone }: { onDone: (p: { nickname: string; avatarUrl: string }) => void }) {
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    try { setAvatar(await compressImage(file)); } finally { setLoading(false); }
  };
  return <div className="screen onboarding">
    <img src={DEFAULT_AVATAR} className="onboard-logo" />
    <h1>Entra nel Fantadignità</h1>
    <p className="muted">Profilo reale salvato su Supabase. La classifica sarà condivisa da tutti.</p>
    <button className="avatar-pick" onClick={() => inputRef.current?.click()}>
      <img src={avatar} />
      <span><Upload size={16}/> {loading ? 'Compressione...' : 'Carica foto profilo'}</span>
    </button>
    <input ref={inputRef} hidden type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} />
    <input className="text-input" placeholder="Nickname ufficiale" value={nickname} onChange={(e) => setNickname(e.target.value)} />
    <button className="primary" disabled={nickname.trim().length < 2 || loading} onClick={() => onDone({ nickname: nickname.trim(), avatarUrl: avatar })}>ENTRA NELLA LEGA</button>
  </div>;
}

function MainApp(props: { player: Player; players: Player[]; events: EventDef[]; submissions: Submission[]; varReviews: VarReview[]; refresh: () => Promise<void>; tab: string; setTab: (t: any) => void; setPlayer: (p: Player|null)=>void }) {
  const { player, players, events, submissions, varReviews, refresh, tab, setTab, setPlayer } = props;
  const approved = submissions.filter(s => s.status === 'approved');
  const points = approved.filter(s => s.playerId === player.id).reduce((a, s) => a + s.pointsAwarded, 0);
  const ranking = players.map(p => ({ player: p, points: approved.filter(s => s.playerId === p.id).reduce((a, s) => a + s.pointsAwarded, 0) })).sort((a,b)=>b.points-a.points);
  const position = ranking.findIndex(r => r.player.id === player.id) + 1;
  const reset = () => { clearStoredPlayerId(); setPlayer(null); };

  return <>
    <header className="topbar"><img src={DEFAULT_AVATAR}/><div><strong>Fantadignità</strong><span>Lega live Supabase</span></div><button onClick={()=>setTab('profile')}><User size={18}/></button></header>
    <main className="content">
      {tab === 'home' && <Home player={player} points={points} position={position} ranking={ranking} submissions={submissions} events={events} setTab={setTab} />}
      {tab === 'submit' && <Submit player={player} players={players} events={events} refresh={refresh} />}
      {tab === 'feed' && <Feed submissions={submissions} players={players} events={events} varReviews={varReviews} player={player} refresh={refresh} />}
      {tab === 'leaderboard' && <Leaderboard ranking={ranking} />}
      {tab === 'rules' && <Rules events={events} />}
      {tab === 'admin' && <Admin submissions={submissions} players={players} events={events} varReviews={varReviews} refresh={refresh} />}
      {tab === 'profile' && <Profile player={player} points={points} submissions={submissions} reset={reset} />}
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

function Nav({ icon, label, active, onClick }: any) { return <button className={active?'active':''} onClick={onClick}>{React.cloneElement(icon,{size:20})}<span>{label}</span></button>; }

function Home({ player, points, position, ranking, submissions, events, setTab }: any) {
  const last = submissions.filter((s: Submission)=>s.status==='approved')[0];
  const ev = last ? events.find((e: EventDef)=>e.id===last.eventId) : null;
  return <section className="page"><div className="hero-card"><div className="eyebrow">Bentornato, {player.nickname}</div><h2>{points} pt</h2><p>#{position || '-'} nella classifica generale</p><button className="primary" onClick={()=>setTab('submit')}>REGISTRA PROVA</button></div>
  <div className="card"><h3>Ultimo scandalo approvato</h3>{ev && last ? <p><b>{ev.title}</b> <span className="gold">{last.pointsAwarded > 0 ? '+' : ''}{last.pointsAwarded}</span></p> : <p className="muted">La Redazione è in attesa del primo evento.</p>}</div>
  <div className="card"><h3>Classifica live</h3>{ranking.slice(0,10).map((r:any,i:number)=><div className="rank-row" key={r.player.id}><span>#{i+1}</span><img src={r.player.avatarUrl}/><b>{r.player.nickname}</b><em>{r.points} pt</em></div>)}</div></section>;
}

function Submit({ player, players, events, refresh }: { player: Player; players: Player[]; events: EventDef[]; refresh: () => Promise<void> }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [assignedToId, setAssignedToId] = useState(player.id);
  const [note,setNote]=useState('');
  const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false);

  const targetPlayer = players.find(p => p.id === assignedToId) || player;
  const isAccollo = targetPlayer.id !== player.id;

  const toggleEvent = (id: string) => {
    setSelectedIds(current => {
      const alreadySelected = current.includes(id);
      if (alreadySelected) return current.filter(x => x !== id);
      setQuantities(q => ({ ...q, [id]: q[id] ?? '1' }));
      return [...current, id];
    });
    setSent(false);
  };

  const setQuantity = (id: string, value: string) => {
    // Permette di cancellare temporaneamente l'1 mentre l'utente sta scrivendo.
    // Il valore viene normalizzato solo al momento del calcolo/salvataggio.
    const clean = value.replace(/[^0-9]/g, '').slice(0, 3);
    setQuantities(current => ({ ...current, [id]: clean }));
    setSent(false);
  };

  const getQuantity = (id: string) => {
    const parsed = Number.parseInt(quantities[id] || '1', 10);
    return Math.max(1, Math.min(999, Number.isFinite(parsed) ? parsed : 1));
  };

  const getQuantityInputValue = (id: string) => quantities[id] ?? '1';

  const submit=async()=>{
    if (selectedIds.length === 0 || busy) return;
    setBusy(true);
    const selectedEvents = events.filter(e => selectedIds.includes(e.id));
    const rows = selectedEvents.map(e => {
      const quantity = getQuantity(e.id);
      return {
        player_id: targetPlayer.id,
        reported_by: player.id,
        assigned_to: targetPlayer.id,
        event_id: e.id,
        quantity,
        note: note.trim() || null,
        points_awarded: e.points * quantity,
        status: 'pending'
      };
    });
    const { error } = await supabase.from('submissions').insert(rows);
    setBusy(false);
    if (error) return alert('Errore invio prova. Controlla Supabase/RLS e il nuovo schema.sql.');
    setSent(true); setNote(''); setSelectedIds([]); setQuantities({}); setAssignedToId(player.id); await refresh();
  };

  if (events.length === 0) return <section className="page"><h1>Registra prova</h1><p className="muted">Nessuna prova trovata. Esegui prima lo schema SQL su Supabase.</p></section>;
  const selectedTotal = events.filter(e => selectedIds.includes(e.id)).reduce((sum, e) => sum + (e.points * getQuantity(e.id)), 0);
  return <section className="page"><h1>Registra prova</h1><p className="muted">Puoi selezionare più prove, indicare quantità e accollarle anche a un altro utente. La Redazione deciderà se approvarle.</p><div className="selection-summary"><b>{selectedIds.length}</b><span>{isAccollo ? `Accollo a ${targetPlayer.nickname}` : 'Prove per te'}</span><em>{selectedTotal>0?'+':''}{selectedTotal} pt potenziali</em></div><div className="assign-box"><label className="field-label">A chi vuoi accollare la prova?</label><select className="text-input" value={assignedToId} onChange={e=>{setAssignedToId(e.target.value); setSent(false);}}><option value={player.id}>Me stesso — {player.nickname}</option>{players.filter(p=>p.id!==player.id).map(p=><option key={p.id} value={p.id}>{p.nickname}</option>)}</select>{isAccollo && <p className="accollo-warning">🔥 Stai accollando questa prova a <b>{targetPlayer.nickname}</b>. I punti andranno a lui/lei dopo approvazione.</p>}</div><div className="event-grid multi quantity-mode">{events.map(e=>{const selected=selectedIds.includes(e.id); const quantity=getQuantity(e.id); const total=e.points*quantity; return <div key={e.id} className={`event-choice ${selected?'selected':''}`}><button type="button" onClick={()=>toggleEvent(e.id)}><span className="fake-check">{selected ? '✓' : ''}</span><span>{e.title}</span><b>{e.legendary && e.description ? e.description : `${e.points>0?'+':''}${e.points} pt`}</b></button>{selected && <div className="quantity-row"><label>Quantità</label><input className="quantity-input" type="number" min="1" max="999" inputMode="numeric" value={getQuantityInputValue(e.id)} onChange={ev=>setQuantity(e.id, ev.target.value)} onClick={ev=>ev.stopPropagation()} /><span className="quantity-total">Totale: {total>0?'+':''}{total} pt</span></div>}</div>;})}</div><textarea className="text-area" placeholder="Nota opzionale per la Redazione" value={note} onChange={e=>setNote(e.target.value)} /><button className="primary" disabled={busy || selectedIds.length===0} onClick={submit}><Send size={18}/> {busy ? 'INVIO...' : isAccollo ? 'INVIA ACCOLLO ALLA REDAZIONE' : selectedIds.length > 1 ? 'INVIA PROVE ALLA REDAZIONE' : 'INVIA PROVA ALLA REDAZIONE'}</button>{sent&&<p className="success">{isAccollo ? 'Accollo inviato' : 'Prove inviate'} su Supabase. In attesa di approvazione.</p>}</section>;
}

function Feed({ submissions, players, events, varReviews, player, refresh }: { submissions: Submission[]; players: Player[]; events: EventDef[]; varReviews: VarReview[]; player: Player; refresh: () => Promise<void> }) {
  const list=submissions.filter(s=>s.status==='approved');
  const openVarBySubmission = new Map(varReviews.filter(v => v.status === 'open').map(v => [v.submissionId, v]));
  const lastVarBySubmission = new Map(varReviews.map(v => [v.submissionId, v]));
  const react=async(id:string)=>{ await supabase.from('feed_reactions').upsert({ submission_id: id, player_id: player.id, emoji: '🔥' }, { onConflict: 'submission_id,player_id,emoji' }); await refresh(); };
  const requestVar=async(id:string)=>{
    const reason = window.prompt('Motivo VAR? Es. prova dubbia, decisione contestata, comportamento antisportivo.', 'Decisione contestata');
    if (reason === null) return;
    const { error } = await supabase.from('var_reviews').insert({ submission_id: id, opened_by: player.id, reason: reason.trim() || 'Decisione contestata', status: 'open' });
    if (error) return alert('VAR già aperto o errore richiesta.');
    await refresh();
  };
  return <section className="page"><h1>Feed live</h1>{list.length===0&&<p className="muted">Nessun evento approvato.</p>}{list.map(s=>{const target=players.find(x=>x.id===s.playerId);const reporter=players.find(x=>x.id===(s.reporterId || s.playerId));const e=events.find(x=>x.id===s.eventId); const activeVar=openVarBySubmission.get(s.id); const lastVar=lastVarBySubmission.get(s.id); const isAccollo=!!reporter && !!target && reporter.id!==target.id; return <div className={`feed-card ${activeVar ? 'var-active' : ''}`} key={s.id}><img src={target?.avatarUrl || DEFAULT_AVATAR}/><div><div className="feed-title-line"><b>{target?.nickname || 'Giocatore'}</b>{isAccollo && <span className="var-badge accollo-badge">ACCOLLATO DA {reporter?.nickname}</span>}{activeVar && <span className="var-badge"><AlertTriangle size={14}/> VAR IN CORSO</span>}{lastVar?.status === 'confirmed' && <span className="var-badge confirmed"><Eye size={14}/> VAR CONFERMATO</span>}{lastVar?.status === 'cancelled' && <span className="var-badge cancelled"><X size={14}/> VAR ANNULLATO</span>}</div><p>{isAccollo ? <><strong>{reporter?.nickname}</strong> ha accollato a <strong>{target?.nickname}</strong>: </> : <>ha completato: </>}<strong>{e?.title || 'Prova'}</strong> {s.quantity > 1 && <span className="quantity-pill">x{s.quantity}</span>} <span className="gold">{s.pointsAwarded>0?'+':''}{s.pointsAwarded}</span></p>{activeVar && <p className="var-note">🟡 Prova sotto revisione della Redazione. Motivo: {activeVar.reason || 'contestazione'}.</p>}{lastVar?.officialNote && <p className="var-note">Nota Redazione: {lastVar.officialNote}</p>}<small>{new Date(s.createdAt).toLocaleString('it-IT')}</small><div className="actions"><button onClick={()=>react(s.id)}><Heart size={16}/> {s.reactions.length}</button><button><MessageCircle size={16}/> {s.comments.length}</button>{!activeVar && lastVar?.status !== 'cancelled' && <button className="var-button" onClick={()=>requestVar(s.id)}><AlertTriangle size={16}/> Richiedi VAR</button>}</div></div></div>;})}</section>;
}

function Leaderboard({ ranking }: any) { return <section className="page"><h1>Classifica generale</h1><div className="card">{ranking.map((r:any,i:number)=><div className="rank-row big" key={r.player.id}><span>#{i+1}</span><img src={r.player.avatarUrl}/><b>{r.player.nickname}</b><em>{r.points} pt</em></div>)}</div></section>; }

function Rules({ events }: { events: EventDef[] }){
  const cats=[...new Set(events.map(e=>e.category))];
  return <section className="page"><h1>Regolamento</h1><div className="card"><h3>Finestre valide</h3><p>Weekend: venerdì 18:00 → domenica 21:00.</p><p>Festivi e prefestivi: 18:00 → 24:00.</p><p className="gold">Ferragosto, 14 agosto: doppio punteggio.</p></div>{cats.map(c=><div className="card" key={c}><h3>{c}</h3>{events.filter(e=>e.category===c).map(e=><div className="rule-row" key={e.id}><span>{e.title}</span><b>{e.legendary && e.description ? e.description : `${e.points>0?'+':''}${e.points}`}</b></div>)}</div>)}</section>;
}

function Admin({ submissions, players, events, varReviews, refresh }: { submissions: Submission[]; players: Player[]; events: EventDef[]; varReviews: VarReview[]; refresh: () => Promise<void> }){
  const [pin,setPin]=useState('');
  const [ok,setOk]=useState(false);
  const [busyId,setBusyId]=useState<string|null>(null);
  if(!ok)return <section className="page"><h1>Redazione</h1><input className="text-input" placeholder="PIN Redazione" value={pin} onChange={e=>setPin(e.target.value)} type="password"/><button className="primary" onClick={()=>setOk(pin===ADMIN_PIN)}>ENTRA</button><p className="muted">PIN configurabile con VITE_ADMIN_PIN. Default locale: 0000.</p></section>;
  const pending=submissions.filter(s=>s.status==='pending');
  const activeVars=varReviews.filter(v=>v.status==='open');
  const upd=async(id:string,status:'approved'|'rejected')=>{
    setBusyId(id);
    if (status === 'approved') {
      const { error } = await supabase.rpc('approve_submission', { submission_uuid: id });
      setBusyId(null);
      if (error) return alert('Errore approvazione prova. Controlla schema.sql.');
      await refresh();
      return;
    }
    const { error } = await supabase.from('submissions').update({ status, approved_at: new Date().toISOString(), points_awarded: 0 }).eq('id', id);
    setBusyId(null);
    if (error) return alert('Errore aggiornamento prova.');
    await refresh();
  };
  const resolveVar=async(review:VarReview, resolution:'confirmed'|'cancelled')=>{
    setBusyId(review.id);
    const note = resolution === 'confirmed' ? 'La Redazione conferma la prova.' : 'La Redazione annulla la prova dopo revisione VAR.';
    const { error: reviewError } = await supabase.from('var_reviews').update({ status: resolution, official_note: note, resolved_at: new Date().toISOString() }).eq('id', review.id);
    if (reviewError) { setBusyId(null); return alert('Errore chiusura VAR.'); }
    if (resolution === 'cancelled') {
      const { error: submissionError } = await supabase.from('submissions').update({ status: 'rejected', points_awarded: 0, approved_at: new Date().toISOString() }).eq('id', review.submissionId);
      if (submissionError) { setBusyId(null); return alert('VAR chiuso, ma errore annullamento prova.'); }
    }
    setBusyId(null);
    await refresh();
  };
  return <section className="page"><h1>Pannello Redazione</h1>
    <div className="card var-admin-panel"><h3><Gavel size={18}/> VAR attivi</h3>{activeVars.length===0&&<p className="muted">Nessuna revisione VAR aperta.</p>}{activeVars.map(v=>{const s=submissions.find(x=>x.id===v.submissionId);const target=s?players.find(x=>x.id===s.playerId):null;const reporter=s?players.find(x=>x.id===(s.reporterId || s.playerId)):null;const e=s?events.find(x=>x.id===s.eventId):null;const isAccollo=!!s&&!!target&&!!reporter&&target.id!==reporter.id;return <div className="admin-card var-review-card" key={v.id}><div><b>{target?.nickname || 'Giocatore'}</b><p>{isAccollo && <span className="accollo-text">Accollata da {reporter?.nickname} · </span>}{e?.title || 'Prova'} <span className="var-inline">VAR richiesto</span></p><small>{v.reason || 'Decisione contestata'}</small></div><button className="approve" disabled={busyId===v.id} onClick={()=>resolveVar(v,'confirmed')} title="Conferma prova"><Check/></button><button className="reject" disabled={busyId===v.id} onClick={()=>resolveVar(v,'cancelled')} title="Annulla prova"><X/></button></div>})}</div>
    <h2>Prove in attesa</h2>{pending.length===0&&<p className="muted">Nessuna prova in attesa.</p>}{pending.map(s=>{const target=players.find(x=>x.id===s.playerId);const reporter=players.find(x=>x.id===(s.reporterId || s.playerId));const e=events.find(x=>x.id===s.eventId);const isAccollo=!!target&&!!reporter&&target.id!==reporter.id;return <div className="admin-card" key={s.id}><div><b>{target?.nickname || 'Giocatore'}</b>{isAccollo&&<p className="accollo-text">Accollata da <strong>{reporter?.nickname}</strong></p>}<p>{e?.title || 'Prova'} {s.quantity > 1 && <span className="quantity-pill">x{s.quantity}</span>} <span className="gold">{s.pointsAwarded>0?'+':''}{s.pointsAwarded}</span></p>{s.note&&<small>{s.note}</small>}</div><button className="approve" disabled={busyId===s.id} onClick={()=>upd(s.id,'approved')}><Check/></button><button className="reject" disabled={busyId===s.id} onClick={()=>upd(s.id,'rejected')}><X/></button></div>;})}</section>;
}

function Profile({player,points,submissions,reset}:any){return <section className="page"><h1>Profilo</h1><div className="profile-card"><img src={player.avatarUrl}/><h2>{player.nickname}</h2><p className="gold">{points} punti</p><small>{submissions.filter((s:Submission)=>s.playerId===player.id).length} prove inviate</small></div><button className="ghost" onClick={reset}><RotateCcw size={16}/> Esci da questo profilo</button></section>;}

createRoot(document.getElementById('root')!).render(<App />);

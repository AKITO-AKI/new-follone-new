/*
  CanSee Tutorial (richer)
  - 5-step flow, with "missions" per step for a more satisfying experience
  - Interactive demos: chip flow (queued→processing→done), Spotlight demo, XP gain
  - Stores onboarding progress best-effort
*/

const $ = (id) => document.getElementById(id);

const TUTORIAL_METRICS = {
  startedAt: Date.now(),
  xpGained: 0,
};

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function setText(el, text){ if (el) el.textContent = String(text ?? ""); }

function normalizeCharId(id){
  if (id === "likoris") return "likoris";
  if (id === "forone") return "follone"; // legacy
  return "follone";
}
function charName(charId){ return charId === "likoris" ? "りこりす" : "ふぉろね"; }

async function sendSW(msg){
  try { return await chrome.runtime.sendMessage(msg); }
  catch (e) { return { ok:false, error:String(e) }; }
}

async function startAiPrepare({ poll=true } = {}) {
  const chip = $("hudAI");
  const set = (v) => { if (chip) chip.textContent = String(v); };
  set("PREP");
  let started = null;
  try { started = await sendSW({ type: "FOLLONE_AI_SETUP_START" }); } catch (_e) { started = null; }
  if (started && started.ok && started.status === "ready") {
    set("READY");
    return { ok:true, status:"ready" };
  }
  if (!poll) return { ok:false, status:"starting" };

  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    await sleep(1200);
    const st = await sendSW({ type: "FOLLONE_AI_SETUP_STATUS" });
    if (st && st.ok) {
      if (st.status === "ready") { set("READY"); return { ok:true, status:"ready" }; }
      if (st.status === "unavailable") { set("OFF"); return { ok:false, status:"unavailable" }; }
      const p = Number(st.progress || 0);
      if (Number.isFinite(p) && p > 0) set(`...${Math.round(p)}%`);
      else set("...");
    } else {
      set("...");
    }
  }
  set("...");
  return { ok:false, status:"timeout" };
}

async function getProgress(){
  const r = await sendSW({ type: "FOLLONE_GET_PROGRESS" });
  if (r && r.ok) return r;
  return { ok:false, xp:0, level:1, equippedHead:"" };
}

async function addXp(amount){
  const r = await sendSW({ type: "FOLLONE_ADD_XP", amount: Number(amount)||0 });
  return (r && r.ok) ? r : null;
}

async function markOnboardingDone(){
  try {
    await chrome.storage.local.set({
      follone_onboarding_done: true,
      follone_onboarding_phase: "done",
      follone_onboarding_state: "completed"
    });
  } catch(_e) {}
}

async function setOnboardingPhase(step){
  try {
    await chrome.storage.local.set({
      follone_onboarding_phase: `tutorial_step_${step}`,
      follone_onboarding_state: "in_tutorial"
    });
  } catch(_e) {}
}

async function loadGuideAvatar(charId){
  const canvas = $("guidePet");
  if (!canvas) return;

  canvas.style.imageRendering = "pixelated";
  canvas.width = 64;
  canvas.height = 64;

  try {
    if (!window.PetEngine) return;
    const eng = new window.PetEngine({ canvas });

    const base = "pet/data";
    const charURL = chrome.runtime.getURL(`${base}/characters/${charId}.json`);
    const accURL = chrome.runtime.getURL(`${base}/accessories/accessories.json`);

    const [resChar, resAcc] = await Promise.all([
      fetch(charURL, { cache: "no-store" }),
      fetch(accURL, { cache: "no-store" })
    ]);
    if (!resChar.ok) return;

    const char = await resChar.json();
    const accessories = resAcc.ok ? await resAcc.json() : null;

    const prog = await getProgress();
    const head = prog?.equippedHead ? String(prog.equippedHead) : null;

    eng.renderPet({
      char,
      accessories,
      eyesVariant: "normal",
      mouthVariant: "idle",
      equip: { head, fx: null }
    });
  } catch (_e) {
    // non-blocking
  }
}

async function say(lines, { clear=true, lineDelay=220 } = {}){
  const box = $("guideText");
  if (!box) return;
  if (clear) box.innerHTML = "";

  for (const line of lines) {
    const div = document.createElement("div");
    div.className = "tLine";
    div.textContent = line;
    box.appendChild(div);
    await sleep(lineDelay);
  }
}

function setActions(buttons){
  const wrap = $("guideActions");
  if (!wrap) return;
  wrap.innerHTML = "";
  buttons.forEach(b => wrap.appendChild(b));
}

function mkBtn(label, { kind="normal" } = {}){
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  if (kind === "ghost") b.classList.add("tGhost");
  if (kind === "primary") b.classList.add("tPrimary");
  return b;
}

function pulseCelebrate(){
  const card = $("guideCard");
  if (!card) return;
  card.classList.remove("isCelebrate");
  void card.offsetWidth;
  card.classList.add("isCelebrate");
  setTimeout(() => card.classList.remove("isCelebrate"), 650);
}

// Missions ------------------------------------------------------------
const MISSIONS = {
  1: [
    { title: "全体を見渡す", desc: "Overlayの例（左上のパネル）を見てみよう" },
  ],
  2: [
    { title: "チップの流れを見る", desc: "queued→processing→done を再生してみよう" },
  ],
  3: [
    { title: "Spotlightを体験", desc: "選択肢を増やして落ち着く練習" },
  ],
  4: [
    { title: "XPが増えるのを見る", desc: "良い選択がXPになるのを確認" },
  ],
  5: [
    { title: "次の行動を選ぶ", desc: "HOME BASEに戻る / Xを開く" },
  ],
};

const doneMissions = new Set();
function mKey(step, idx){ return `${step}:${idx}`; }

function renderMissions(step){
  const list = $("missionList");
  const foot = $("missionFoot");
  if (!list) return;
  list.innerHTML = "";

  const ms = MISSIONS[step] || [];
  ms.forEach((m, idx) => {
    const li = document.createElement("li");
    li.dataset.mission = mKey(step, idx);
    li.className = doneMissions.has(mKey(step, idx)) ? "isDone" : "";

    const icon = document.createElement("div");
    icon.className = "mIcon";

    const text = document.createElement("div");
    text.className = "mText";

    const title = document.createElement("div");
    title.className = "mTitle";
    title.textContent = m.title;

    const desc = document.createElement("div");
    desc.className = "mDesc";
    desc.textContent = m.desc;

    text.appendChild(title);
    text.appendChild(desc);
    li.appendChild(icon);
    li.appendChild(text);
    list.appendChild(li);
  });

  if (foot) {
    const all = ms.length;
    const done = ms.filter((_m, idx) => doneMissions.has(mKey(step, idx))).length;
    foot.textContent = all ? `完了: ${done}/${all}` : "";
  }
}

function completeMission(step, idx){
  const key = mKey(step, idx);
  if (doneMissions.has(key)) return;
  doneMissions.add(key);
  renderMissions(step);
  pulseCelebrate();
}

// Demo: chip flow -----------------------------------------------------
async function playChipFlow(postEl){
  if (!postEl) return;
  // avoid duplicates
  postEl.querySelectorAll('.tChipDemo').forEach(n => n.remove());

  const chip = document.createElement("div");
  chip.className = "tChipDemo isPop";
  chip.innerHTML = `<span>解析</span><b id="chipState">queued</b>`;
  chip.dataset.state = "queued";
  postEl.appendChild(chip);
  await sleep(420);

  const set = (st) => {
    chip.dataset.state = st;
    const b = chip.querySelector('#chipState');
    if (b) b.textContent = st;
  };

  set("queued");
  await sleep(560);
  set("processing");
  await sleep(860);
  set("done");
  await sleep(650);

  chip.style.opacity = "0";
  chip.style.transform = "translateY(-2px) scale(.99)";
  await sleep(220);
  chip.remove();
}

// Spotlight -----------------------------------------------------------
async function showSpotlightOnce({ allowXp=true } = {}){
  // Safety: Spotlight demo should ONLY appear when this step explicitly arms it.
  // Users reported it sometimes shows immediately on load due to state mismatch/stale UI.
  if (!window.__tutorialSpotlightArmed) {
    const veil0 = $("spotVeil");
    if (veil0) {
      veil0.classList.remove("on", "out");
      veil0.style.display = "none";
      veil0.setAttribute("aria-hidden", "true");
    }
    return { choice: "none", gained: 0 };
  }
  window.__tutorialSpotlightArmed = false;

  const veil = $("spotVeil");
  const btnBack = $("spotBack");
  const btnSearch = $("spotSearch");
  if (!veil || !btnBack || !btnSearch) return { choice:"none", gained:0 };

  // Ensure inline hide from the safety reset doesn't block display.
  veil.style.display = "";

  veil.classList.add("on");
  await sleep(60);
  btnBack.classList.add("tPulse");
  btnSearch.classList.add("tPulse");

  const choice = await new Promise((resolve) => {
    btnBack.addEventListener("click", () => resolve("back"), { once:true });
    btnSearch.addEventListener("click", () => resolve("search"), { once:true });
    veil.addEventListener("click", (e) => {
      if (e.target === veil) resolve("dismiss");
    }, { once:true });
  });

  btnBack.classList.remove("tPulse");
  btnSearch.classList.remove("tPulse");

  veil.classList.add("out");
  await sleep(220);
  veil.classList.remove("on");
  veil.classList.remove("out");
  // Keep it fully hidden between demos.
  veil.style.display = "none";
  veil.setAttribute("aria-hidden", "true");

  let gained = 0;
  if (allowXp) {
    gained = 10;
    TUTORIAL_METRICS.xpGained += gained;
    const r = await addXp(gained);
    if (r && r.ok) {
      setText($("hudLv"), r.level);
      setText($("hudXp"), r.xp);
      setText($("hudGain"), gained);
      const chip = $("hudGain");
      if (chip) {
        chip.classList.add("xp-pop");
        setTimeout(() => chip.classList.remove("xp-pop"), 450);
      }
    } else {
      const p = await getProgress();
      setText($("hudLv"), p.level || 1);
      setText($("hudXp"), p.xp || 0);
      setText($("hudGain"), gained);
    }
  }

  return { choice, gained };
}

// Finish modal (certificate) ------------------------------------------
function formatDuration(ms){
  const sec = Math.max(0, Math.round(ms/1000));
  const m = Math.floor(sec/60);
  const s = sec % 60;
  if (m <= 0) return `${s}秒`;
  return `${m}分${s.toString().padStart(2,'0')}秒`;
}

function drawFinishBadge({ canvas, label='CanSee' }){
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);

  // soft ring
  ctx.beginPath();
  ctx.arc(w/2, h/2, Math.min(w,h)*0.43, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(w/2, h/2, Math.min(w,h)*0.40, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(0,0,0,.12)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // ribbon
  ctx.fillStyle = 'rgba(253,107,152,.85)';
  ctx.fillRect(w*0.28, h*0.62, w*0.44, h*0.12);
  ctx.fillStyle = 'rgba(122,86,255,.75)';
  ctx.fillRect(w*0.28, h*0.74, w*0.44, h*0.06);

  // star
  const cx = w/2, cy = h*0.44;
  const R = Math.min(w,h)*0.18;
  const r = R*0.45;
  ctx.beginPath();
  for (let i=0;i<10;i++){
    const a = (-Math.PI/2) + i*(Math.PI/5);
    const rad = (i%2===0) ? R : r;
    ctx.lineTo(cx + Math.cos(a)*rad, cy + Math.sin(a)*rad);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,200,120,.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.12)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // label
  ctx.fillStyle = 'rgba(0,0,0,.78)';
  ctx.font = '900 16px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w/2, h*0.86);
}

async function showFinishModal({ name='—', steps=5, xp=0, durationMs=0 } = {}){
  const veil = $('finishVeil');
  if (!veil) return { action:'none' };
  veil.classList.add('on');
  veil.setAttribute('aria-hidden','false');

  setText($('finishName'), name);
  setText($('finishMeta'), `STEP ${steps}/5`);
  setText($('stSteps'), steps);
  setText($('stXp'), xp);
  setText($('stTime'), formatDuration(durationMs));

  drawFinishBadge({ canvas: $('finishBadge'), label: 'CanSee' });

  // confetti
  const conf = $('confetti');
  if (conf) {
    conf.innerHTML = '';
    const n = 22;
    for (let i=0;i<n;i++){
      const p = document.createElement('i');
      const x = Math.random()*100;
      const d = 900 + Math.random()*600;
      p.style.left = `${x}%`;
      p.style.top = `${-20 - Math.random()*80}px`;
      p.style.animationDuration = `${Math.round(d)}ms`;
      p.style.transform = `rotate(${Math.random()*180}deg)`;
      conf.appendChild(p);
    }
  }

  const btnHome = $('finishHome');
  const btnX = $('finishX');
  const btnClose = $('finishClose');

  const action = await new Promise((resolve) => {
    btnHome?.addEventListener('click', () => resolve('home'), { once:true });
    btnX?.addEventListener('click', () => resolve('x'), { once:true });
    btnClose?.addEventListener('click', () => resolve('close'), { once:true });
    veil.addEventListener('click', (e) => {
      if (e.target === veil) resolve('close');
    }, { once:true });
  });

  veil.classList.remove('on');
  veil.setAttribute('aria-hidden','true');
  return { action };
}

async function main(){
  // Hard reset: ensure Spotlight veil is hidden on initial load.
  // (Prevents "Spotlight appears immediately" when something goes off-script.)
  try {
    const sv = $("spotVeil");
    if (sv) {
      sv.classList.remove("on", "out");
      sv.style.display = "none";
      sv.setAttribute("aria-hidden", "true");
    }
  } catch (_e) {}
  window.__tutorialSpotlightArmed = false;

  // reset metrics per load
  TUTORIAL_METRICS.startedAt = Date.now();
  TUTORIAL_METRICS.xpGained = 0;

  const STEPS = [
    { id:1, title:'WELCOME', hint:'準備と全体像' },
    { id:2, title:'Overlay', hint:'見方とチップ' },
    { id:3, title:'Spotlight', hint:'介入UI体験' },
    { id:4, title:'LEVEL', hint:'XPと解放' },
    { id:5, title:'FINISH', hint:'始めよう' },
  ];

  // narrator character
  let charId = 'follone';
  try {
    const cur = await chrome.storage.local.get(["cansee_selected_character_id","follone_characterId","characterId","selectedCharacterId"]);
    const pick = cur.cansee_selected_character_id || cur.follone_characterId || cur.characterId || cur.selectedCharacterId;
    charId = normalizeCharId(String(pick || 'follone'));
  } catch (_e) {}
  window.__tutorialCharId = charId;
  setText($('guideChar'), charName(charId));
  loadGuideAvatar(charId);

  // HUD
  const p0 = await getProgress();
  setText($('hudLv'), p0.level || 1);
  setText($('hudXp'), p0.xp || 0);
  setText($('hudGain'), 0);

  // start AI prep (non-blocking)
  startAiPrepare({ poll:true }).catch(() => {});

  const visited = new Set();
  let current = 1;

  const setProgress = (step) => {
    const idx = STEPS.findIndex(s => s.id === step);
    const label = $('progLabel');
    const hint = $('progHint');
    const fill = $('progFill');
    const bar = document.querySelector('.tProgBar');

    if (label) label.textContent = `STEP ${idx+1}/${STEPS.length}`;
    if (hint) hint.textContent = STEPS[idx]?.hint || '';
    const pct = ((idx+1) / STEPS.length) * 100;
    if (fill) fill.style.width = `${pct}%`;
    if (bar) bar.setAttribute('aria-valuenow', String(idx+1));

    STEPS.forEach(s => {
      const n = $('nav' + s.id);
      if (!n) return;
      n.classList.toggle('isActive', s.id === step);
      n.classList.toggle('isDone', visited.has(s.id) && s.id !== step);
    });
  };

  const flash = () => {
    const card = $('guideCard');
    if (!card) return;
    card.classList.remove('isFlash');
    void card.offsetWidth;
    card.classList.add('isFlash');
  };

  const goto = async (step) => {
    current = step;
    visited.add(step);
    setProgress(step);
    renderMissions(step);
    flash();
    setOnboardingPhase(step).catch(() => {});

    $('postHot')?.classList.remove('isTarget');

    // STEP 1
    if (step === 1) {
      document.getElementById('overlayDemo')?.scrollIntoView({ behavior:'smooth', block:'start' });
      completeMission(1, 0);
      await say([
        `やあ。${charName(charId)}だよ。`,
        'ここは練習用のTUTORIAL。実際のXには影響しないよ。',
        '右の数字(1〜5)で、いつでも戻れる。',
        'では、Overlayの見方からいこう。',
      ]);
      const b = mkBtn('次へ', { kind:'primary' });
      setActions([b]);
      await new Promise(r => b.addEventListener('click', r, { once:true }));
      return goto(2);
    }

    // STEP 2
    if (step === 2) {
      document.getElementById('overlayDemo')?.classList.add('isPop');
      await sleep(120);
      await say([
        'Overlayは「今のタイムラインの偏り」を見る窓。',
        'Focus: 同じ話題に偏ってない？',
        'Variety: 話題の幅はある？',
        'Explore: 新しい視点を取りに行けてる？',
        '次に、投稿チップの流れを見てみよう。',
      ]);

      const bPlay = mkBtn('チップを動かす', { kind:'primary' });
      const bPrev = mkBtn('戻る', { kind:'ghost' });
      const bNext = mkBtn('次へ');

      setActions([bPrev, bPlay, bNext]);
      bPrev.addEventListener('click', () => goto(1), { once:true });

      bPlay.addEventListener('click', async () => {
        const post = $("postHot");
        if (post) {
          post.classList.add('isTarget');
          post.scrollIntoView({ behavior:'smooth', block:'center' });
        }
        await sleep(160);
        await playChipFlow(post);
        completeMission(2, 0);
        await say([
          'こんな感じで、queued→processing→done が動く。',
          '終わったら自然に消える（残骸を残さない）。',
        ], { clear:false, lineDelay:170 });
      });

      await new Promise(r => bNext.addEventListener('click', r, { once:true }));
      return goto(3);
    }

    // STEP 3
    if (step === 3) {
      $('postHot')?.classList.add('isTarget');
      $('postHot')?.scrollIntoView({ behavior:'smooth', block:'center' });
      await sleep(160);
      await say([
        '次はSpotlight（介入UI）。',
        '感情が強くなりそうな投稿で、いったん「選択肢」を増やす。',
        'ここでは練習。どちらを押してもOK。',
      ]);
      const bDo = mkBtn('Spotlightを体験', { kind:'primary' });
      const bPrev = mkBtn('戻る', { kind:'ghost' });
      setActions([bPrev, bDo]);
      bPrev.addEventListener('click', () => goto(2), { once:true });

      await new Promise(r => bDo.addEventListener('click', r, { once:true }));
      // Arm the demo explicitly so it never pops unintentionally.
      window.__tutorialSpotlightArmed = true;
      const { choice } = await showSpotlightOnce({ allowXp:true });
      completeMission(3, 0);

      await say([
        choice === 'search' ? '視点を増やす選択、ナイス。' : '距離を取る選択、ナイス。',
        'こういう「落ち着いた選択」がXPになる。',
      ]);

      const bNext = mkBtn('次へ', { kind:'primary' });
      setActions([bNext]);
      await new Promise(r => bNext.addEventListener('click', r, { once:true }));
      return goto(4);
    }

    // STEP 4
    if (step === 4) {
      const prog = await getProgress();
      setText($('hudLv'), prog.level || 1);
      setText($('hudXp'), prog.xp || 0);

      await say([
        'LV/XPは「良い使い方ができた回数」の目安。',
        'GAMEでティア報酬を眺められる。',
        '次のミッション：XPが増えるのを確認してみよう。',
      ]);

      const bGain = mkBtn('+10XPしてみる', { kind:'primary' });
      const bPrev = mkBtn('戻る', { kind:'ghost' });
      const bNext = mkBtn('次へ');
      setActions([bPrev, bGain, bNext]);

      bPrev.addEventListener('click', () => goto(3), { once:true });

      bGain.addEventListener('click', async () => {
        TUTORIAL_METRICS.xpGained += 10;
        const r = await addXp(10);
        if (r && r.ok) {
          setText($('hudLv'), r.level);
          setText($('hudXp'), r.xp);
          setText($('hudGain'), 10);
        } else {
          const p = await getProgress();
          setText($('hudLv'), p.level || 1);
          setText($('hudXp'), p.xp || 0);
          setText($('hudGain'), 10);
        }
        completeMission(4, 0);
        await say(['OK。数字が動けば勝ち。'], { clear:false, lineDelay:160 });
      });

      await new Promise(r => bNext.addEventListener('click', r, { once:true }));
      return goto(5);
    }

    // STEP 5
    await say([
      '準備OK。最後に「困った時」。',
      '① HOME BASE(Options) → PREPARE / WARMUP',
      '② 動かない時 → RESET BACKEND',
      '③ それでもダメならページをリロード',
      'じゃあ、行こう。',
    ]);

    await markOnboardingDone();

    // PhaseA: make the tutorial a one-time mandatory step (Lv1 -> Lv2).
    try {
      const prog = await getProgress();
      if (prog && Number(prog.level || 1) <= 1) {
        // add a bit more XP until we see Lv2 (bounded)
        await addXp(25);
        const prog2 = await getProgress();
        if (prog2 && Number(prog2.level || 1) <= 1) {
          await addXp(60);
        }
      }
      await chrome.storage.local.set({
        follone_tutorial_state: 'done',
        follone_tutorial_done: true
      });
    } catch (_e) {}

    const bShow = mkBtn('修了証を見る', { kind:'primary' });
    const bHome = mkBtn('HOME BASEへ', { kind:'ghost' });
    const bX = mkBtn('Xを開く', { kind:'ghost' });
    setActions([bShow, bHome, bX]);

    const finish = async (preferred) => {
      completeMission(5, 0);
      const elapsed = Date.now() - TUTORIAL_METRICS.startedAt;
      const res = await showFinishModal({
        name: charName(charId),
        steps: 5,
        xp: TUTORIAL_METRICS.xpGained,
        durationMs: elapsed,
      });
      const act = res.action === 'close' ? preferred : res.action;
      if (act === 'home') {
        try { await chrome.runtime.openOptionsPage(); } catch (_e) {}
      } else if (act === 'x') {
        try { await chrome.tabs.create({ url: 'https://x.com/home' }); } catch (_e) {}
      }
    };

    bShow.addEventListener('click', () => finish('close'), { once:true });
    bHome.addEventListener('click', () => finish('home'), { once:true });
    bX.addEventListener('click', () => finish('x'), { once:true });
  };

  STEPS.forEach(s => {
    const n = $('nav' + s.id);
    n?.addEventListener('click', () => goto(s.id));
  });

  setProgress(1);
  await goto(1);
}

main().catch((e) => {
  console.error(e);
  try { setText($("guideText"), "チュートリアルでエラーが起きました。Optionsから再実行してください。" ); } catch(_e) {}
});

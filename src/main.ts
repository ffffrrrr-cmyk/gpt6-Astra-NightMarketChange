import { LEVELS, getLevel } from './content/levels.ts';
import { cashText, cashValue, changeText, changeValue, changeWays, commit, guestBlock, initialState, preview, traySize } from './core/rules.ts';
import type { Change, GameState, Guest, Level } from './core/types.ts';
import { GameAudio } from './platform/audio.ts';
import { SaveStore, defaultProgress } from './platform/save.ts';
import { NightScene, portrait } from './visual/scene.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
const modalRoot = document.querySelector<HTMLDivElement>('#modal-root')!;
const toastRoot = document.querySelector<HTMLDivElement>('#toast-root')!;
const store = new SaveStore();
let progress = store.load();
const audio = new GameAudio(progress.settings);
let page: 'title' | 'levels' | 'game' | 'ending' = 'title';
type Modal = 'pause' | 'settings' | 'help' | 'intro' | 'result' | 'new' | 'retry' | 'ledger' | 'tutorial' | null;
let modal: Modal = null;
let returnModal: Modal = null;
let state: GameState | null = progress.current;
let level: Level = state ? getLevel(state.levelId) : LEVELS[0];
let selectedId: string | null = null;
let draft: Change = { ones: 0, fives: 0 };
let queueOrder: string[] = [];
let scene: NightScene | null = null;
let toastTimer = 0;
let commandCounter = 0;
let tutorialStage: 'reject' | 'valid' | 'free' | null = null;
let dragId: string | null = null;
const heldKeys = new Set<string>();
const avatars = Array.from({ length: 8 }, (_, index) => portrait(index));
const sessionId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const icons: Record<string, string> = {
  pause: '<path d="M8 5v14M16 5v14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16v.1"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--sand)"/><circle cx="15" cy="17" r="3" fill="var(--sand)"/>',
  back: '<path d="m14 5-7 7 7 7M7 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  book: '<path d="M4 4h7l1 2 1-2h7v15h-7l-1 1-1-1H4zM12 6v14"/>',
};
const escape = (text: unknown): string => String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const icon = (name: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] ?? icons.help}</svg>`;
const iconButton = (name: string, action: string, label: string): string => `<button class="icon-btn" data-action="${action}" aria-label="${label}" title="${label}">${icon(name)}</button>`;
const money = (denomination: 1 | 5 | 10): string => denomination === 1 ? '<span class="coin" aria-hidden="true">1<small>元</small></span>' : `<span class="note ${denomination === 10 ? 'ten' : ''}" aria-hidden="true"><small>人民币</small><strong>${denomination}</strong><small>元</small></span>`;

function persist(): void {
  progress.current = state;
  progress.lastEventSequence = state?.events.length ?? 0;
  store.save(progress);
  syncNotice();
}
function syncNotice(): void {
  let notice = document.querySelector<HTMLDivElement>('#storage-notice');
  app.classList.toggle('storage-warning', Boolean(store.notice));
  if (!store.notice) { notice?.remove(); app.style.removeProperty('--notice-height'); return; }
  if (!notice) { notice = document.createElement('div'); notice.id = 'storage-notice'; notice.className = 'storage-notice'; app.prepend(notice); }
  notice.textContent = store.notice;
  app.style.setProperty('--notice-height', `${notice.offsetHeight}px`);
}
function toast(message: string, error = false): void {
  window.clearTimeout(toastTimer);
  toastRoot.innerHTML = `<div class="notification ${error ? 'error' : ''}" role="status">${escape(message)}</div>`;
  toastTimer = window.setTimeout(() => { toastRoot.innerHTML = ''; }, 4500);
}
function applySettings(): void {
  document.documentElement.classList.toggle('reduced', progress.settings.reduceMotion);
  audio.settings = progress.settings;
  if (scene) scene.reduceMotion = progress.settings.reduceMotion;
}
function disposeScene(): void { scene?.dispose(); scene = null; }
function attachScene(mode: 'title' | 'game'): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene');
  if (!canvas) return;
  scene = new NightScene(canvas, mode, progress.settings.reduceMotion);
  if (mode === 'game') scene.look = level.guests.find(guest => guest.id === selectedId)?.look ?? 0;
}
function header(title: string, isGame = false): string {
  return `<header class="page-header"><div class="brand"><span class="brand-mark">夜</span>夜市找零</div><div class="header-middle"><span class="tag">第${String(level.number).padStart(2, '0')}夜</span><span class="level-label">${escape(title)}</span></div><nav class="header-actions" aria-label="游戏菜单">${isGame ? iconButton('book', 'ledger', '查看账本') : ''}${iconButton('help', 'help', '玩法说明')}${iconButton('settings', 'settings', '设置')}${iconButton(isGame ? 'pause' : 'back', isGame ? 'pause' : 'title', isGame ? '暂停' : '返回标题')}</nav></header>`;
}
function render(): void {
  disposeScene();
  modal = null; modalRoot.innerHTML = '';
  if (page === 'title') {
    app.innerHTML = `<main class="title-screen"><canvas id="scene" class="title-scene" aria-label="灯笼下的夜市街道与小食摊位"></canvas><div class="title-shade"></div><header class="title-top"><div class="brand"><span class="brand-mark">夜</span>一份小食，三元刚好</div><div class="row">${iconButton('help', 'help', '玩法说明')}${iconButton('settings', 'settings', '设置')}</div></header><section class="title-copy"><div class="eyebrow">十二夜 · 一间小摊</div><h1><span>夜市</span><span>找零</span></h1><p>灯亮了，客人来了。<br>收下十元，找回七元。<br>留一点零钱，也留一点从容。</p><div class="title-actions">${progress.current ? '<button class="btn" data-action="continue">继续营业</button><button class="btn secondary" data-action="levels">选择夜晚</button>' : '<button class="btn" data-action="new">开始营业</button><button class="btn secondary" data-action="levels">十二个夜晚</button>'}</div>${progress.current ? '<button class="text-button" data-action="new">重新开始</button>' : ''}</section><footer class="title-bottom"><div class="title-rules"><div class="title-rule"><strong>10<span style="display:inline;font-size:17px"> 元</span></strong><span>每客收款</span></div><div class="title-rule"><strong>7<span style="display:inline;font-size:17px"> 元</span></strong><span>准确找零</span></div><div class="title-rule"><strong>8<span style="display:inline;font-size:17px"> 位</span></strong><span>连续服务</span></div></div><div class="title-caption">先找零，再入账<br><span class="title-note">回合制 · 可随时暂停 · 离线游玩</span></div></footer></main>`;
    attachScene('title');
  } else if (page === 'levels') {
    app.innerHTML = `<div class="levels-screen">${header('十二个夜晚')}<main class="levels-body"><div class="levels-title"><div><div class="eyebrow">从巷口到灯火深处</div><h1>今晚，在哪儿摆摊？</h1><p>每夜八位客人。看清付款，安排顺序，把零钱留给下一位。</p></div><span class="tag">已完成 ${Object.keys(progress.best).length} / 12 夜</span></div><div class="level-grid">${LEVELS.map(item => `<button class="level-card ${item.number > progress.unlocked ? 'locked' : ''}" data-action="start" data-level="${item.id}" ${item.number > progress.unlocked ? 'disabled' : ''}><span class="number">${String(item.number).padStart(2, '0')}</span><h2>${item.name}</h2><p>${item.description}</p><span class="bottom">${progress.best[item.id] ? `已完成 · 最少递出${progress.best[item.id]}张/枚` : item.number > progress.unlocked ? `完成第${item.number - 1}夜后解锁` : `${item.district} · 开始`}</span></button>`).join('')}</div><p class="levels-foot">关卡进度在本机保存。35–60分钟为完整体验设计目标，可分多次游玩。</p></main></div>`;
  } else if (page === 'game' && state) {
    app.innerHTML = `${header(level.name, true)}<main class="game-shell"><section class="workbench" aria-label="摊位工作台"><div class="scene-wrap"><canvas id="scene" class="game-scene" aria-label="夜市小食摊，当前客人正在等待结账"></canvas><div class="scene-caption">${escape(level.district)}</div><div id="speech" class="speech"></div></div><div id="progress-strip" class="progress-strip"></div><div class="money-area"><section class="tray grain" aria-label="现有零钱"><div class="row spread"><h2 class="section-heading">零钱盘</h2><span id="tray-capacity" class="tray-meta"></span></div><div id="cash-items" class="cash-items"></div><div id="income-pocket" class="income-pocket"></div></section><section class="change-panel" aria-label="本次找零"><div class="change-head"><h2 class="section-heading">递给客人的零钱</h2><div id="change-total" class="change-total"></div></div><div id="selected-money" class="selected-money"></div><div id="preview" class="preview-text" aria-live="polite"></div><div class="change-actions"><button class="btn secondary clear" data-action="clear" title="右键也可清空">清空</button><button id="submit" class="btn" data-action="submit">确认找零 <span aria-hidden="true">↵</span></button></div></section></div><div id="guide-bar" class="guide-bar"></div><footer class="controls-hint"><span><kbd>左键</kbd>选客 / 选钱</span><span><kbd>拖动</kbd>排顺序</span><span><kbd>Enter</kbd>确认</span><span><kbd>右键</kbd>取消</span><span><kbd>Esc</kbd>暂停</span></footer></section><aside class="queue" aria-label="候客区"><div class="queue-heading"><h2>候客区</h2><span id="waiting-count"></span></div><p class="queue-tip">卡片显示客人付款。点选一位，或拖动卡片安排顺序。</p><div id="guest-list" class="guest-list"></div><div id="queue-footer" class="queue-footer"></div></aside></main>`;
    attachScene('game'); refreshGame();
  } else if (page === 'ending') {
    const complete = Object.keys(progress.best).length;
    app.innerHTML = `<main class="ending"><div class="ending-inner"><span class="brand-mark">夜</span><div class="eyebrow" style="margin-top:28px">十二盏灯，都为你亮过</div><h1>这一夜，<br>收得刚刚好。</h1><p>八位客人走过，零钱在手中流转。<br>你学会了等一等、留一手，<br>也把这一条街的烟火气，留在了记忆里。</p><div class="modal-stat"><div><strong>${complete}</strong><span>完成的夜晚</span></div><div><strong>${complete * 8}</strong><span>完成的订单</span></div><div><strong>${Object.values(progress.best).reduce((sum, value) => sum + value, 0)}</strong><span>最佳记录总张枚</span></div></div><div class="actions"><button class="btn" data-action="levels">重访夜市</button><button class="btn secondary" data-action="title">返回标题</button></div></div></main>`;
  }
  syncNotice(); applySettings();
}

function conditionText(guest: Guest): string {
  const parts: string[] = [];
  if (guest.after.length) parts.push(`在${guest.after.map(id => level.guests.find(item => item.id === id)!.name).join('、')}之后`);
  if (guest.earliest > 1 || guest.latest < 8) parts.push(`第${guest.earliest}–${guest.latest}客`);
  return parts.join('；') || '随时可选';
}
function paymentLabel(guest: Guest): string {
  if (guest.payment.tens) return '10元整钞';
  if (guest.payment.fives === 2) return '两张5元';
  if (guest.payment.ones === 10) return '十枚1元';
  return '5元 + 五枚1元';
}
function refreshGame(): void {
  if (!state || page !== 'game') return;
  const activeButton = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
  const previousAction = activeButton?.dataset.action;
  const previousGuest = activeButton?.dataset.guest;
  const guest = level.guests.find(item => item.id === selectedId);
  const check = preview(level, state, selectedId, draft);
  const used = traySize(state.cash);
  document.querySelector('#speech')!.innerHTML = guest ? `<strong>${guest.name}</strong><p>“来一份${guest.item}。”</p><p class="muted">付款：${cashText(guest.payment)}<br>${conditionText(guest)}</p>` : '<strong>下一位，您好</strong><p>从右侧候客区选一位客人。<br>先看付款，再决定顺序。</p>';
  document.querySelector('#progress-strip')!.innerHTML = `<span class="progress-label">连续服务 <strong>${state.served.length}</strong> / 8 客</span><div class="progress-track" aria-hidden="true">${Array.from({ length: 8 }, (_, index) => `<span class="progress-dot ${index < state!.served.length ? 'done' : ''}"></span>`).join('')}</div><span class="tray-meta">第 ${state.cycle + (state.status === 'playing' ? 1 : 0)} 回合</span>`;
  document.querySelector('#tray-capacity')!.textContent = `${used} / ${level.capacity} 张·枚`;
  document.querySelector('#cash-items')!.innerHTML = `<button class="cash-button" data-action="coin1" aria-label="选择一枚1元硬币，剩余${state.cash.ones - draft.ones}枚">${money(1)}<span class="count">剩余 <strong>${state.cash.ones - draft.ones}</strong> 枚</span></button><button class="cash-button" data-action="note5" aria-label="选择一张5元纸币，剩余${state.cash.fives - draft.fives}张">${money(5)}<span class="count">剩余 <strong>${state.cash.fives - draft.fives}</strong> 张</span></button>`;
  document.querySelector('#income-pocket')!.innerHTML = `<span>收入格 · 10元×${state.cash.tens}<br><span>整钞不能用于找7元</span></span><strong>共${cashValue(state.cash)}元</strong>`;
  const total = changeValue(draft);
  const totalElement = document.querySelector('#change-total')!;
  totalElement.innerHTML = `${total}<small> / 7元</small>`;
  totalElement.classList.toggle('over', total > 7);
  document.querySelector('#selected-money')!.innerHTML = `${Array.from({ length: draft.fives }, () => `<button data-action="remove5" aria-label="收回一张5元纸币">${money(5)}</button>`).join('')}${Array.from({ length: draft.ones }, () => `<button data-action="remove1" aria-label="收回一枚1元硬币">${money(1)}</button>`).join('')}` || '<span class="placeholder">点左侧的钱，放到这里</span>';
  const previewElement = document.querySelector('#preview')!;
  previewElement.classList.toggle('warning', check.risk || Boolean(check.next && !check.legal));
  previewElement.innerHTML = check.legal && check.next ? `本次找${total}元，随后收10元。<br>下客可用：1元×${check.next.ones}、5元×${check.next.fives}${check.nextWays === 0 && state.served.length < 7 ? '；下客将无法找零！' : `；钱盘${traySize(check.next)}/${level.capacity}`}` : escape(check.reason);
  const submit = document.querySelector<HTMLButtonElement>('#submit')!;
  submit.classList.toggle('danger', check.risk);
  submit.textContent = check.risk ? '零钱不足，仍接单' : '确认找零 · Enter';
  submit.disabled = state.status !== 'playing';
  document.querySelector('#waiting-count')!.textContent = `${8 - state.served.length} 位等候`;
  document.querySelector('#guest-list')!.innerHTML = queueOrder.map((id, index) => {
    const item = level.guests.find(candidate => candidate.id === id)!;
    const served = state!.served.includes(id);
    const blocked = guestBlock(level, state!.served, item);
    return `<button class="guest-card ${selectedId === id ? 'selected' : ''} ${served ? 'served' : blocked ? 'blocked' : ''}" data-action="guest" data-guest="${id}" draggable="${!served}" aria-pressed="${selectedId === id}" aria-label="${item.name}，付款${cashText(item.payment)}，${served ? '已完成' : conditionText(item)}"><span class="order">${String(index + 1).padStart(2, '0')}</span><span class="guest-top"><img src="${avatars[item.look]}" alt=""><strong>${item.name}</strong></span><span class="payment">${paymentLabel(item)}</span><span class="condition">${served ? '已结账 · 完成' : conditionText(item)}</span></button>`;
  }).join('');
  document.querySelector('#queue-footer')!.innerHTML = `<span>本夜净收入 <strong>${state.served.length * 3}元</strong></span><span>已递出 ${state.piecesGiven}张/枚</span>`;
  let guide = level.lesson;
  if (tutorialStage === 'reject') guide = '先点一枚1元，再按回车。试试金额不足时，摊位会怎样提醒你。';
  if (tutorialStage === 'valid') guide = '刚才只拒绝了错误找零，库存没有扣除。现在选一张5元和两枚1元，再确认。';
  if (tutorialStage === 'free') guide = '回到了相同初态。这次试着先服务林叔，观察十枚1元如何改变下一客的找法。';
  const risk = !changeWays(state.cash).length && state.status === 'playing';
  if (risk) guide = '现有零钱已无法凑7元。当前客人的付款还不能用；继续接单会失败，可暂停后重新开始本夜。';
  const guideElement = document.querySelector('#guide-bar')!;
  guideElement.classList.toggle('warning', risk);
  guideElement.innerHTML = `<strong>${risk ? '接单风险' : tutorialStage ? '上手引导' : '今夜提醒'}</strong><p>${escape(guide)}</p><button data-action="help">看规则</button>`;
  if (scene && guest) { scene.look = guest.look; scene.served = state.served.length; }
  if (previousAction && document.activeElement === document.body) {
    const selector = previousGuest ? `[data-action="${previousAction}"][data-guest="${previousGuest}"]` : `[data-action="${previousAction}"]`;
    document.querySelector<HTMLButtonElement>(selector)?.focus({ preventScroll: true });
  }
}

function startLevel(id: string, intro = true): void {
  const target = getLevel(id);
  if (target.number > progress.unlocked) { toast('先完成上一夜，再来这里摆摊。'); return; }
  level = target; state = initialState(level); draft = { ones: 0, fives: 0 };
  selectedId = level.guests[0].id; queueOrder = level.guests.map(guest => guest.id);
  tutorialStage = level.number === 1 && !progress.tutorialDone ? 'reject' : null;
  page = 'game'; persist(); render();
  if (intro) openModal('intro');
}
function continueGame(): void {
  if (!progress.current) { startLevel(LEVELS[0].id); return; }
  state = progress.current; level = getLevel(state.levelId);
  queueOrder = level.guests.map(guest => guest.id);
  selectedId = level.guests.find(guest => !state!.served.includes(guest.id))?.id ?? null;
  draft = { ones: 0, fives: 0 }; tutorialStage = null; page = 'game'; render();
  if (state.status !== 'playing') openModal('result');
}
function submit(): void {
  if (!state || modal || page !== 'game') return;
  const result = commit(level, state, { commandId: `${sessionId}:${++commandCounter}`, guestId: selectedId ?? '', change: { ...draft } });
  if (!result.accepted) {
    audio.play('reject'); toast(result.message, true);
    if (tutorialStage === 'reject' && selectedId && changeValue(draft) !== 7) tutorialStage = 'valid';
    refreshGame(); return;
  }
  state = result.state; draft = { ones: 0, fives: 0 };
  const wasTeaching = tutorialStage === 'valid' || tutorialStage === 'reject';
  if (tutorialStage === 'free') tutorialStage = null;
  if (state.status === 'won') {
    progress.unlocked = Math.max(progress.unlocked, Math.min(12, level.number + 1));
    progress.best[level.id] = Math.min(progress.best[level.id] ?? Infinity, state.piecesGiven);
    progress.tutorialDone ||= level.number === 1;
    audio.play('win');
  } else if (state.status === 'lost') audio.play('lose');
  else { audio.play('commit'); scene?.celebrate(); }
  selectedId = queueOrder.find(id => !state!.served.includes(id) && !guestBlock(level, state!.served, level.guests.find(guest => guest.id === id)!)) ?? queueOrder.find(id => !state!.served.includes(id)) ?? null;
  persist(); refreshGame();
  if (state.status !== 'playing') { tutorialStage = null; openModal('result'); }
  else if (wasTeaching) openModal('tutorial');
  else if (!changeWays(state.cash).length) { audio.play('warning'); toast('钱盘暂时凑不出7元。下一次接单会失败，请查看风险提示。', true); }
}
function addCash(kind: 'ones' | 'fives'): void {
  if (!state || state.status !== 'playing') return;
  if (draft[kind] >= state.cash[kind]) { audio.play('reject'); toast('钱盘里已经没有更多这个面额了。', true); return; }
  if (changeValue(draft) >= 12) { toast('已经超过应找金额，点选中的钱可以收回。', true); return; }
  draft[kind]++; audio.play('select'); refreshGame();
}

function modalContents(): { title: string; body: string; wide?: boolean } {
  if (modal === 'pause') return { title: '歇一会儿', body: `<p>客人会等你。回合已暂停，零钱和订单都在原处。</p><div class="stack" style="margin-top:22px"><button class="btn" data-action="close">继续营业</button><button class="btn secondary" data-action="retry">重开本夜</button><button class="btn secondary" data-action="settings">设置</button><button class="btn secondary" data-action="levels">选择夜晚</button><button class="text-button" data-action="title">保存并返回标题</button></div>` };
  if (modal === 'settings') return { title: '设置', body: `<label class="settings-field">总音量 <input type="range" min="0" max="100" value="${Math.round(progress.settings.master * 100)}" data-setting="master" aria-label="总音量"></label><label class="settings-field">效果音 <input type="range" min="0" max="100" value="${Math.round(progress.settings.effects * 100)}" data-setting="effects" aria-label="效果音"></label><label class="settings-field">降低动态与闪烁 <input type="checkbox" data-setting="reduceMotion" ${progress.settings.reduceMotion ? 'checked' : ''}></label><p style="margin-top:18px">选钱、拒绝、结账、预警与结算有不同声音。设置自动保存到本机。</p><div class="actions"><button class="btn secondary" data-action="sound-test">试听效果音</button><button class="btn" data-action="close">完成</button></div>` };
  if (modal === 'help') return { title: '一盘零钱，八位客人', wide: true, body: `<p>小食每份3元，每位客人付10元。用手头的钱找回7元，连续完成八位客人的订单。</p><ul class="modal-list"><li><strong>真实面额，两种找法。</strong>一张5元加两枚1元，或七枚1元。10元纸币放收入格，不能用来找7元。</li><li><strong>先找零，后入账。</strong>当前客人的付款要等结账后才能使用。开局零钱是此前营业留下的，连续服务从0开始。</li><li><strong>先选客，再选钱。</strong>左键点卡片和钱盘。点已选的钱可收回；回车确认，右键清空草稿。拖动卡片安排顺序，排序本身不推进回合。</li><li><strong>钱盘有容量。</strong>容量计算1元硬币和5元纸币的总张枚数；10元放收入格。入账会装不下时，换找法或选另一位。</li><li><strong>卡片上的约定必须遵守。</strong>“在某人之后”指先后关系，“第N–M客”指服务窗口。客人付款与约定始终公开。</li><li><strong>别在没零钱时接单。</strong>选错金额只会拒绝；完全凑不出7元却确认接单会失败。可达性检查发现余下约定无解时，也会说明原因。</li><li><strong>暂停与重试。</strong>Esc暂停。重开本夜恢复关前初态，分支收入不保留。通关后可比较递出的总张枚数。</li></ul><div class="actions"><button class="btn" data-action="close">明白了</button></div>` };
  if (modal === 'intro') return { title: `第${String(level.number).padStart(2, '0')}夜 · ${level.name}`, body: `<div class="eyebrow">${level.district}</div><p style="margin-top:15px">${level.description}</p><div class="modal-stat"><div><strong>8</strong><span>连续服务客人</span></div><div><strong>${cashValue(level.initial)}</strong><span>前客留存 / 元</span></div><div><strong>${level.capacity}</strong><span>零钱盘容量</span></div></div><p>开局零钱：${cashText(level.initial)}。<br>${level.lesson}</p>${level.number === 1 ? '<p style="margin-top:12px">先看一遍收付顺序。你可以暂停，也可以随时打开玩法说明。</p>' : ''}<div class="actions"><button class="btn secondary" data-action="help">查看规则</button><button class="btn" data-action="close">点灯营业</button></div>` };
  if (modal === 'tutorial') {
    const last = state!.events.at(-1)!;
    return { title: '前一位的零钱，下一位的余地', body: `<p>你从旧钱盘递出${changeText(last.change)}，随后才收到${cashText(last.payment)}。</p><div class="modal-stat"><div><strong>${cashValue(last.before.cash)}</strong><span>结账前现金</span></div><div><strong>+3</strong><span>本次净收入</span></div><div><strong>${cashValue(last.after.cash)}</strong><span>结账后现金</span></div></div><p>接下来明确重置到相同初态，刚才这笔收入不会保留。换一位客人先服务，看看付款面额怎样改变后续找法。</p><div class="actions"><button class="btn" data-action="tutorial-reset">回到初态，换一种选择</button></div>` };
  }
  if (modal === 'result') {
    const won = state!.status === 'won';
    return { title: won ? '八位客人，都照顾好了' : '这一单，没能找开', body: `<div class="eyebrow">第${String(level.number).padStart(2, '0')}夜 · ${level.name}</div><div class="modal-stat"><div><strong>${state!.served.length}/8</strong><span>连续服务</span></div><div><strong>${state!.served.length * 3}</strong><span>本夜净收入 / 元</span></div><div><strong>${state!.piecesGiven}</strong><span>递出的张枚数</span></div></div><p>${won ? '每一单都准确收10元、找7元。今夜完成；你也可以再来一遍，试试另一种顺序。' : escape(state!.failure)}</p>${won ? `<p>当前最佳：${progress.best[level.id]}张/枚。效率记录只作比较，不影响通关。</p>` : `<p style="margin-top:12px">触发事件：${escape(state!.failureEventId)}<br>尚缺 ${8 - state!.served.length} 位成功服务。重试会恢复本夜初态。</p>`}<div class="actions"><button class="btn secondary" data-action="ledger">复盘账本</button><button class="btn" data-action="${won ? level.number === 12 ? 'ending' : 'next' : 'restart'}">${won ? level.number === 12 ? '收摊，看结局' : '下一夜' : '重试本夜'}</button></div><div class="actions"><button class="text-button" data-action="levels">选择夜晚</button>${won ? '<button class="text-button" data-action="restart">再试一种找法</button>' : ''}</div>` };
  }
  if (modal === 'new') return { title: '重新点亮第一盏灯？', body: '<p>新游戏会重置本机已解锁夜晚、最佳记录和当前进度，声音设置保留。</p><div class="actions"><button class="btn secondary" data-action="close">保留进度</button><button class="btn" data-action="confirm-new">开始新游戏</button></div>' };
  if (modal === 'retry') return { title: '重开这一夜？', body: '<p>恢复本夜开局零钱和全部客人。当前分支收入与动作会清除，已完成夜晚的记录保留。</p><div class="actions"><button class="btn secondary" data-action="close">继续当前营业</button><button class="btn" data-action="restart">重开本夜</button></div>' };
  return { title: '今夜账本', wide: true, body: `<p>初始留存：${cashText(level.initial)}。每次成功收付，现金净增3元。</p><div class="ledger-list" style="margin-top:20px">${state?.events.length ? state.events.map(event => `<article class="ledger-entry"><strong>第${event.cycle}回合 · ${escape(level.guests.find(guest => guest.id === event.target)?.name ?? event.target)}</strong><p>${escape(event.reason)}</p><div>找出：${changeText(event.change)}<br>收入：${cashText(event.payment)}<br>之后：${cashText(event.after.cash)}</div><small>${escape(event.id)}</small></article>`).join('') : '<p>还没有结账记录。选客与调整草稿不记为交易。</p>'}</div><div class="actions"><button class="btn" data-action="close">返回</button></div>` };
}

function openModal(next: NonNullable<typeof modal>): void {
  if (modal !== next && (next === 'help' || next === 'settings' || next === 'ledger')) returnModal = modal;
  else returnModal = null;
  modal = next;
  if (scene) scene.paused = true;
  audio.pause();
  const content = modalContents();
  const canClose = next !== 'result' && next !== 'tutorial';
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal ${content.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-top"><h2 id="modal-title">${content.title}</h2>${canClose ? iconButton('close', 'close', '关闭窗口') : ''}</div>${content.body}</section></div>`;
  modalRoot.querySelector<HTMLButtonElement>('button:not(.icon-btn)')?.focus();
}
function closeModal(): void {
  if (modal === 'result' || modal === 'tutorial') return;
  if (returnModal) { const previous = returnModal; returnModal = null; openModal(previous); return; }
  modal = null; modalRoot.innerHTML = '';
  if (scene) scene.paused = false;
  audio.unlock();
  if (page === 'game') document.querySelector<HTMLButtonElement>('#submit')?.focus({ preventScroll: true });
}

function action(name: string, button?: HTMLElement): void {
  audio.unlock();
  switch (name) {
    case 'title': if (state) persist(); page = 'title'; render(); break;
    case 'levels': if (state) persist(); page = 'levels'; render(); break;
    case 'new': openModal('new'); break;
    case 'confirm-new': { const settings = progress.settings; progress = defaultProgress(); progress.settings = settings; state = null; startLevel(LEVELS[0].id); break; }
    case 'continue': continueGame(); break;
    case 'start': startLevel(button!.dataset.level!); break;
    case 'next': startLevel(LEVELS[level.number].id); break;
    case 'restart': startLevel(level.id); break;
    case 'ending': page = 'ending'; render(); break;
    case 'tutorial-reset': progress.tutorialDone = true; startLevel(level.id, false); tutorialStage = 'free'; selectedId = level.guests[1].id; refreshGame(); persist(); break;
    case 'guest': selectedId = button!.dataset.guest!; draft = { ones: 0, fives: 0 }; audio.play('select'); refreshGame(); break;
    case 'coin1': addCash('ones'); break;
    case 'note5': addCash('fives'); break;
    case 'remove1': draft.ones = Math.max(0, draft.ones - 1); refreshGame(); break;
    case 'remove5': draft.fives = Math.max(0, draft.fives - 1); refreshGame(); break;
    case 'clear': draft = { ones: 0, fives: 0 }; refreshGame(); break;
    case 'submit': submit(); break;
    case 'pause': if (state?.status === 'playing') openModal('pause'); break;
    case 'settings': openModal('settings'); break;
    case 'help': openModal('help'); break;
    case 'ledger': openModal('ledger'); break;
    case 'retry': openModal('retry'); break;
    case 'close': closeModal(); break;
    case 'sound-test': audio.play('commit'); break;
  }
}

document.addEventListener('click', event => {
  const target = (event.target as Element).closest<HTMLElement>('[data-action]');
  if (!target || target instanceof HTMLButtonElement && target.disabled) return;
  if (modal && !modalRoot.contains(target)) return;
  action(target.dataset.action!, target);
});
document.addEventListener('input', event => {
  const target = event.target as HTMLInputElement;
  const setting = target.dataset.setting;
  if (setting === 'master' || setting === 'effects') progress.settings[setting] = Number(target.value) / 100;
  else if (setting === 'reduceMotion') progress.settings.reduceMotion = target.checked;
  else return;
  applySettings(); persist();
});
document.addEventListener('keydown', event => {
  if (event.code === 'Tab' && modal) {
    const focusables = [...modalRoot.querySelectorAll<HTMLElement>('button:not(:disabled),input')];
    const first = focusables[0]; const last = focusables.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    return;
  }
  if (!['Enter', 'NumpadEnter', 'Escape'].includes(event.code)) return;
  if (heldKeys.has(event.code) || event.repeat) { event.preventDefault(); return; }
  heldKeys.add(event.code);
  if (event.code === 'Escape') {
    event.preventDefault();
    if (modal) closeModal(); else if (page === 'game') action('pause');
  } else if (page === 'game' && !modal) { event.preventDefault(); audio.unlock(); submit(); }
}, true);
document.addEventListener('keyup', event => heldKeys.delete(event.code));
document.addEventListener('contextmenu', event => { if (page === 'game' && !modal) { event.preventDefault(); action('clear'); } });
window.addEventListener('blur', () => { heldKeys.clear(); if (page === 'game' && !modal && state?.status === 'playing') openModal('pause'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && page === 'game' && !modal && state?.status === 'playing') openModal('pause'); });
window.addEventListener('pagehide', () => persist());
document.addEventListener('dragstart', event => {
  const card = (event.target as Element).closest<HTMLElement>('[data-guest]');
  if (modal || !card || state?.served.includes(card.dataset.guest!)) { event.preventDefault(); return; }
  dragId = card.dataset.guest!; event.dataTransfer?.setData('text/plain', dragId);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
});
document.addEventListener('dragover', event => {
  const card = (event.target as Element).closest<HTMLElement>('[data-guest]');
  if (dragId && card && !modal) { event.preventDefault(); card.classList.add('drag-over'); }
});
document.addEventListener('dragleave', event => (event.target as Element).closest('[data-guest]')?.classList.remove('drag-over'));
document.addEventListener('drop', event => {
  const card = (event.target as Element).closest<HTMLElement>('[data-guest]');
  if (!card || !dragId || modal) return;
  event.preventDefault();
  const from = queueOrder.indexOf(dragId); const to = queueOrder.indexOf(card.dataset.guest!);
  if (from >= 0 && to >= 0) { queueOrder.splice(from, 1); queueOrder.splice(to, 0, dragId); toast('顺序已调整；还没有接单，也不消耗回合。'); }
  dragId = null; refreshGame();
});
document.addEventListener('dragend', () => { dragId = null; document.querySelectorAll('.drag-over').forEach(element => element.classList.remove('drag-over')); });

Object.defineProperty(window, 'nightMarketDiagnostics', { value: () => ({ page, modal, levelId: level.id, state: state ? structuredClone(state) : null, draft: { ...draft }, queueOrder: [...queueOrder], progress: structuredClone(progress), metrics: scene?.metrics() ?? null, storageNotice: store.notice, rules: 'rmb-1' }), writable: false });
render();

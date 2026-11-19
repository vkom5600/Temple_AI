// Layout check: opens every screen and popup at desktop, tablet and phone sizes in
// headless Chrome and reports
//   - text that overlaps other text (like a squashed row)
//   - pages wider than the screen (sideways scrolling)
//   - JavaScript errors
//
// Run with the backend and frontend dev servers running, and the demo data loaded:
//   cd frontend && npm run check:layout
// Options (environment variables):
//   LAYOUT_BASE    the website, default http://localhost:5173
//   DEMO_PASSWORD  default: read from backend/.env
//   CHROME_PATH    default: the usual Chrome location for Mac, Windows or Linux
//   ONLY           only pages whose name contains this text, e.g. ONLY=calendar
// Exits with 1 if anything is found, so it can run before a push.

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir, platform } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.LAYOUT_BASE || 'http://localhost:5173'
const PORT = 9555
const CHROME = process.env.CHROME_PATH || {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
}[platform()] || 'google-chrome'

const envFile = new URL('../../backend/.env', import.meta.url)
const PASSWORD = process.env.DEMO_PASSWORD ||
  (existsSync(envFile) && readFileSync(envFile, 'utf8').match(/^DEMO_PASSWORD=(.*)$/m)?.[1]?.trim()) || 'Temple@1234'

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 1024, height: 768 },
  phone: { width: 390, height: 844 },
}
const ALL = ['desktop', 'tablet', 'phone']

// Click helpers that run in the page.
const clickText = (text) => `[...document.querySelectorAll('button, a')].find((b) => b.textContent.trim().includes(${JSON.stringify(text)}))?.click()`
const clickSel = (sel) => `document.querySelector(${JSON.stringify(sel)})?.click()`
// Open Plan with AI and send one message (steps, so other steps can follow)
const wait = (ms) => `await new Promise((r) => setTimeout(r, ${ms}))`
const planSteps = (text) => `${clickText('Plan with AI')}; ${wait(600)}; const i = document.querySelector('.plan-ask input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(text)}); i.dispatchEvent(new Event('input', { bubbles: true })); ${wait(100)}; document.querySelector('.plan-send').click(); ${wait(1500)}`
const planChat = (text) => `(async () => { ${planSteps(text)} })()`

// [name, path, account, viewports, action to open a popup]
const PAGES = [
  ['sign in', '/login', null, ALL],
  ['join', '/register', null, ALL],
  ['join (short link)', '/join', null, ['phone']],
  ['book a hall (public)', '/book', null, ['phone', 'tablet', 'desktop']],
  ['join: temple rules', '/join', null, ['phone', 'desktop'], `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Temple Rules')?.click()`],
  ['staff: notifications', '/staff', 'anil', ['phone'], clickSel('.m-bell')],
  ['staff: ask a question', '/staff', 'anil', ['phone'], clickText('Ask a question')],
  ['home', '/admin', 'raghu', ALL],
  ['home: broadcast', '/admin', 'raghu', ['desktop', 'tablet'], clickText('Broadcast')],
  ['home: plan with AI', '/admin', 'raghu', ['desktop', 'tablet'], planChat('Navratri garba night, 300 people, Sat 12 Dec')],
  ['home: plan with AI draft', '/admin', 'raghu', ['desktop', 'tablet'], `(async () => { ${planSteps('Navratri garba night, 300 people, Sat 12 Dec')}; for (const b of document.querySelectorAll('.suggest-acts .btn-saf')) b.click(); ${wait(300)}; ${clickSel('.plan-bar')}; ${wait(400)}; if (!document.querySelector('.plan-tile')) throw new Error('draft plan did not open') })()`],
  ['home: plan from last time', '/admin', 'raghu', ['desktop', 'tablet'], `(async () => { ${planSteps('Diwali celebration, 250 people, Mon 1 Nov 2027')}; ${clickText("See last time's plan")}; ${wait(300)}; if (!document.querySelector('.ly-card')) throw new Error('last time plan did not open') })()`],
  ['home: ask AI', '/admin', 'raghu', ['desktop', 'tablet'], clickSel('.ask-ai')],
  ['action center', '/admin/action-center', 'raghu', ALL],
  ['action center: booking review', '/admin/action-center', 'raghu', ['desktop', 'tablet'], clickSel('.attn-row .tile-ic.ic-ind ~ .grow .attn-name button')],
  ['tasks today', '/admin/tasks', 'raghu', ALL],
  ['tasks: new task', '/admin/tasks', 'raghu', ALL, clickText('New task')],
  ['tasks: details', '/admin/tasks', 'raghu', ALL, clickSel('.t-title button')],
  ['action center: done today', '/admin/action-center', 'raghu', ['desktop', 'phone'], `(async () => { ${clickSel('.done-toggle')}; await new Promise((r) => setTimeout(r, 500)); ${clickSel('[role="button"][aria-expanded]')} })()`],
  ['tasks upcoming', '/admin/tasks?tab=upcoming', 'raghu', ['desktop', 'tablet']],
  ['tasks all', '/admin/tasks?tab=all', 'raghu', ALL],
  ['calendar month', '/admin/calendar', 'raghu', ALL],
  ['calendar: add', '/admin/calendar', 'raghu', ALL, clickText('Add to calendar')],
  ['calendar: day', '/admin/calendar', 'raghu', ['desktop', 'tablet'], clickSel('.mcal-day.today')],
  ['calendar: festivals', '/admin/calendar', 'raghu', ['desktop', 'phone'], `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Festivals')?.click()`],
  ['calendar allocation', '/admin/calendar', 'raghu', ['desktop', 'tablet'], `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Allocation')?.click()`],
  ['people', '/admin/people', 'raghu', ALL],
  ['people: person', '/admin/people', 'raghu', ['desktop', 'tablet'], clickSel('tr.prow')],
  ['people: person menu', '/admin/people', 'raghu', ['desktop', 'phone'], `(async () => { ${clickSel('tr.prow')}; await new Promise((r) => setTimeout(r, 500)); ${clickSel('.kebab .icon-btn')} })()`],
  ['people: remove person', '/admin/people', 'raghu', ['desktop', 'phone'], `(async () => { ${clickSel('tr.prow')}; await new Promise((r) => setTimeout(r, 500)); ${clickSel('.kebab .icon-btn')}; await new Promise((r) => setTimeout(r, 500)); ${clickText('Remove person')} })()`],
  ['people: sign-up window', '/admin/people', 'raghu', ['desktop', 'tablet', 'phone'], clickSel('.reg-card .link-btn')],
  ['people: sign-up QR code', '/admin/people', 'raghu', ['desktop', 'phone'], clickText('Show QR code')],
  ['people: sign-ups', '/admin/people?review=signups', 'raghu', ALL],
  ['reports', '/admin/reports', 'raghu', ALL],
  ['reports: activity log', '/admin/reports', 'raghu', ['desktop', 'tablet'], clickText('Activity log')],
  ['temple rules', '/admin/rules', 'raghu', ALL],
  ['temple rules: upload', '/admin/rules', 'raghu', ['desktop', 'phone'], clickText('Upload rules document')],
  ['people: committee access', '/admin/people', 'raghu', ['desktop', 'phone'], `[...document.querySelectorAll('tr.prow')].find((r) => r.textContent.includes('Meena'))?.click()`],
  ['attendance records', '/admin/attendance', 'raghu', ['desktop', 'tablet']],
  ['issue history', '/admin/issues', 'raghu', ['desktop', 'tablet']],
  ['settings', '/admin/settings', 'raghu', ['desktop', 'tablet']],
  ['committee home', '/admin', 'meena', ['desktop', 'phone']],
  ['committee: person', '/admin/people', 'meena', ['desktop', 'phone'], clickSel('tr.prow')],
  ['staff phone (priest)', '/staff', 'anil', ['phone', 'tablet']],
  ['staff: open task', '/staff', 'anil', ['phone'], `(async () => { ${clickText("I'm here")}; await new Promise((r) => setTimeout(r, 1200)); ${clickText('Start')} })()`],
  ['staff: done today', '/staff', 'anil', ['phone'], `(async () => { ${clickSel('.done-today')}; await new Promise((r) => setTimeout(r, 500)); ${clickSel('.m-task.done .m-task-head')} })()`],
  ['staff phone (volunteer)', '/staff', 'priya', ['phone']],
  ['staff: book a hall', '/staff/book', 'priya', ['phone', 'tablet']],
  ['staff: my bookings', '/staff/bookings', 'priya', ['phone']],
]

// ---------------------------------------------------------------- the check that runs in the page

const CHECK = `(() => {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) {
    problems.push('page is ' + document.documentElement.scrollWidth + 'px wide on a ' + vw + 'px screen (sideways scrolling)');
  }
  // Only check the top popup if one is open (the page behind is covered)
  const modals = [...document.querySelectorAll('.modal')];
  const root = modals.length ? modals[modals.length - 1] : document.body;

  const visible = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      if (e.getAttribute('aria-hidden') === 'true') return false;
    }
    return true;
  };
  // The part of a box you can actually see, after ancestors that hide overflow
  const clip = (rect, el) => {
    let r = { l: rect.left, t: rect.top, r: rect.right, b: rect.bottom };
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) { // includes the element itself (e.g. ellipsis)
      const cs = getComputedStyle(e);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const p = e.getBoundingClientRect();
        r = { l: Math.max(r.l, p.left), t: Math.max(r.t, p.top), r: Math.min(r.r, p.right), b: Math.min(r.b, p.bottom) };
      }
    }
    return r.r > r.l && r.b > r.t ? r : null;
  };

  const boxes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.trim();
    if (!text) continue;
    const el = n.parentElement;
    if (!el || !visible(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const rect of range.getClientRects()) {
      if (rect.width < 1 || rect.height < 1) continue;
      const c = clip(rect, el);
      // Open menus float above the page on purpose, so they only count against each other
      if (c) boxes.push({ el, text: text.slice(0, 40), layer: el.closest('[role="menu"], .kebab-menu') ? 'menu' : 'page', ...c });
    }
  }
  const seen = new Set();
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.el === b.el || a.layer !== b.layer) continue;
      const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
      const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (w > 3 && h > 3) {
        const key = a.text + '|' + b.text;
        if (seen.has(key)) continue;
        seen.add(key);
        problems.push('text overlaps: "' + a.text + '" and "' + b.text + '"');
      }
    }
  }
  return problems.slice(0, 12);
})()`

// ---------------------------------------------------------------- Chrome over the DevTools protocol

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login(account) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${account}@temple.demo`, password: PASSWORD }),
  })
  const body = await r.json()
  if (!body.token) throw new Error(`Couldn't sign in as ${account}@temple.demo: ${body.message}`)
  return body.token
}

async function main() {
  const tokens = {}
  for (const a of [...new Set(PAGES.map((p) => p[2]).filter(Boolean))]) tokens[a] = await login(a)

  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'layout-'))}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
  let target
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(200)
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page') } catch { /* starting */ }
  }
  if (!target) throw new Error(`Couldn't start Chrome at ${CHROME}. Set CHROME_PATH.`)
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r))
  let id = 0
  const pending = new Map()
  let pageErrors = []
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] ?? m.params.exceptionDetails.text)
  })
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
  await send('Page.enable')
  await send('Runtime.enable')

  let failures = 0
  let checked = 0
  for (const [name, path, account, viewports, action] of PAGES) {
    if (process.env.ONLY && !name.includes(process.env.ONLY)) continue
    for (const vp of viewports) {
      const { width, height } = VIEWPORTS[vp]
      pageErrors = []
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 })
      await send('Page.navigate', { url: `${BASE}/login` })
      await sleep(600)
      await send('Runtime.evaluate', { expression: account ? `localStorage.setItem('temple_ai_token', ${JSON.stringify(tokens[account])})` : 'localStorage.clear()' })
      await send('Page.navigate', { url: BASE + path })
      await sleep(2200)
      if (action) {
        const r = await send('Runtime.evaluate', { expression: action, awaitPromise: true })
        if (r.result?.exceptionDetails) pageErrors.push(`couldn't open the popup: ${r.result.exceptionDetails.exception?.description?.split('\n')[0] ?? r.result.exceptionDetails.text}`)
        await sleep(1500)
      }
      const result = await send('Runtime.evaluate', { expression: CHECK, returnByValue: true })
      const problems = [...(result.result?.result?.value ?? ['(check failed to run)']), ...pageErrors.map((e) => `page error: ${e}`)]
      checked++
      if (problems.length) {
        failures++
        console.log(`✗ ${name} · ${vp}`)
        for (const p of problems) console.log(`    ${p}`)
      } else {
        console.log(`✓ ${name} · ${vp}`)
      }
    }
  }
  ws.close()
  chrome.kill()
  console.log(`\n${checked - failures} of ${checked} screens clean${failures ? `, ${failures} with problems` : ''}.`)
  process.exit(failures ? 1 : 0)
}

main().catch((err) => { console.error(err.message); process.exit(2) })

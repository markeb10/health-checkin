const CACHE_NAME = 'health-checkin-v92';
// v92 (2026-06-12): morning check-in changes - supplement names fixed to Marko's real ones
//   (Vitamin C + MG + CA etc, built-ins always active) + 6 new panel-added AM fields
//   (heart racing on standing, chest symptom, trigger-food, rumination, regulation-practice, BP).
//   Cache bumped so clients fetch the new index.html instead of the stale v91 copy.
// v91 (2026-05-12): TWO post-screenshot fixes from Marko's "Izračunano shows '-' and buttons not highlighted" report.
//   (a) calcSleepEff() now runs inside loadFields() right after refreshCsiNumStates(). Pre-v91 the calc only fired
//       on input events, so navigating to a date with already-saved bedtime/wake values showed "-" until you typed.
//   (b) Discovered + documented a much bigger bug while debugging: TWO data dirs exist for check-in JSONs:
//       * health-checkin/data/checkins/  = served to PWA (HTTP read)
//       * health_centre/data/checkins/   = CANONICAL (server merge reads from here)
//       Any Python backfill written to only one dir gets overwritten on the next phone POST because the merge
//       compares incoming against canonical. v91 doesn't change the server code but the team now writes to BOTH
//       dirs and the lesson is in memory (pwa_two_data_dirs.md). Verified merge correctly preserves with both
//       dirs in sync: null POST keeps existing '3' values for q10/q11/woke_earlier.

// v90 (2026-05-11): Full Vita sleep diary revision after Marko's "white text on white background, hard to read,
// revise calculations and test the whole thing" feedback.
//   (a) Izračunano box: was background:#eef4f9 (near-white) + color:var(--text)=#E8E2DA (light cream for dark mode)
//       = light-on-light, unreadable on Marko's actual theme. Replaced with theme-aware blue/gold gradient,
//       contrast-friendly text, gold-colored bold values that pop, color-coded efficiency (green ≥85% CBT-i target,
//       gold 80-84%, red <80% with "skrči okno spanja" CBT-i hint), and a red warning row for invalid inputs.
//   (b) calcSleepEff hardened with validation rules: TIB outside [3h,16h] warns, bedtime→sleep_attempt gap >6h
//       warns, latency+WASO>sleep_window clamps TST to 0 + warns. Negative numeric inputs sanitized to 0.
//   (c) Playwright end-to-end test covers: standard night (22:00→06:45 = 7h12 / 82.3%), midnight crossing
//       (23:30→04:30 = 3h50 / 76.7%), 6h efficiency (deep), latency+WASO>window edge, button clicks for q10/q11/
//       woke_earlier persist to localStorage + server JSON, calc text is dark-mode readable.
// v89 (2026-05-11): TWO fixes after Marko reported v88 still broken on his devices + flagged wrong sleep math.
// (a) calcSleepEff() rewritten to Morin Consensus Sleep Diary (CSD-M) formula. Old formula computed
//     TST = TIB - latency - WASO - afterWake which is wrong: it double-subtracts the bedtime→sleep_attempt
//     gap and treats TIB as the sleep window. With sample 22:00 bedtime / 22:30 sleep attempt / 18 min
//     latency / 30 min WASO / 06:30 final wake / 06:45 get-up, old code returned 7h42 / 88.0%. Correct
//     answer is 7h12 / 82.3%. New formula: TIB = get_up - bedtime, sleep window = final_wake - sleep_attempt,
//     TST = sleep_window - latency - WASO, SE = TST/TIB*100.
// (b) selectCsiNum() now also writes the value directly to localStorage (in addition to calling autoSave)
//     so a Vita button click is never lost to the active-section guard inside captureFieldsToStorage()
//     or the 100ms _loadingFields race window after page load. Same single-source-of-truth model, but
//     with a redundant local-only write that the syncPush picks up on the next debounce.
// v88 (2026-05-11): CRITICAL BUG FIX - Vita sleep diary tap-button fields were silently NOT saving (vita_sleep_quality_5pt, vita_refreshed_5pt, vita_woke_earlier_than_planned, possibly others). selectCsiNum() looked for the hidden input only inside .csi-signal-row ancestor - the Vita sleep diary fields don't use that wrapper, so input lookup returned null and autoSave never fired. Fix: fallback to grid.parentElement then document-wide query for the matching data-field. Same bug existed in refreshCsiNumStates() which only iterated .csi-signal-row containers - now iterates ALL .csi-num-grid elements. Affected days: every diary entry since v82 (2026-05-08 introduction of Vita diary). Old values are NULL in JSONs and DB - can be partially recovered by re-asking Marko those questions for past nights if he remembers, but most are lost.
// v87 (2026-05-10): bump to force SW invalidation - v86 wasn't picked up by Marko's PWA quickly. Hardened cleanup snippet now runs on EVERY page load (idempotent, ~3ms cost): for each daily-checkin localStorage key, if evening_saved_at exists and parses to a date BEFORE the key's own date, the evening fields are leaked from a prior day - clears them. Catches the 5/9→5/10 leak AND future similar leaks. Also adds [PWA cleanup vN] console marker so Marko can verify v87 active in dev tools.
// v86 (2026-05-10): one-time cleanup snippet for the 2026-05-09 → 2026-05-10 evening-leak PWA bug. When Marko filled Saturday evening at 22:03 local CEST (20:03 UTC), the PWA wrote evening data to BOTH 2026-05-09 and 2026-05-10 localStorage keys (and JSON files). 14 fields contaminated in May 10 (evening_notes, mood_evening, energy_evening, pain_evening, evening_saved_at, amazing_raw, could_be_better, done_today, ideas_raw, parr_exercises, worry_dump, other_movement, location_evening, evening_supplements). Server JSONs cleaned manually 21:53 local. PWA cleanup snippet in index.html top-of-script clears the leaked localStorage on next load - detects by signature (evening_saved_at === '2026-05-09T20:03:48.904Z'), idempotent. Bumping cache version forces PWA refresh on Marko's phone so the cleanup snippet runs.
// v85 (2026-05-08): added 📔 Journal card to morning intake (4-prompt textarea: feeling / bothering / avoiding / want) + 📜 Marcus Aurelius daily reading card (passages reference + reflection textarea). Fields: journal_morning, meditations_passages, meditations_reflection. Placed after Daily affirmation, before Photos of the day. Marko's plan: 3 passages of Meditations per day starting Book 2.11.
// v84 (2026-05-08): CRITICAL BUG FIX - captureFieldsToStorage was overwriting cloud-saved slider values with HTML defaults (5/5/5 for sleep/mood/energy). Sequence: Phone saves morning at 7am → Mac opens PWA in evening → Mac's localStorage doesn't have today's data yet → DOM renders HTML defaults → user types anything → autoSave fires before syncPull completes → 5/5/5 gets pushed back to cloud, overwriting Phone-saved values. Fix: guard in captureFieldsToStorage skips writing range/number fields that are at HTML default AND were NOT touched in this session AND already have a stored value in localStorage. Affected days verified: May 7, May 3, Apr 30 all had 5/5/5 (and likely earlier days too). Old cloud data is unrecoverable but new days will save correctly.
// v83 (2026-05-08): Vita's sleep diary made PERMANENT.
// v82 (2026-05-08): added Vita Štukovnik sleep diary card to morning intake (CBT-i, initial 2-week prescription). 17 fields: bedtime, sleep attempt time, latency, awakening count + total min, final wake time, time after final wake, woke earlier (DA/NE), get up time, auto-calculated sleep efficiency, sleep quality 5pt, refreshed 5pt, nap count + total min, alcohol + caffeine count, sleep meds notes, other notes. JS calcSleepEff() auto-computes total sleep / total in bed / efficiency from time inputs. Fields prefixed vita_*.
// v81 (2026-05-06): added 2 thermoregulation rows to morning symptoms card - feverish_am + cold_am. Captures both sides of sympathetic / post-viral / mast-cell thermoregulatory swings. Today's fever onset (May 6) was the prompt.
// v80 (2026-05-06): morning intake gets dedicated 🌅 morning symptoms card with 8 overnight-signal items as 0-10 tappable buttons (throat tightness AM, acidity AM, jaw soreness AM, restless legs last night, heart racing on waking, body stiffness AM, tinitus AM, dyshidrotic flare). Moved restless_legs and jaw_soreness rows OUT of evening CSI panel where they were misplaced - they're truly morning signals. Field names preserved for DB compatibility (restless_legs_score, jaw_soreness_am_score). New field names: throat_tightness_am, acidity_am, heart_racing_am, am_stiffness_score, tinitus_am_score, dyshidrotic_am. Existing evening parallels remain: acidity_score (PM), throat_tightness (PM).
// v79 (2026-05-03): auto cross-device sync - syncPull now fires on visibilitychange + focus + every 30s polling. Both devices stay in sync without manual button.
// v78 (2026-05-03): rewrote syncPull conflict logic - trust timestamps over content scores (server already merges field-level on POST). Tap version footer → 3-button menu (Sync now / Force update / Check version). Bidirectional cross-device sync should now work cleanly.
// v77 (2026-05-03): defensive SW + visible prominent version footer + tap-to-diagnose. Handles insecure context (LAN HTTP) gracefully.
// v76 (2026-05-03): visible version footer + aggressive SW update check on every page load.
// v75 (2026-05-03): added pullDayFromLocalServer() - syncPull now tries the same-origin server FIRST (no GitHub token needed). Fixes cross-device load on phone when GitHub auth not configured. Mac saves → phone loads via direct /data/checkins/{date}.json fetch from same monitor server.
// v74 (2026-05-03): added 🌙 location card to evening section (location_evening field). Sticky from morning location, then yesterday's evening, then yesterday's morning. Improved detectLocation with: secure-context check (LAN HTTP fails silently in Brave/Chrome - now warns explicitly), Brave fingerprint-protection accuracy detection (>50km = fuzzed), better Brave-specific error messages for permission denied / position unavailable.
// v72 (2026-05-03): added 🧠 CSI/psychometrics banner that shows once per month after monthly calc fires. Reads data/csi_latest.json. Dismiss persists in localStorage per date.
// v73 (2026-05-03): redesigned CSI signals panel - replaced cramped 4-col slider grid with mobile-friendly tappable 0-10 number buttons (one row per symptom). Tap-to-select with visual highlight; tap-already-selected to reset. Same hidden input data-field mechanism preserved for sync compatibility.
// v69 (2026-05-02): added location card to morning section, sticky from yesterday, 📍 detect button via OpenStreetMap Nominatim
// v70 (2026-05-03): added Movement/exercise card to evening section with parr_exercises + other_movement free-text fields
// v71 (2026-05-03): CSI-aligned morning intake. Added Stress + Headache to main slider stack. Pain body map: Neck/shoulder, Jaw, Knee. New collapsible 🧠 CSI signals panel with brain_fog, memory, skin_itch, light/smell sensitivity, bladder, urinate freq, restless legs, jaw soreness AM, anxiety attack acute. After 30 days, every CSI question has a data trail.
const ASSETS = ['./index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// Listen for explicit skip-waiting message from the page (used when a new SW
// is detected after install but before activate)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network-first strategy: try network, fall back to cache
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});

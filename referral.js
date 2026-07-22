/* ============================================================================
 * Junegrass — On-brand referral share overlay (KickoffLabs "Homestead Rewards")
 * ----------------------------------------------------------------------------
 * PURELY ADDITIVE. Does not touch the site bundle, the Klaviyo capture, the
 * Meta `Lead` event, UTM capture, or the flavor-vote metric. It only:
 *   1) lets KickoffLabs' kol.js (AnyForm, campaign 195119) register the lead
 *      + mint the referral link + sync to Klaviyo (its tested job),
 *   2) suppresses kol.js's redirect to the generic hosted status page, and
 *   3) renders a Junegrass-branded share view on our own page instead.
 * ========================================================================== */
(function () {
  "use strict";

  var CAMPAIGN_ID = "195119";
  var SHARE_MESSAGE =
    "I just joined the Junegrass Homestead — a daily 5-fiber blend for a calmer, more regular gut. Get first crack at the founding drop:";

  // People already on the Klaviyo waitlist before the KickoffLabs referral
  // launch (they aren't counted in KickoffLabs). Added to each new signup's
  // KickoffLabs position so the "You're #X on the founding list" number
  // reflects the true total. Update this if the pre-launch count changes.
  var WAITLIST_BASE = 169;

  /* ---- Brand tokens (sampled from the live site) ------------------------- */
  var C = {
    bgDark: "#372619",
    inkDeep: "#2C1D12",
    ink: "#5A3D25",
    parchment: "#F4EAD3",
    parchmentEdge: "#EADFC2",
    sand: "#DFC796",
    border: "#C6A268",
    rust: "#B4451A",
    gold: "#E0A93F",
    goldDeep: "#D28E2A",
    olive: "#7A7A30"
  };
  var F = {
    script: '"JG Pinyon", "Pinyon Script", cursive',
    display: '"JG Anton", "Anton", sans-serif',
    serif: '"JG Newsreader", "Newsreader", Georgia, serif'
  };

  var REWARDS = [
    { n: 1, label: "Homesteader status", detail: "First crack at the founding drop + your Founding-Member badge." },
    { n: 3, label: "Free shipping", detail: "Free shipping on your founding order." },
    { n: 5, label: "Founding jar on the house", detail: "Buy your founding jar and we’ll send a second one free." }
  ];

  var state = { submitted: false, shown: false, lead: null };

  /* ---- Styles ------------------------------------------------------------ */
  function injectStyles() {
    if (document.getElementById("jg-referral-styles")) return;
    var css =
      '#jg-referral-overlay{position:fixed;inset:0;z-index:2147483000;display:none;align-items:flex-start;justify-content:center;overflow-y:auto;' +
      'background:radial-gradient(120% 120% at 50% 0%, rgba(74,52,33,.72), rgba(24,16,10,.92));' +
      '-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);padding:40px 18px;box-sizing:border-box;}' +
      '#jg-referral-overlay.jg-open{display:flex;}' +
      '#jg-referral-overlay *{box-sizing:border-box;}' +
      '.jg-card{position:relative;width:100%;max-width:560px;margin:auto;background:' + C.parchment + ';' +
      'border:1px solid ' + C.border + ';border-radius:16px;padding:38px 34px 30px;' +
      'box-shadow:0 30px 80px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.35);' +
      'animation:jgpop .45s cubic-bezier(.2,.9,.3,1) both;}' +
      '.jg-card:before{content:"";position:absolute;inset:9px;border:1px solid rgba(198,162,104,.55);border-radius:10px;pointer-events:none;}' +
      '@keyframes jgpop{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}' +
      '.jg-close{position:absolute;top:12px;right:14px;z-index:2;background:none;border:0;cursor:pointer;color:' + C.ink + ';' +
      'font-size:24px;line-height:1;opacity:.6;padding:6px;}' +
      '.jg-close:hover{opacity:1;}' +
      '.jg-wordmark{font-family:' + F.script + ';color:' + C.ink + ';font-size:40px;line-height:1;text-align:center;margin:2px 0 10px;}' +
      '.jg-eyebrow{font-family:' + F.display + ';text-transform:uppercase;letter-spacing:2.4px;font-size:11px;color:' + C.rust + ';text-align:center;margin:0 0 8px;}' +
      '.jg-title{font-family:' + F.serif + ';color:' + C.inkDeep + ';font-size:25px;line-height:1.2;text-align:center;margin:0 0 6px;font-weight:600;}' +
      '.jg-sub{font-family:' + F.serif + ';color:' + C.ink + ';font-size:15px;line-height:1.5;text-align:center;margin:0 auto 20px;max-width:400px;}' +
      '.jg-sub b{color:' + C.rust + ';}' +
      '.jg-linklabel{font-family:' + F.display + ';text-transform:uppercase;letter-spacing:1.8px;font-size:10.5px;color:' + C.ink + ';margin:0 0 7px;}' +
      '.jg-linkrow{display:flex;gap:8px;margin:0 0 18px;}' +
      '.jg-linkinput{flex:1;min-width:0;font-family:' + F.serif + ';font-size:14px;color:' + C.inkDeep + ';background:#FBF5E6;' +
      'border:1px solid ' + C.border + ';border-radius:8px;padding:12px 13px;}' +
      '.jg-copy{flex:0 0 auto;font-family:' + F.display + ';text-transform:uppercase;letter-spacing:1.4px;font-size:11px;color:' + C.parchment + ';' +
      'background:' + C.rust + ';border:0;border-radius:8px;padding:0 18px;cursor:pointer;transition:background .2s, transform .1s;}' +
      '.jg-copy:hover{background:#9c3a15;}' +
      '.jg-copy:active{transform:translateY(1px);}' +
      '.jg-copy.jg-copied{background:' + C.olive + ';}' +
      '.jg-sharelabel{font-family:' + F.display + ';text-transform:uppercase;letter-spacing:1.8px;font-size:10.5px;color:' + C.ink + ';margin:0 0 9px;text-align:center;}' +
      '.jg-share{display:flex;flex-wrap:wrap;gap:9px;justify-content:center;margin:0 0 24px;}' +
      '.jg-sbtn{display:inline-flex;align-items:center;gap:7px;font-family:' + F.display + ';text-transform:uppercase;letter-spacing:1.2px;' +
      'font-size:11px;color:' + C.inkDeep + ';background:#FBF5E6;border:1px solid ' + C.border + ';border-radius:999px;' +
      'padding:9px 14px;cursor:pointer;text-decoration:none;transition:background .18s,border-color .18s;}' +
      '.jg-sbtn:hover{background:#fff;border-color:' + C.goldDeep + ';}' +
      '.jg-sbtn svg{width:15px;height:15px;display:block;}' +
      '.jg-divider{height:1px;background:linear-gradient(90deg,transparent,' + C.border + ',transparent);margin:0 0 20px;}' +
      '.jg-rewardhead{font-family:' + F.display + ';text-transform:uppercase;letter-spacing:1.8px;font-size:10.5px;color:' + C.ink + ';text-align:center;margin:0 0 4px;}' +
      '.jg-progresswrap{margin:0 0 18px;}' +
      '.jg-progresstext{font-family:' + F.serif + ';font-size:13px;color:' + C.ink + ';text-align:center;margin:0 0 8px;}' +
      '.jg-progresstext b{color:' + C.rust + ';}' +
      '.jg-track{height:8px;background:#E4D3AC;border-radius:99px;overflow:hidden;border:1px solid ' + C.border + ';}' +
      '.jg-fill{height:100%;width:0;background:linear-gradient(90deg,' + C.gold + ',' + C.rust + ');border-radius:99px;transition:width .8s cubic-bezier(.2,.9,.3,1);}' +
      '.jg-ladder{list-style:none;margin:0;padding:0;}' +
      '.jg-tier{display:flex;align-items:flex-start;gap:12px;padding:11px 0;border-top:1px dashed rgba(198,162,104,.6);}' +
      '.jg-tier:first-child{border-top:0;}' +
      '.jg-badge{flex:0 0 auto;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
      'font-family:' + F.display + ';font-size:12px;color:' + C.ink + ';background:#EBDDBB;border:1.5px solid ' + C.border + ';margin-top:1px;}' +
      '.jg-tier.done .jg-badge{background:' + C.rust + ';border-color:' + C.rust + ';color:' + C.parchment + ';}' +
      '.jg-tiertext{flex:1;}' +
      '.jg-tiertitle{font-family:' + F.serif + ';font-weight:600;font-size:14.5px;color:' + C.inkDeep + ';margin:0;}' +
      '.jg-tier.done .jg-tiertitle{color:' + C.rust + ';}' +
      '.jg-tierdetail{font-family:' + F.serif + ';font-size:13px;color:' + C.ink + ';margin:2px 0 0;line-height:1.4;}' +
      '.jg-statuslink{display:block;text-align:center;margin:20px 0 0;font-family:' + F.display + ';text-transform:uppercase;' +
      'letter-spacing:1.4px;font-size:10px;color:' + C.ink + ';text-decoration:none;opacity:.75;}' +
      '.jg-statuslink:hover{opacity:1;color:' + C.rust + ';}' +
      '@media (max-width:520px){.jg-card{padding:32px 20px 24px;}.jg-title{font-size:22px;}.jg-linkrow{flex-direction:column;}.jg-copy{padding:12px;}}' +
      // Hide KickoffLabs' generic default widgets (NudgeBar / share badge) — we
      // provide our own on-brand share view instead.
      '#kol-nudge-bar-top-frame,[id^="kol-nudge-bar"],[class*="kol-nudge-bar"],[class*="kol-top-bar"],' +
      '#kol-share-widget,[id^="kol-share"],[class*="kol-share-widget"],[class*="kol-badge"]{display:none !important;}' +
      // Suppress the site's flavor-vote popup while our overlay is open, so it
      // appears only AFTER the referral overlay is closed.
      '.jg-flavor-suppressed{display:none !important;}';
    var el = document.createElement("style");
    el.id = "jg-referral-styles";
    el.textContent = css;
    document.head.appendChild(el);
  }

  /* ---- Icons ------------------------------------------------------------- */
  var ICON = {
    sms: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2Zm5.4 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.4-1.1-2.7 0-1.3.7-1.9.9-2.2.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.6c-.2.2-.3.4-.1.7.2.3.9 1.4 1.9 2.3 1.3 1.1 2.2 1.2 2.5 1.3.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.1.1.6-.1 1.2Z"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6 9 7 9-7"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 2h3.3l-7.2 8.3L23 22h-6.6l-5.2-6.8L5.3 22H2l7.7-8.8L1.7 2h6.8l4.7 6.2L18.2 2Zm-1.2 18h1.8L7.1 3.9H5.2L17 20Z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z"/></svg>'
  };

  /* ---- Build overlay DOM ------------------------------------------------- */
  var refs = {};
  function build() {
    if (document.getElementById("jg-referral-overlay")) return;
    injectStyles();
    var o = document.createElement("div");
    o.id = "jg-referral-overlay";
    o.setAttribute("role", "dialog");
    o.setAttribute("aria-modal", "true");
    o.innerHTML =
      '<div class="jg-card" role="document">' +
        '<button class="jg-close" aria-label="Close">×</button>' +
        '<div class="jg-wordmark">Junegrass</div>' +
        '<p class="jg-eyebrow">You’re on the Homestead</p>' +
        '<h2 class="jg-title" id="jg-title">You’re in — welcome to the founding drop.</h2>' +
        '<p class="jg-sub" id="jg-sub">Now bring the herd. Share your link and climb the founding list — every friend who joins moves you up the reward ladder.</p>' +
        '<p class="jg-linklabel">Your referral link</p>' +
        '<div class="jg-linkrow">' +
          '<input class="jg-linkinput" id="jg-link" readonly value="" />' +
          '<button class="jg-copy" id="jg-copy">Copy link</button>' +
        '</div>' +
        '<p class="jg-sharelabel">Share it</p>' +
        '<div class="jg-share" id="jg-share"></div>' +
        '<div class="jg-divider"></div>' +
        '<p class="jg-rewardhead">The reward ladder</p>' +
        '<div class="jg-progresswrap">' +
          '<p class="jg-progresstext" id="jg-progresstext"></p>' +
          '<div class="jg-track"><div class="jg-fill" id="jg-fill"></div></div>' +
        '</div>' +
        '<ul class="jg-ladder" id="jg-ladder"></ul>' +
        '<a class="jg-statuslink" id="jg-statuslink" target="_blank" rel="noopener">View your status page →</a>' +
      '</div>';
    document.body.appendChild(o);
    refs.overlay = o;
    refs.title = o.querySelector("#jg-title");
    refs.sub = o.querySelector("#jg-sub");
    refs.link = o.querySelector("#jg-link");
    refs.copy = o.querySelector("#jg-copy");
    refs.share = o.querySelector("#jg-share");
    refs.progressText = o.querySelector("#jg-progresstext");
    refs.fill = o.querySelector("#jg-fill");
    refs.ladder = o.querySelector("#jg-ladder");
    refs.statusLink = o.querySelector("#jg-statuslink");

    o.querySelector(".jg-close").addEventListener("click", close);
    o.addEventListener("click", function (e) { if (e.target === o) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    refs.copy.addEventListener("click", doCopy);
  }

  function close() {
    if (refs.overlay) refs.overlay.classList.remove("jg-open");
    document.documentElement.style.overflow = "";
    clearInterval(state.flavorIv);
    showFlavor();
  }

  /* ---- Sequence the site's flavor-vote popup AFTER our overlay ----------- */
  function flavorNodes() {
    var out = [], kids = document.body ? document.body.children : [];
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (el.nodeType !== 1 || el.tagName !== "DIV" || el.id === "jg-referral-overlay") continue;
      var pos = getComputedStyle(el).position;
      if (pos !== "fixed" && pos !== "absolute") continue;
      if (/which pour|peach mango|watermelon lime/i.test(el.textContent || "")) out.push(el);
    }
    return out;
  }
  function hideFlavor() { flavorNodes().forEach(function (el) { el.classList.add("jg-flavor-suppressed"); }); }
  function showFlavor() {
    var els = document.querySelectorAll(".jg-flavor-suppressed");
    for (var i = 0; i < els.length; i++) els[i].classList.remove("jg-flavor-suppressed");
  }

  /* ---- Copy + share ------------------------------------------------------ */
  function doCopy() {
    var url = refs.link.value;
    var done = function () {
      refs.copy.textContent = "Copied!";
      refs.copy.classList.add("jg-copied");
      setTimeout(function () { refs.copy.textContent = "Copy link"; refs.copy.classList.remove("jg-copied"); }, 2200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { legacyCopy(url); done(); });
    } else { legacyCopy(url); done(); }
  }
  function legacyCopy(url) {
    refs.link.focus(); refs.link.select();
    try { document.execCommand("copy"); } catch (e) {}
  }

  function renderShare(url) {
    var msg = SHARE_MESSAGE;
    var eU = encodeURIComponent(url);
    var eMsgU = encodeURIComponent(msg + " " + url);
    var links = [
      { key: "sms", label: "Text", href: "sms:?&body=" + eMsgU },
      { key: "whatsapp", label: "WhatsApp", href: "https://wa.me/?text=" + eMsgU },
      { key: "email", label: "Email", href: "mailto:?subject=" + encodeURIComponent("Join me on the Junegrass Homestead") + "&body=" + eMsgU },
      { key: "x", label: "X", href: "https://twitter.com/intent/tweet?text=" + encodeURIComponent(msg) + "&url=" + eU },
      { key: "facebook", label: "Facebook", href: "https://www.facebook.com/sharer/sharer.php?u=" + eU }
    ];
    refs.share.innerHTML = "";
    links.forEach(function (l) {
      var a = document.createElement("a");
      a.className = "jg-sbtn";
      a.href = l.href;
      if (l.key !== "sms" && l.key !== "email") { a.target = "_blank"; a.rel = "noopener"; }
      a.innerHTML = ICON[l.key] + "<span>" + l.label + "</span>";
      refs.share.appendChild(a);
    });
  }

  function renderLadder(score) {
    refs.ladder.innerHTML = "";
    REWARDS.forEach(function (r) {
      var done = score >= r.n;
      var li = document.createElement("li");
      li.className = "jg-tier" + (done ? " done" : "");
      li.innerHTML =
        '<div class="jg-badge">' + (done ? "✓" : r.n) + '</div>' +
        '<div class="jg-tiertext">' +
          '<p class="jg-tiertitle">' + r.n + " friend" + (r.n > 1 ? "s" : "") + " · " + r.label + "</p>" +
          '<p class="jg-tierdetail">' + r.detail + "</p>" +
        "</div>";
      refs.ladder.appendChild(li);
    });
    var pct = Math.max(0, Math.min(100, (score / 5) * 100));
    refs.fill.style.width = pct + "%";
    var remaining = null;
    for (var i = 0; i < REWARDS.length; i++) { if (score < REWARDS[i].n) { remaining = REWARDS[i].n - score; break; } }
    if (score <= 0) {
      refs.progressText.innerHTML = "Refer <b>1 friend</b> to unlock your first reward.";
    } else if (remaining) {
      refs.progressText.innerHTML = "You’ve referred <b>" + score + "</b> — <b>" + remaining + "</b> more to your next reward.";
    } else {
      refs.progressText.innerHTML = "You’ve referred <b>" + score + "</b> friends — every reward unlocked. Yeehaw.";
    }
  }

  /* ---- Show --------------------------------------------------------------- */
  function showOverlay(lead) {
    build();
    lead = lead || {};
    state.lead = lead;
    var url = lead.url || "";
    refs.link.value = url;
    renderShare(url);
    renderLadder(lead.score || 0);

    if (lead.rank) {
      refs.sub.innerHTML = "You’re <b>#" + lead.rank + "</b> on the founding list. Now bring the herd — every friend who joins moves you up the reward ladder.";
    }
    if (lead.statusUrl) { refs.statusLink.href = lead.statusUrl; refs.statusLink.style.display = "block"; }
    else { refs.statusLink.style.display = "none"; }

    refs.overlay.classList.add("jg-open");
    document.documentElement.style.overflow = "hidden";
    state.shown = true;
    try { refs.overlay.scrollTop = 0; } catch (e) {}

    // Hold the flavor-vote popup back until this overlay is closed. It may
    // render slightly after signup, so re-apply briefly while we're open.
    hideFlavor();
    clearInterval(state.flavorIv);
    var ft = 0;
    state.flavorIv = setInterval(function () {
      ft++;
      if (!refs.overlay.classList.contains("jg-open") || ft > 60) { clearInterval(state.flavorIv); return; }
      hideFlavor();
    }, 250);
  }

  /* ---- Normalize a KickoffLabs lead object into what the overlay needs --- */
  function normalizeLead(raw) {
    if (!raw) return null;
    var l = raw.lead || raw.data || raw.subscriber || raw;
    var url = l.social_url || l.share_url || l.share_link || l.referral_link || l.url || "";
    if (!url) return null;
    var score = firstDefined([l.contest_score, l.referrals, l.score, 0]);
    var count = firstDefined([l.lead_count, l.rank, l.contest_score_rank, null]);
    var rank = (count !== null && count !== undefined) ? (WAITLIST_BASE + Number(count)) : null;
    var statusUrl = l.status_url || l.kol_status_url || "";
    return {
      url: url,
      code: l.social_id || l.social_code || "",
      score: Number(score) || 0,
      rank: rank,
      statusUrl: statusUrl
    };
  }
  function firstDefined(arr) { for (var i = 0; i < arr.length; i++) { if (arr[i] !== undefined && arr[i] !== null && arr[i] !== "") return arr[i]; } return null; }

  /* ---- Read current lead from kol.js as a fallback ----------------------- */
  function tryReadCurrentLead(kol) {
    try {
      var l = kol && kol.lead;
      if (l && (l.social_url || l.share_url)) return normalizeLead(l);
    } catch (e) {}
    return null;
  }

  /* ---- Capture the successful signup from kol.js ------------------------- */
  function handleSuccess(payload) {
    (window.__jgReferralDebug = window.__jgReferralDebug || []).push(payload);
    var lead = normalizeLead(payload) || tryReadCurrentLead(window._kol);
    if (lead) { showOverlay(lead); return true; }
    return false;
  }

  /* ---- Wire up kol.js ---------------------------------------------------- */
  function wireKol(kol) {
    // 1) Suppress the redirect to the generic hosted status page.
    try {
      if (kol.options) { kol.__jgRedirect = kol.options.redirect_url; kol.options.redirect_url = ""; }
      if (kol.campaignOptions && kol.campaignOptions.options) { kol.campaignOptions.options.redirect_url = ""; }
    } catch (e) {}

    // 2) Primary hook: kol.js calls form.handleLeadResponse(response) after the
    //    lead POST resolves. That response carries the full lead (social_url,
    //    contest_score, rank, lead_count, status_url ...) AND a redirect_url to
    //    the generic hosted page. REPLACE it: capture the lead + show our own
    //    on-brand overlay, keep kol.js analytics/caching, and never redirect.
    try {
      var f = kol.form;
      if (f && typeof f.handleLeadResponse === "function" && !f.handleLeadResponse.__jgReplaced) {
        var repl = function (resp) {
          try { handleSuccess(resp); } catch (e) {}
          try { if (kol.leads && typeof kol.leads.sendSuccessEvent === "function") kol.leads.sendSuccessEvent(resp); } catch (e) {}
          try { if (kol.leads && typeof kol.leads.cacheLeadData === "function") kol.leads.cacheLeadData(resp); } catch (e) {}
          // Original handleLeadResponse intentionally NOT called — it performs
          // the off-brand redirect to the hosted kickoffpages status page.
        };
        repl.__jgReplaced = true;
        f.handleLeadResponse = repl;
      }
      if (kol.form) wrap(kol.form, "addLead", function () { state.submitted = true; });
    } catch (e) {}

    // 3) Also listen for any custom success events kol.js may dispatch (once).
    if (!wireKol.__listeners) {
      wireKol.__listeners = true;
      ["kol:lead:created", "kol:success", "KickoffLabsLead", "konvert:lead"].forEach(function (ev) {
        document.addEventListener(ev, function (e) { handleSuccess(e && e.detail); });
        window.addEventListener(ev, function (e) { handleSuccess(e && e.detail); });
      });
    }
  }

  function wrap(obj, name, before) {
    try {
      if (!obj || typeof obj[name] !== "function" || obj[name].__jgWrapped) return;
      var orig = obj[name];
      var w = function () { try { before(arguments); } catch (e) {} return orig.apply(this, arguments); };
      w.__jgWrapped = true;
      obj[name] = w;
    } catch (e) {}
  }

  /* ---- Backup: watch forms + poll for a minted lead after submit --------- */
  function watchForms() {
    document.addEventListener("submit", function () {
      state.submitted = true;
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        if (state.shown) { clearInterval(iv); return; }
        var lead = tryReadCurrentLead(window._kol);
        if (lead) { clearInterval(iv); showOverlay(lead); return; }
        if (tries > 40) clearInterval(iv); // ~12s
      }, 300);
    }, true);
  }

  /* ---- Klaviyo onsite: bind the session (its IP/geolocation) to the profile
   * ---- on signup, so Klaviyo can set Location. Additive: does NOT subscribe
   * ---- or trigger a welcome — the existing client-API call still owns that. */
  function bindKlaviyoIdentify() {
    document.addEventListener("submit", function (e) {
      try {
        var form = e.target;
        var input = (form && form.querySelector) ? form.querySelector('input[type="email"]') : null;
        var email = (input && input.value) ? input.value.trim() : "";
        if (email && email.indexOf("@") > 0) {
          window.klaviyo = window.klaviyo || [];
          window.klaviyo.push(["identify", { "$email": email }]);
        }
      } catch (err) {}
    }, true);
  }

  /* ---- Boot -------------------------------------------------------------- */
  function boot() {
    build();
    watchForms();
    bindKlaviyoIdentify();
    // Poll: kol.js and its form handler initialize asynchronously, so keep
    // (idempotently) wiring until the redirect-blocking replacement sticks.
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (window._kol) wireKol(window._kol);
      var wired = window._kol && window._kol.form && window._kol.form.handleLeadResponse && window._kol.form.handleLeadResponse.__jgReplaced;
      if (wired || tries > 120) clearInterval(iv); // ~36s
    }, 300);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  /* ---- Manual trigger (used for design review / QA screenshots) ---------- */
  window.__jgShowReferral = function (sample) {
    showOverlay(sample || {
      url: "https://drinkjunegrass.com/?kid=DEMO123",
      code: "DEMO123",
      score: 1,
      rank: 214,
      statusUrl: "https://junegrass-homestead-rewards.kickoffpages.com"
    });
  };
})();

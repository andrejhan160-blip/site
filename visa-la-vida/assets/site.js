/* Visa la Vida — page runtime.
 *
 * Everything interactive on the landing pages: scroll reveals, the lead
 * modal, phone validation, lead delivery, analytics events and the consent
 * banner. Plain browser JS (ES2020: fetch, async/await,
 * Promise.allSettled), no framework, no bundler.
 *
 * Per-page configuration arrives as window.VLV, written inline by build.js.
 * The Meta Pixel itself is bootstrapped inline in <head> (it has to run
 * before this deferred script) — see build.js `pixelBootstrap`.
 */
(function () {
  'use strict';

  var CFG = window.VLV || {};

  /* The thank-you page is shared by all three segments, so it resolves its
     own: the redirect carries #seg=<segment>, and sessionStorage covers a
     reload that drops the hash. Without this, every conversion would be
     attributed to (and messaged as) the visa segment. */
  if (!CFG.segment) {
    var fromHash = (window.location.hash.match(/seg=([a-z]+)/) || [])[1];
    var fromStore = null;
    try { fromStore = JSON.parse(sessionStorage.getItem('vlv_segment')); } catch (e) { /* ignore */ }
    CFG.segment = fromHash || fromStore || 'visa';
  }
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];

  /* ------------------------------------------------------------ utils -- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function store(kind) { try { return window[kind + 'Storage']; } catch (e) { return null; } }
  function readJSON(kind, key, fallback) {
    var s = store(kind);
    if (!s) return fallback;
    try { return JSON.parse(s.getItem(key)) || fallback; } catch (e) { return fallback; }
  }
  function writeJSON(kind, key, value) {
    var s = store(kind);
    if (!s) return;
    try { s.setItem(key, JSON.stringify(value)); } catch (e) { /* quota / private mode */ }
  }
  function randomId() {
    return Date.now().toString(36) + '.' + Math.random().toString(36).slice(2, 10);
  }

  /* -------------------------------------------------------------- utm -- */
  /* Captured once per session and replayed on every later event so a Lead
     that happens after an internal navigation still carries the ad source. */

  var utm = (function () {
    var stored = readJSON('session', 'vlv_utm', {});
    var params = new URLSearchParams(window.location.search);
    var changed = false;
    UTM_KEYS.forEach(function (k) {
      var v = params.get(k);
      if (v) { stored[k] = v.slice(0, 200); changed = true; }
    });
    if (!stored.landing_page) { stored.landing_page = window.location.pathname; changed = true; }
    if (!stored.referrer && document.referrer) { stored.referrer = document.referrer.slice(0, 300); changed = true; }
    if (changed) writeJSON('session', 'vlv_utm', stored);
    return stored;
  })();

  function utmQuery() {
    var parts = [];
    UTM_KEYS.forEach(function (k) {
      if (utm[k]) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(utm[k]));
    });
    return parts.join('&');
  }

  /* --------------------------------------------------------- tracking -- */

  function push(event, params) {
    var payload = {};
    for (var k in utm) if (Object.prototype.hasOwnProperty.call(utm, k)) payload[k] = utm[k];
    payload.event = event;
    payload.segment = CFG.segment;
    for (var p in params) if (Object.prototype.hasOwnProperty.call(params, p)) payload[p] = params[p];
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    if (typeof window.gtag === 'function') window.gtag('event', event, payload);
    return payload;
  }

  /* Standard Meta events carry only the small set of parameters Meta
     documents. UTM values go to dataLayer / the CRM, never into fbq — they
     are not standard parameters and only add noise to Events Manager. */
  function fbqStandard(name, params, options) {
    if (typeof window.fbq !== 'function') return;
    try { window.fbq('track', name, params || {}, options || undefined); } catch (e) { /* blocked */ }
  }
  function fbqCustom(name, params) {
    if (typeof window.fbq !== 'function') return;
    try { window.fbq('trackCustom', name, params || {}); } catch (e) { /* blocked */ }
  }

  /* ---------------------------------------------------------- consent -- */
  /* Meta's documented pattern: the pixel is initialised with consent
     revoked, so nothing is sent until the visitor accepts; on grant the
     queued PageView is released. With consentMode 'off' the inline
     bootstrap grants immediately and this banner never renders. */

  function initConsent() {
    var bar = $('#consent');
    if (!bar) return;
    var decision = null;
    try { decision = localStorage.getItem('vlv_consent'); } catch (e) { /* ignore */ }
    if (decision === 'granted' || decision === 'denied') return;
    bar.hidden = false;
    function decide(value) {
      try { localStorage.setItem('vlv_consent', value); } catch (e) { /* ignore */ }
      bar.hidden = true;
      if (value === 'granted' && typeof window.vlvGrantConsent === 'function') window.vlvGrantConsent();
    }
    $('#consent-accept').addEventListener('click', function () { decide('granted'); });
    $('#consent-decline').addEventListener('click', function () { decide('denied'); });
  }

  /* ---------------------------------------------------------- reveals -- */

  function initReveals() {
    var targets = $$('[data-reveal]');
    if (!targets.length) return;
    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i * 60, 320) + 'ms';
      io.observe(el);
    });
  }

  /* ------------------------------------------------------------ phone -- */
  /* The original build asked ipapi.co for the visitor's dialling code on
     every page load. That is a third-party request on the critical path,
     rate-limited well below ad-campaign traffic (so it silently stops
     working exactly when it matters), and it ships the visitor's IP to a
     third party before consent. A local timezone lookup covers the
     countries this offer targets with no request at all. */

  var DIAL_BY_TZ = {
    'Europe/Madrid': '+34', 'Atlantic/Canary': '+34', 'Africa/Ceuta': '+34',
    'Europe/Moscow': '+7', 'Europe/Kaliningrad': '+7', 'Europe/Samara': '+7',
    'Asia/Yekaterinburg': '+7', 'Asia/Novosibirsk': '+7', 'Asia/Krasnoyarsk': '+7',
    'Asia/Irkutsk': '+7', 'Asia/Vladivostok': '+7', 'Asia/Almaty': '+7', 'Asia/Aqtobe': '+7',
    'Europe/Kyiv': '+380', 'Europe/Kiev': '+380',
    'Europe/Minsk': '+375', 'Asia/Tbilisi': '+995', 'Asia/Yerevan': '+374',
    'Asia/Baku': '+994', 'Asia/Tashkent': '+998', 'Asia/Bishkek': '+996',
    'Asia/Dubai': '+971', 'Asia/Istanbul': '+90', 'Europe/Istanbul': '+90',
    'Asia/Jerusalem': '+972', 'Asia/Nicosia': '+357', 'Europe/Nicosia': '+357',
    'Europe/Lisbon': '+351', 'Europe/Berlin': '+49', 'Europe/Paris': '+33',
    'Europe/Rome': '+39', 'Europe/Amsterdam': '+31', 'Europe/Brussels': '+32',
    'Europe/Vienna': '+43', 'Europe/Zurich': '+41', 'Europe/Prague': '+420',
    'Europe/Warsaw': '+48', 'Europe/Budapest': '+36', 'Europe/Bucharest': '+40',
    'Europe/Athens': '+30', 'Europe/Riga': '+371', 'Europe/Vilnius': '+370',
    'Europe/Tallinn': '+372', 'Europe/Belgrade': '+381', 'Europe/Sofia': '+359',
    'Europe/London': '+44', 'Europe/Dublin': '+353',
    'America/New_York': '+1', 'America/Chicago': '+1', 'America/Denver': '+1',
    'America/Los_Angeles': '+1', 'America/Toronto': '+1', 'Asia/Bangkok': '+66'
  };

  function localDialCode() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && DIAL_BY_TZ[tz]) return DIAL_BY_TZ[tz];
    } catch (e) { /* no Intl */ }
    var lang = (navigator.language || '').toLowerCase();
    if (lang.indexOf('ru') === 0) return '+7';
    if (lang.indexOf('uk') === 0) return '+380';
    if (lang.indexOf('es') === 0) return '+34';
    return '+34';
  }

  /* Accepts an international number: optional +, 9-15 digits. Rejects the
     obvious junk (all-identical digits, straight runs) that placeholder
     entries produce, which would otherwise burn a paid lead. */
  function validPhone(raw) {
    var compact = String(raw).replace(/[\s()\-.]/g, '');
    if (!/^\+?\d{9,15}$/.test(compact)) return false;
    var digits = compact.replace(/\D/g, '');
    if (/^(\d)\1+$/.test(digits)) return false;
    if ('01234567890123456'.indexOf(digits) !== -1) return false;
    if ('98765432109876543'.indexOf(digits) !== -1) return false;
    return true;
  }

  /* -------------------------------------------------------- lead sink -- */

  async function sha256(value) {
    var text = String(value == null ? '' : value).trim().toLowerCase();
    if (!text) return '';
    if (!(window.crypto && window.crypto.subtle && window.TextEncoder)) return '';
    try {
      var buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    } catch (e) { return ''; }
  }

  function postJSON(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error(url + ' -> HTTP ' + res.status);
      return res;
    });
  }

  /* Sends the lead everywhere it is configured to go and reports whether
     ANY sink accepted it. The original build fired these off with
     `.catch(() => {})` and navigated to the thank-you page unconditionally
     — with an unconfigured (or unconfirmed) sink every paid lead was lost
     silently. Here a total failure is surfaced to the visitor with a
     working messenger fallback, and no Lead event is reported to Meta for
     a lead that was never actually received. */
  async function deliver(lead) {
    var jobs = [];
    if (CFG.leadEndpoint) jobs.push(postJSON(CFG.leadEndpoint, lead));
    if (CFG.formsubmitEmail) {
      jobs.push(postJSON('https://formsubmit.co/ajax/' + encodeURIComponent(CFG.formsubmitEmail), {
        _subject: 'Заявка ВНЖ Испании · ' + lead.segment,
        _template: 'table',
        Имя: lead.name,
        Телефон: lead.phone,
        Сегмент: lead.segment,
        Страница: lead.page_url,
        utm_source: lead.utm_source,
        utm_medium: lead.utm_medium,
        utm_campaign: lead.utm_campaign,
        utm_content: lead.utm_content,
        utm_term: lead.utm_term,
        fbclid: lead.fbclid,
        Время: lead.created_at
      }));
    }
    if (!jobs.length) {
      if (window.console) console.error('[vlv] No lead sink configured — set leadEndpoint or formsubmitEmail in site.config.json.');
      return false;
    }
    var results = await Promise.allSettled(jobs);
    results.forEach(function (r) {
      if (r.status === 'rejected' && window.console) console.error('[vlv] lead delivery failed:', r.reason);
    });
    return results.some(function (r) { return r.status === 'fulfilled'; });
  }

  /* Meta Conversions API, relayed through the customer's own webhook
     (Make / Zapier / n8n / a small server). PII is SHA-256 hashed here, in
     the browser: the raw phone and name never leave the page for the
     analytics path, which is what Meta's CAPI requires and what the
     original code violated by posting them in the clear. `event_id`
     matches the browser pixel's so Meta deduplicates the pair. */
  async function sendCapi(lead, eventId) {
    if (!CFG.capiWebhook) return;
    var hashedPhone = await sha256(String(lead.phone).replace(/[^\d]/g, ''));
    var hashedName = await sha256(lead.name);
    var body = {
      event_name: 'Lead',
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: lead.page_url,
      action_source: 'website',
      user_data: {
        ph: hashedPhone,
        fn: hashedName,
        fbp: readCookie('_fbp') || undefined,
        fbc: readCookie('_fbc') || (lead.fbclid ? 'fb.1.' + Date.now() + '.' + lead.fbclid : undefined),
        client_user_agent: navigator.userAgent
      },
      custom_data: {
        segment: lead.segment,
        content_name: lead.segment,
        utm_source: lead.utm_source,
        utm_campaign: lead.utm_campaign
      }
    };
    try { await postJSON(CFG.capiWebhook, body); } catch (e) {
      if (window.console) console.error('[vlv] CAPI relay failed:', e);
    }
  }

  function readCookie(name) {
    var m = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[2]) : '';
  }

  /* ------------------------------------------------------------ modal -- */

  function initModal() {
    var modal = $('#lead-modal');
    if (!modal) return;

    var form = $('#lead-form', modal);
    var nameInput = $('#lead-name', modal);
    var phoneInput = $('#lead-phone', modal);
    var nameErr = $('#lead-name-err', modal);
    var phoneErr = $('#lead-phone-err', modal);
    var formErr = $('#lead-form-err', modal);
    var submit = $('#lead-submit', modal);
    var submitLabel = $('#lead-submit-label', modal);
    var lastFocused = null;
    var formStarted = false;
    var sending = false;

    var dial = localDialCode();
    phoneInput.placeholder = dial + ' 600 000 000';

    function open(source) {
      lastFocused = document.activeElement;
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      window.setTimeout(function () { nameInput.focus(); }, 40);
      writeJSON('session', 'vlv_segment', CFG.segment);
      push('lead_form_open', { source: source });
      /* ViewContent is the standard event for "looked at the offer" and is
         what a Meta campaign can optimise toward before Lead volume
         builds; the granular source lives in the custom event. */
      fbqStandard('ViewContent', { content_name: CFG.segment, content_category: 'lead_form' });
      fbqCustom('LeadFormOpen', { segment: CFG.segment, source: source });
    }

    function close() {
      modal.hidden = true;
      document.body.style.overflow = '';
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    $$('[data-open-modal]').forEach(function (btn) {
      btn.addEventListener('click', function () { open(btn.getAttribute('data-open-modal') || 'cta'); });
    });
    $$('[data-close-modal]', modal).forEach(function (btn) {
      btn.addEventListener('click', close);
    });
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', function (e) {
      if (modal.hidden) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      /* Keep Tab inside the dialog while it is open. */
      var focusable = $$('button, input, a[href], [tabindex]:not([tabindex="-1"])', modal)
        .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    function markStart() {
      if (formStarted) return;
      formStarted = true;
      push('lead_form_start', {});
      fbqCustom('LeadFormStart', { segment: CFG.segment });
    }
    nameInput.addEventListener('focus', markStart);
    phoneInput.addEventListener('focus', markStart);

    nameInput.addEventListener('input', function () {
      nameErr.hidden = true;
      nameInput.setAttribute('aria-invalid', 'false');
    });
    phoneInput.addEventListener('input', function () {
      phoneErr.hidden = true;
      phoneInput.setAttribute('aria-invalid', 'false');
      /* Prefill the dialling code once the visitor starts typing a bare
         number, but never touch a value that already carries one. */
      var v = phoneInput.value;
      if (v.length === 1 && /\d/.test(v) && v !== '0') phoneInput.value = dial + ' ' + v;
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (sending) return;

      var name = nameInput.value.trim();
      var phone = phoneInput.value.trim();
      var bad = false;
      if (name.length < 2) {
        nameErr.hidden = false;
        nameInput.setAttribute('aria-invalid', 'true');
        bad = true;
      }
      if (!validPhone(phone)) {
        phoneErr.hidden = false;
        phoneInput.setAttribute('aria-invalid', 'true');
        bad = true;
      }
      if (bad) { (name.length < 2 ? nameInput : phoneInput).focus(); return; }

      sending = true;
      submit.disabled = true;
      submitLabel.textContent = 'Отправляем…';
      formErr.hidden = true;

      var lead = {
        name: name,
        phone: phone,
        segment: CFG.segment,
        page_url: window.location.href,
        utm_source: utm.utm_source || '',
        utm_medium: utm.utm_medium || '',
        utm_campaign: utm.utm_campaign || '',
        utm_content: utm.utm_content || '',
        utm_term: utm.utm_term || '',
        fbclid: utm.fbclid || '',
        referrer: utm.referrer || '',
        created_at: new Date().toISOString()
      };
      var eventId = 'lead.' + randomId();
      lead.event_id = eventId;

      /* Keep a local copy first: if every network call fails, the lead is
         still recoverable from the browser that produced it. */
      var archive = readJSON('local', 'vlv_leads', []);
      archive.push(lead);
      writeJSON('local', 'vlv_leads', archive.slice(-50));

      var ok = await deliver(lead);

      if (!ok) {
        sending = false;
        submit.disabled = false;
        submitLabel.textContent = CFG.submitLabel || 'Получить план';
        formErr.innerHTML = 'Не удалось отправить заявку. Напишите нам напрямую — ' +
          '<a href="' + messengerHref('whatsapp', lead) + '" target="_blank" rel="noopener">WhatsApp</a> или ' +
          '<a href="' + messengerHref('telegram', lead) + '" target="_blank" rel="noopener">Telegram</a>.';
        formErr.hidden = false;
        push('lead_submit_failed', {});
        fbqCustom('LeadSubmitFailed', { segment: CFG.segment });
        return;
      }

      /* One Lead event, with an eventID, always. The original fired Lead
         twice whenever the CAPI webhook was configured (once deduplicable,
         once not), double-counting conversions in Events Manager. */
      push('lead_submit', {});
      fbqStandard('Lead', { content_name: CFG.segment, content_category: 'vnj_spain' }, { eventID: eventId });
      sendCapi(lead, eventId);

      document.body.style.overflow = '';
      window.location.href = CFG.thanksUrl + (utmQuery() ? '?' + utmQuery() : '') + '#seg=' + CFG.segment;
    });
  }

  /* ------------------------------------------------------- messengers -- */

  function messengerHref(kind, lead) {
    var labels = { visa: 'Виза', business: 'Бизнес', residence: 'Резиденция' };
    var text = 'Добрый день! Я бы хотел получить консультацию по ВНЖ Испании.\n' +
      'Источник: ' + (labels[CFG.segment] || CFG.segment);
    if (lead && lead.name) text += '\nИмя: ' + lead.name;
    if (utm.utm_campaign) text += '\nКампания: ' + utm.utm_campaign;
    var base = kind === 'telegram' ? CFG.telegram : CFG.whatsapp;
    return base + (base.indexOf('?') > -1 ? '&' : '?') + 'text=' + encodeURIComponent(text);
  }

  function initMessengers() {
    $$('[data-messenger]').forEach(function (link) {
      var kind = link.getAttribute('data-messenger');
      link.href = messengerHref(kind, null);
      link.addEventListener('click', function () {
        push(kind + '_click', {});
        fbqStandard('Contact', { content_name: CFG.segment, content_category: kind });
      });
    });
  }

  /* ------------------------------------------------- thank-you screen -- */

  var THEME_BY_SEGMENT = { visa: 'gold', business: 'blue', residence: 'emerald' };

  function initThanks() {
    if (CFG.page !== 'thanks') return;
    var theme = THEME_BY_SEGMENT[CFG.segment];
    if (theme) {
      document.body.setAttribute('data-theme', theme);
      var logo = document.querySelector('.hdr__logo img');
      if (logo) logo.src = logo.src.replace(/logo-(gold|white)\.png$/, theme === 'gold' ? 'logo-gold.png' : 'logo-white.png');
    }
    push('thank_you_view', {});
    fbqCustom('ThankYouView', { segment: CFG.segment });

    var facade = $('#video-facade');
    if (!facade) return;
    facade.addEventListener('click', function () {
      var frame = document.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + CFG.videoId + '?autoplay=1&rel=0';
      frame.title = 'Видео о ВНЖ Испании';
      frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'origin';
      facade.replaceWith(frame);
      push('video_play', {});
      fbqCustom('VideoPlay', { segment: CFG.segment });
    });
  }

  /* ------------------------------------------------------------- boot -- */

  function boot() {
    initConsent();
    initReveals();
    initModal();
    initMessengers();
    initThanks();
    push('page_view', { page: CFG.page });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

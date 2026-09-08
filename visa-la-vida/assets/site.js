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
  /* The dialling code is filled in for the visitor rather than shown as a
     sample number, so nobody has to work out what format we want.

     Country comes from the IP, resolved in up to three steps:
       1. geoCountryUrl from site.config.json, when the operator has an
          endpoint of their own — '/cdn-cgi/trace' behind Cloudflare, or any
          URL returning a country code. Same-origin, so no third party sees
          the visitor at all. Off unless configured: probing for it blindly
          would mean a guaranteed 404 for every visitor to a host that has
          no such endpoint;
       2. a public IP-geolocation API;
       3. the browser's own timezone, which needs no request at all.
     The answer is cached for the session, so this costs one request per
     visitor, not one per page. Every step is optional: if all of them fail
     the field simply stays empty and the visitor types the code. */

  var DIAL_BY_TZ = {
    'Europe/Madrid': '+34', 'Atlantic/Canary': '+34', 'Africa/Ceuta': '+34',
    'Europe/Moscow': '+7', 'Europe/Kaliningrad': '+7', 'Europe/Samara': '+7',
    'Asia/Yekaterinburg': '+7', 'Asia/Novosibirsk': '+7', 'Asia/Krasnoyarsk': '+7',
    'Asia/Irkutsk': '+7', 'Asia/Vladivostok': '+7', 'Asia/Almaty': '+7', 'Asia/Aqtobe': '+7',
    'Europe/Kyiv': '+380', 'Europe/Kiev': '+380', 'Europe/Minsk': '+375',
    'Asia/Tbilisi': '+995', 'Asia/Yerevan': '+374', 'Asia/Baku': '+994',
    'Asia/Tashkent': '+998', 'Asia/Bishkek': '+996', 'Asia/Dubai': '+971',
    'Europe/Istanbul': '+90', 'Asia/Istanbul': '+90', 'Asia/Jerusalem': '+972',
    'Asia/Nicosia': '+357', 'Europe/Nicosia': '+357', 'Europe/Lisbon': '+351',
    'Europe/Berlin': '+49', 'Europe/Paris': '+33', 'Europe/Rome': '+39',
    'Europe/Amsterdam': '+31', 'Europe/Brussels': '+32', 'Europe/Vienna': '+43',
    'Europe/Zurich': '+41', 'Europe/Prague': '+420', 'Europe/Warsaw': '+48',
    'Europe/Budapest': '+36', 'Europe/Bucharest': '+40', 'Europe/Athens': '+30',
    'Europe/Riga': '+371', 'Europe/Vilnius': '+370', 'Europe/Tallinn': '+372',
    'Europe/Belgrade': '+381', 'Europe/Sofia': '+359', 'Europe/London': '+44',
    'Europe/Dublin': '+353', 'America/New_York': '+1', 'America/Chicago': '+1',
    'America/Denver': '+1', 'America/Los_Angeles': '+1', 'America/Toronto': '+1',
    'Asia/Bangkok': '+66'
  };

  var DIAL_BY_COUNTRY = {
    ES: '+34', PT: '+351', FR: '+33', DE: '+49', IT: '+39', NL: '+31', BE: '+32',
    AT: '+43', CH: '+41', GB: '+44', IE: '+353', PL: '+48', CZ: '+420', SK: '+421',
    HU: '+36', RO: '+40', BG: '+359', GR: '+30', HR: '+385', SI: '+386', RS: '+381',
    ME: '+382', AL: '+355', MK: '+389', BA: '+387', CY: '+357', MT: '+356',
    LV: '+371', LT: '+370', EE: '+372', FI: '+358', SE: '+46', NO: '+47', DK: '+45',
    IS: '+354', LU: '+352', MC: '+377', AD: '+376',
    RU: '+7', KZ: '+7', UA: '+380', BY: '+375', MD: '+373', GE: '+995', AM: '+374',
    AZ: '+994', UZ: '+998', KG: '+996', TJ: '+992', TM: '+993',
    TR: '+90', IL: '+972', AE: '+971', SA: '+966', QA: '+974', KW: '+965',
    BH: '+973', OM: '+968', JO: '+962', LB: '+961', EG: '+20', MA: '+212',
    TN: '+216', DZ: '+213',
    US: '+1', CA: '+1', MX: '+52', BR: '+55', AR: '+54', CL: '+56', CO: '+57',
    PE: '+51', UY: '+598', PA: '+507', DO: '+1', CR: '+506',
    CN: '+86', JP: '+81', KR: '+82', IN: '+91', ID: '+62', TH: '+66', VN: '+84',
    MY: '+60', SG: '+65', PH: '+63', AU: '+61', NZ: '+64', ZA: '+27'
  };

  function dialFromTimezone() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && DIAL_BY_TZ[tz]) return DIAL_BY_TZ[tz];
    } catch (e) { /* no Intl */ }
    var lang = (navigator.language || '').toLowerCase();
    if (lang.indexOf('ru') === 0) return '+7';
    if (lang.indexOf('uk') === 0) return '+380';
    if (lang.indexOf('es') === 0) return '+34';
    return '';
  }

  function fetchText(url, ms) {
    /* Nothing on the page waits for this, but a hung request should not sit
       in the connection pool for the whole visit either. */
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = window.setTimeout(function () { if (ctrl) ctrl.abort(); }, ms);
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) {
        if (!r.ok) throw new Error(url + ' -> HTTP ' + r.status);
        return r.text();
      })
      .finally(function () { window.clearTimeout(timer); });
  }

  /* Accepts both shapes an endpoint like this comes in: Cloudflare's
     key=value trace text, and plain JSON with a country field. */
  function parseCountry(text) {
    var m = text.match(/^loc=([A-Z]{2})$/m);
    if (m) return m[1];
    try {
      var data = JSON.parse(text);
      var code = data && (data.country_code || data.country || data.countryCode);
      if (typeof code === 'string' && /^[A-Za-z]{2}$/.test(code)) return code.toUpperCase();
    } catch (e) { /* not JSON */ }
    throw new Error('no country in response');
  }

  function countryFromOwnEndpoint() {
    if (!CFG.geoCountryUrl) return Promise.reject(new Error('not configured'));
    return fetchText(CFG.geoCountryUrl, 1500).then(parseCountry);
  }

  function countryFromApi() {
    return fetchText('https://ipwho.is/?fields=country_code', 2500).then(parseCountry);
  }

  async function detectDial() {
    var cached = null;
    try { cached = sessionStorage.getItem('vlv_dial'); } catch (e) { /* ignore */ }
    if (cached !== null) return cached;

    var dial = '';
    for (var lookup of [countryFromOwnEndpoint, countryFromApi]) {
      try {
        var country = await lookup();
        if (DIAL_BY_COUNTRY[country]) { dial = DIAL_BY_COUNTRY[country]; break; }
      } catch (e) { /* try the next one */ }
    }
    if (!dial) dial = dialFromTimezone();
    try { sessionStorage.setItem('vlv_dial', dial); } catch (e) { /* ignore */ }
    return dial;
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

    /* Fill the code in as the field's value, not as a sample number: a
       greyed-out example gets read as "type it like this" and half the
       entries come back with the example's digits still in them. Only
       ever written into an untouched, empty field, so it can never
       overwrite what the visitor is typing while the lookup is in
       flight. */
    var dial = '';
    var phoneTouched = false;
    detectDial().then(function (code) {
      dial = code;
      if (!code || phoneTouched || phoneInput.value) return;
      phoneInput.value = code + ' ';
    });

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
      phoneTouched = true;
      phoneErr.hidden = true;
      phoneInput.setAttribute('aria-invalid', 'false');
      var v = phoneInput.value;
      /* Someone who pastes or types a full international number over the
         prefilled code would otherwise end up with two of them
         ("+34 +7 916…"), which then fails validation for no reason the
         visitor can see. Drop ours and keep theirs. */
      if (/^\+\d{1,4}[\s]*\+/.test(v)) phoneInput.value = v.replace(/^\+\d{1,4}[\s]*/, '');
      /* Typing a bare national number into an emptied field still gets the
         code back. */
      else if (dial && v.length === 1 && /[1-9]/.test(v)) phoneInput.value = dial + ' ' + v;
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

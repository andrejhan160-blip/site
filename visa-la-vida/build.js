#!/usr/bin/env node
/*
 * Static site generator for the "Visa la Vida" ВНЖ-Испании landing pages.
 *
 * The source of truth was a Claude Design component (`.dc.html`) shipped as
 * a single 3.3 MB self-unpacking bundle: 16 base64 assets decoded in JS,
 * React + a design runtime booted, and only then any markup. That renders
 * nothing to a crawler, nothing to a visitor until the whole payload has
 * arrived, and nothing at all to Meta's link crawler — which does not run
 * JavaScript. This script ports that component's data model and template
 * into plain static HTML: real text in the source, real URLs per segment,
 * real assets on disk.
 *
 * Run: `node build.js`  -> writes index.html, the three spain-<segment>
 *                          landings, thank-you/, privacy/, 404.html,
 *                          robots.txt, sitemap.xml and assets/site.js
 *
 * No dependencies — plain Node.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

const ORIGIN = String(CFG.origin || '').replace(/\/+$/, '');
const ORIGIN_SET = !!ORIGIN && !/example\.com/i.test(ORIGIN);
const BRAND = CFG.brandName || 'Visa la Vida';
const INT = CFG.integrations || {};
const CONTACTS = CFG.contacts || {};

/* ------------------------------------------------------------------ data -- */
/* Copy verbatim from the design component — headlines, bullets and CTA
   wording are the tested ad creative and are not ours to rewrite. */

const SEGMENTS = {
  visa: {
    key: 'visa',
    dir: 'spain-visa',
    theme: 'gold',
    title: 'ВНЖ Испании до 3 лет | Digital Nomad 2026',
    description: 'Проверьте возможность получить ВНЖ Испании Digital Nomad до 3 лет без покупки недвижимости и инвестиций.',
    eyebrow: 'ВНЖ Испании за 20 рабочих дней',
    headline: 'Есть виза в Европу, но устали постоянно её продлевать?',
    subPre: 'Получите ',
    subStrong: 'ВНЖ Испании на 3 года',
    subPost: ' для себя и семьи без покупки недвижимости и инвестиций.',
    bullets: [
      'Забудьте о постоянной визовой рутине',
      'Живите в Испании легально до 3 лет',
      'Путешествуйте по странам Шенгена без оформления отдельной визы',
      'Оформите ВНЖ для себя и семьи'
    ],
    ctaLabel: 'Получить план + проверить свой кейс',
    ctaNote: 'План получения ВНЖ Испании 2026: требования, документы, расходы и сроки',
    heroPosition: '50% 50%',
    heroAlt: 'Специалист Visa la Vida на террасе с видом на средиземноморское побережье Испании',
    heroCaption: 'ВНЖ Испании на 3 года',
    s2Headline: 'Узнайте, какая программа подходит именно вам',
    s2Subtitle: 'Не нужно самостоятельно разбираться в требованиях и собирать документы вслепую. Сначала проверим вашу ситуацию.',
    s2Items: [
      { n: '01', text: 'Подберём программу под вашу ситуацию' },
      { n: '02', text: 'Покажем, какие документы понадобятся' },
      { n: '03', text: 'Рассчитаем основные расходы на оформление' },
      { n: '04', text: 'Дадим пошаговый план до подачи заявления' }
    ],
    s2CtaLabel: 'Проверить мой кейс',
    s2CtaNote: 'Без обязательств. Сначала получите предварительную оценку и поймите, есть ли смысл начинать оформление.'
  },
  business: {
    key: 'business',
    dir: 'spain-business',
    theme: 'blue',
    title: 'ВНЖ Испании для предпринимателей | Digital Nomad 2026',
    description: 'Бизнес и доход уже есть? Проверьте возможность получить ВНЖ Испании до 3 лет без покупки недвижимости и инвестиций.',
    eyebrow: 'ВНЖ Испании за 20 рабочих дней',
    headline: 'Есть действующий бизнес и вы рассматриваете резидентство ЕС?',
    subPre: 'Получите ',
    subStrong: 'ВНЖ Испании на 3 года',
    subPost: ' для себя и семьи без покупки недвижимости и инвестиций.',
    bullets: [
      'Продолжайте вести бизнес за пределами Испании',
      'Не замораживайте капитал ради получения ВНЖ',
      'Живите в Испании легально до 3 лет',
      'Оформите статус для себя, супруга и детей'
    ],
    ctaLabel: 'Получить план оформления ВНЖ',
    ctaNote: 'Покажем требования 2026 года, документы, расходы и предварительно проверим ваш бизнес-кейс.',
    heroPosition: '50% 50%',
    heroAlt: 'Специалист Visa la Vida за работой в светлом интерьере',
    heroCaption: 'Бизнес остаётся — меняется страна',
    s2Headline: 'Узнайте, какая программа подходит именно вам',
    s2Subtitle: 'Подходит не только сотрудникам, но и предпринимателям и специалистам, работающим с зарубежными компаниями и клиентами.',
    s2Items: [
      { n: '01', text: 'Проверим формат вашей деятельности' },
      { n: '02', text: 'Разберём структуру дохода и документов' },
      { n: '03', text: 'Покажем, что потребуется для подачи' },
      { n: '04', text: 'Проверим возможность оформления семьи' },
      { n: '05', text: 'Составим понятный сценарий переезда и получения ВНЖ' }
    ],
    s2CtaLabel: 'Проверить мой бизнес-кейс',
    s2CtaNote: 'Получите предварительную оценку до того, как тратить деньги и время на оформление.'
  },
  residence: {
    key: 'residence',
    dir: 'spain-residence',
    theme: 'emerald',
    title: 'Заканчивается ВНЖ в Европе? ВНЖ Испании до 3 лет',
    description: 'Альтернатива текущему ВНЖ в Европе: ВНЖ Испании Digital Nomad до 3 лет без покупки недвижимости и инвестиций.',
    eyebrow: 'ВНЖ Испании за 20 рабочих дней',
    headline: 'Заканчивается ВНЖ в Европе и ищете другой вариант?',
    subPre: 'Получите ',
    subStrong: 'ВНЖ Испании на 3 года',
    subPost: ' для себя и семьи без покупки недвижимости и инвестиций.',
    bullets: [
      'Рассмотрите долгосрочный вариант легального проживания в Испании',
      'Не покупайте недвижимость только ради ВНЖ',
      'Не замораживайте капитал в инвестиционных программах',
      'Оформите статус для себя и семьи'
    ],
    ctaLabel: 'Проверить возможность оформления',
    ctaNote: 'Разберём вашу ситуацию и определим, какой вариант ВНЖ Испании подходит именно вам.',
    heroPosition: '50% 50%',
    heroAlt: 'Специалист Visa la Vida на фоне жилого района на побережье Испании',
    heroCaption: 'Европейский статус без паузы',
    s2Headline: 'Узнайте, какая программа подходит именно вам',
    s2Subtitle: 'Не ждите окончания статуса. Заранее узнайте, можете ли вы перейти к оформлению нового ВНЖ уже в Испании.',
    s2Items: [
      { n: '01', text: 'Проверим вашу текущую ситуацию' },
      { n: '02', text: 'Подберём программу под ваш статус и сроки' },
      { n: '03', text: 'Покажем список необходимых документов' },
      { n: '04', text: 'Рассчитаем основные расходы' },
      { n: '05', text: 'Составим пошаговый сценарий оформления' }
    ],
    s2CtaLabel: 'Разобрать мою ситуацию',
    s2CtaNote: 'Получите предварительную оценку и сравните этот вариант с продлением текущего ВНЖ.'
  }
};

const SEGMENT_ORDER = ['visa', 'business', 'residence'];

const PERKS = [
  '29 стран ЕС',
  'Без шенгенских виз',
  'Счета и бизнес',
  'Европейское образование',
  'Ипотека под 2%'
];

/* ------------------------------------------------------------- helpers -- */

const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* JSON destined for an inline <script>: `</script>` inside a string value
   would close the element early, and U+2028/9 are literal line breaks to a
   JS parser. */
const jsonForScript = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const absolute = (pathname) => (ORIGIN_SET ? ORIGIN + pathname : pathname);

/* The photo treatment is only used when the segment actually ships a hero
   photo. The design referenced assets/hero-<segment>.jpg, but those files
   were never delivered with the bundle, so every landing page rendered a
   broken image where its hero should be. Drop a JPG in with that name and
   this build switches back to the framed-photo layout automatically. */
function heroPhoto(segment) {
  for (const rel of [`assets/hero-${segment.key}.jpg`, 'assets/hero.jpg']) {
    if (fs.existsSync(path.join(ROOT, rel))) {
      const webp = rel.replace(/\.jpg$/, '.webp');
      return { jpg: rel, webp: fs.existsSync(path.join(ROOT, webp)) ? webp : null };
    }
  }
  return null;
}

const SVG = {
  flag: '<svg class="eyebrow__flag" width="20" height="14" viewBox="0 0 20 14" role="img" aria-label="Флаг Испании"><rect width="20" height="14" fill="#C60B1E"/><rect y="3.5" width="20" height="7" fill="#FFC400"/></svg>',
  tick: '<svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true"><path d="M1 4.6L4.1 7.6L10 1.4" stroke="var(--on-acc)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  seal: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2l2.3 2.1 3.1-.4.9 3 2.7 1.6-1.4 2.8 1.4 2.8-2.7 1.6-.9 3-3.1-.4L12 22l-2.3-2.1-3.1.4-.9-3L3 15.7l1.4-2.8L3 10.1l2.7-1.6.9-3 3.1.4L12 2z" fill="var(--acc)"/><path d="M8.6 12.3l2.3 2.3 4.5-4.7" stroke="var(--on-acc)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  shield: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex:none"><path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z" stroke="var(--acc)" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.8 12l2.2 2.2 4.2-4.4" stroke="var(--acc)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg width="26" height="28" viewBox="0 0 26 28" fill="none" aria-hidden="true"><path d="M24 12.3a2 2 0 010 3.4L4 27.5A2 2 0 011 25.8V2.2A2 2 0 014 .5l20 11.8z" fill="var(--on-acc)"/></svg>'
};

function eyebrow(text, withFlag) {
  return `<div class="eyebrow">
        <span class="eyebrow__rule"></span>
        ${withFlag ? SVG.flag : ''}
        <span class="eyebrow__text">${esc(text)}</span>
        <span class="eyebrow__rule eyebrow__rule--r"></span>
      </div>`;
}

/* --------------------------------------------------------------- pixel -- */
/* Inline in <head> so the pixel is live before the deferred runtime loads
   — a visitor who bounces in two seconds still counts as a PageView. */

function pixelBootstrap() {
  if (!INT.metaPixelId) {
    return '  <!-- Meta Pixel disabled: no metaPixelId in site.config.json -->';
  }
  const gated = INT.consentMode !== 'off';
  return `  <script>
  (function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  ${gated ? `// GDPR: hold every hit until the visitor accepts the banner. Meta
  // queues the events and releases them on 'grant', so an accepted consent
  // still reports the original PageView rather than losing it.
  var vlvConsent = null;
  try { vlvConsent = localStorage.getItem('vlv_consent'); } catch (e) {}
  fbq('consent', vlvConsent === 'granted' ? 'grant' : 'revoke');
  window.vlvGrantConsent = function () { fbq('consent', 'grant'); };` : `fbq('consent', 'grant');`}
  fbq('init', ${JSON.stringify(INT.metaPixelId)});
  fbq('track', 'PageView');
  </script>
  <noscript><img height="1" width="1" style="display:none" alt=""
    src="https://www.facebook.com/tr?id=${encodeURIComponent(INT.metaPixelId)}&ev=PageView&noscript=1"></noscript>`;
}

/* ---------------------------------------------------------------- head -- */

function head(page) {
  const base = page.depth ? '..' : '.';
  const css = fs.readFileSync(path.join(ROOT, 'src', 'styles.css'), 'utf8')
    .replace(/\{\{base\}\}/g, base);

  const ogImage = absolute(`/assets/og-${page.og || 'home'}.jpg`);
  const canonical = absolute(page.canonicalPath || page.pathname);

  return `<!DOCTYPE html>
<html lang="ru" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="${page.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}">
${INT.metaDomainVerification ? `<meta name="facebook-domain-verification" content="${esc(INT.metaDomainVerification)}">` : '<!-- facebook-domain-verification: add metaDomainVerification to site.config.json -->'}

<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(BRAND)}">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="${esc(page.ogTitle || page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(BRAND)} — ВНЖ Испании">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.ogTitle || page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<meta name="twitter:image" content="${esc(ogImage)}">

<link rel="icon" href="${base}/assets/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="${base}/assets/apple-touch-icon.png">
<meta name="theme-color" content="#0A0A0C">

<!-- The hero image is the LCP element on every landing page; preloading it
     next to the inlined CSS keeps it off the tail of the request chain. -->
${page.preload ? `<link rel="preload" as="image" href="${base}/${page.preload}" fetchpriority="high">` : ''}
<link rel="preload" as="font" type="font/woff2" href="${base}/assets/fonts/manrope-cyrillic.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="${base}/assets/fonts/playfair-cyrillic.woff2" crossorigin>

<script>document.documentElement.className = 'js';</script>
${pixelBootstrap()}
<style>
${css}</style>
</head>
<body data-theme="${page.theme || 'gold'}">`;
}

function header(page) {
  const base = page.depth ? '..' : '.';
  const logo = page.theme === 'gold' ? 'logo-gold.png' : 'logo-white.png';
  return `<header class="hdr">
    <div class="hdr__in">
      <a class="hdr__logo" href="${base}/" aria-label="${esc(BRAND)} — сервис ВНЖ, на главную">
        <img src="${base}/assets/${logo}" alt="${esc(BRAND)} — сервис ВНЖ" width="512" height="143">
      </a>
      <div class="hdr__right">
        <span class="hdr__note" data-hide-xs>3000+ клиентов</span>
        ${page.hasModal
          ? '<button type="button" class="btn-ghost" data-open-modal="header">Проверить свой кейс</button>'
          : `<a class="btn-ghost" href="${base}/${SEGMENTS.visa.dir}/" style="display:inline-flex;align-items:center">Проверить свой кейс</a>`}
      </div>
    </div>
  </header>`;
}

function footer(page) {
  const base = page.depth ? '..' : '.';
  return `<footer class="ftr">
    <div class="ftr__in">
      <span class="ftr__brand">${esc(BRAND)} · сервис ВНЖ</span>
      <span class="ftr__legal">Информация на странице носит справочный характер и не является публичной офертой.
        <a href="${base}/privacy/">Политика обработки персональных данных</a>.</span>
    </div>
  </footer>`;
}

function consentBar(page) {
  if (INT.consentMode === 'off' || !INT.metaPixelId) return '';
  const base = page.depth ? '..' : '.';
  return `<div class="consent" id="consent" role="region" aria-label="Согласие на аналитику" hidden>
    <p class="consent__text">Мы используем cookie и пиксель Meta, чтобы понимать, какая реклама приводит заявки.
      Подробности — в <a href="${base}/privacy/">политике обработки персональных данных</a>.</p>
    <div class="consent__actions">
      <button type="button" class="consent__btn" id="consent-decline">Отклонить</button>
      <button type="button" class="consent__btn consent__btn--primary" id="consent-accept">Принять</button>
    </div>
  </div>`;
}

function scripts(page) {
  const base = page.depth ? '..' : '.';
  const cfg = {
    page: page.kind,
    /* null on pages shared by every segment (thank-you above all): app.js
       resolves the real one from the #seg= hash the redirect carries. */
    segment: page.segment || null,
    thanksUrl: `${base}/thank-you/`,
    telegram: CONTACTS.telegram || 'https://t.me/servis_vnj',
    whatsapp: CONTACTS.whatsapp || 'https://wa.me/34633791850',
    leadEndpoint: INT.leadEndpoint || '',
    formsubmitEmail: INT.formsubmitEmail || '',
    capiWebhook: INT.capiWebhook || '',
    videoId: CFG.videoId || '',
    submitLabel: 'Получить план'
  };
  return `${consentBar(page)}
  <script>window.VLV = ${jsonForScript(cfg)};</script>
  <script src="${base}/assets/site.js" defer></script>
</body>
</html>
`;
}

/* ------------------------------------------------------------ sections -- */

function heroSection(seg, page) {
  const base = page.depth ? '..' : '.';
  const photo = heroPhoto(seg);
  const art = photo
    ? `<div class="hero__frame"><picture>
            ${photo.webp ? `<source srcset="${base}/${photo.webp}" type="image/webp">` : ''}
            <img src="${base}/${photo.jpg}" alt="${esc(seg.heroAlt)}" fetchpriority="high" decoding="async" width="560" height="700" style="object-position:${esc(seg.heroPosition || '50% 50%')}">
          </picture></div>`
    : `<picture>
          <source srcset="${base}/assets/card.webp" type="image/webp">
          <img class="hero__card" src="${base}/assets/card.png" alt="Permiso de residencia España — карта ВНЖ Испании" fetchpriority="high" decoding="async" width="1100" height="825">
        </picture>`;

  return `<section class="hero">
      ${eyebrow(seg.eyebrow, true)}
      <h1 class="h-display hero__h1">${esc(seg.headline)}</h1>
      <p class="hero__sub">${esc(seg.subPre)}<strong>${esc(seg.subStrong)}</strong>${esc(seg.subPost)}</p>

      <div class="hero__art">
        <div class="hero__glow" aria-hidden="true"></div>
        ${art}
        <div class="hero__badge">95% одобрений</div>
        <div class="hero__caption">${SVG.seal}${esc(seg.heroCaption)}</div>
      </div>

      <ul class="bullets" data-reveal>
        ${seg.bullets.map((b) => `<li><span class="bullets__tick">${SVG.tick}</span><span>${esc(b)}</span></li>`).join('\n        ')}
      </ul>

      <div class="cta-block" data-reveal>
        <button type="button" class="btn-cta" data-open-modal="hero">
          <span>${esc(seg.ctaLabel)}</span><span class="btn-cta__arrow" aria-hidden="true">→</span>
        </button>
        <p class="cta-note">${esc(seg.ctaNote)}</p>
        <div class="cta-chip">${SVG.shield}<span>Задержка = автоматическое одобрение по закону</span></div>
        <div class="trust">
          <picture>
            <source srcset="${base}/assets/expert.webp" type="image/webp">
            <img src="${base}/assets/expert.jpg" alt="Специалист ${esc(BRAND)}" loading="lazy" decoding="async" width="42" height="42">
          </picture>
          <span>3000+ клиентов · 95% одобрений с первого раза</span>
        </div>
      </div>
    </section>`;
}

function perksSection() {
  return `<section class="perks">
      <div class="perks__in" data-reveal>
        ${eyebrow('Что даёт ВНЖ ЕС', false)}
        <div class="perks__list">
          ${PERKS.map((p) => `<span class="perk"><i aria-hidden="true">✦</i>${esc(p)}</span>`).join('\n          ')}
        </div>
      </div>
    </section>`;
}

function stepsSection(seg, page) {
  const base = page.depth ? '..' : '.';
  /* The permit artwork is the hero on segments without a photo, so showing
     it again here would just repeat the same image down one page. */
  const repeated = !heroPhoto(seg);
  const art = repeated ? '' : `<div class="steps__art" data-reveal>
          <div class="glow" aria-hidden="true"></div>
          <picture>
            <source srcset="${base}/assets/card-720.webp" type="image/webp">
            <img src="${base}/assets/card-720.png" alt="Permiso de residencia España — карта ВНЖ Испании" loading="lazy" decoding="async" width="720" height="540">
          </picture>
        </div>`;

  return `<section class="steps">
      <div class="steps__in">
        <div class="steps__head" data-reveal>
          ${eyebrow('Предварительная проверка', false)}
          <h2 class="h-display steps__h2">${esc(seg.s2Headline)}</h2>
          <p class="steps__sub">${esc(seg.s2Subtitle)}</p>
        </div>
        ${art}
        <div class="steps__grid">
          ${seg.s2Items.map((item) => `<div class="step" data-reveal>
            <span class="step__n">${esc(item.n)}</span>
            <span class="step__t">${esc(item.text)}</span>
          </div>`).join('\n          ')}
        </div>

        <div class="steps__cta" data-reveal>
          <button type="button" class="btn-cta" data-open-modal="second_screen">
            <span>${esc(seg.s2CtaLabel)}</span><span class="btn-cta__arrow" aria-hidden="true">→</span>
          </button>
          <p class="steps__note">${esc(seg.s2CtaNote)}</p>
          <p class="steps__note steps__note--acc">Работаем со всеми программами ВНЖ Испании — подберём оптимальный вариант под ваш кейс.</p>
        </div>
      </div>
    </section>`;
}

function modal(seg, page) {
  const base = page.depth ? '..' : '.';
  return `<div class="modal" id="lead-modal" hidden>
    <div class="modal__box" role="dialog" aria-modal="true" aria-labelledby="lead-modal-title">
      <button type="button" class="modal__x" aria-label="Закрыть" data-close-modal>×</button>
      ${eyebrow(seg.eyebrow, false)}
      <h2 class="h-display modal__h2" id="lead-modal-title">Получите на консультации план оформления ВНЖ Испании 2026</h2>
      <p class="modal__p">Оставьте контакты — предварительно проверим ваш кейс и покажем требования, документы, расходы и сроки оформления.</p>
      <form id="lead-form" novalidate>
        <label class="field">
          <span class="field__label">Имя</span>
          <input type="text" id="lead-name" name="name" autocomplete="given-name" placeholder="Как к вам обращаться"
                 required aria-describedby="lead-name-err">
          <span class="field__err" id="lead-name-err" hidden>Укажите имя</span>
        </label>
        <label class="field">
          <span class="field__label">Телефон</span>
          <span class="field__hint">Оставьте ваш номер WhatsApp</span>
          <input type="tel" id="lead-phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="+34 600 000 000"
                 required aria-describedby="lead-phone-err">
          <span class="field__err" id="lead-phone-err" hidden>Укажите действующий номер WhatsApp в международном формате</span>
        </label>
        <p class="form-error" id="lead-form-err" role="alert" hidden></p>
        <button type="submit" class="btn-cta" id="lead-submit">
          <span id="lead-submit-label">Получить план</span><span class="btn-cta__arrow" aria-hidden="true">→</span>
        </button>
        <p class="modal__consent">Нажимая кнопку, вы соглашаетесь с
          <a href="${base}/privacy/">политикой обработки персональных данных</a>.</p>
      </form>
    </div>
  </div>`;
}

/* --------------------------------------------------------------- pages -- */

function landingPage(seg, opts) {
  const at = opts || {};
  const page = {
    kind: 'landing',
    segment: seg.key,
    hasModal: true,
    theme: seg.theme,
    depth: at.depth === undefined ? 1 : at.depth,
    pathname: at.pathname || `/${seg.dir}/`,
    /* The root serves the flagship landing so a bare domain lands on the
       offer rather than a chooser. It is the same page as /spain-visa/,
       so it points its canonical there — one indexable URL, and the
       address the ads already use stays the authoritative one. */
    canonicalPath: at.canonicalPath || null,
    title: seg.title,
    ogTitle: seg.title,
    description: seg.description,
    og: seg.key,
    preload: (heroPhoto(seg) || {}).webp || (heroPhoto(seg) || {}).jpg || 'assets/card.webp'
  };

  /* Product schema is wrong for a service; Service + a local Organization
     is what Google and Meta's link preview both read cleanly. */
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Оформление ВНЖ Испании',
    name: seg.title,
    description: seg.description,
    areaServed: { '@type': 'Country', name: 'Испания' },
    provider: {
      '@type': 'Organization',
      name: BRAND,
      url: absolute('/'),
      logo: absolute('/assets/logo-gold.png')
    }
  };

  return `${head(page)}
<div class="shell">
  ${header(page)}
  <main>
    ${heroSection(seg, page)}
    ${perksSection()}
    ${stepsSection(seg, page)}
  </main>
  ${footer(page)}
  ${modal(seg, page)}
</div>
<script type="application/ld+json">${jsonForScript(schema)}</script>
${scripts(page)}`;
}

function thanksPage() {
  const page = {
    kind: 'thanks',
    segment: null,
    theme: 'gold',
    depth: 1,
    pathname: '/thank-you/',
    title: 'Заявка получена | ВНЖ Испании Digital Nomad',
    description: 'Заявка получена. Получите план оформления ВНЖ Испании 2026 в Telegram или WhatsApp.',
    og: 'home',
    /* A confirmation page has nothing to rank for and Meta reads its URL
       from the ad, not the index. */
    noindex: true
  };

  return `${head(page)}
<div class="shell">
  ${header(page)}
  <main class="thanks">
    <section class="thanks__in">
      ${eyebrow('Шаг 2 из 2', false)}
      <h1 class="h-display thanks__h1">Заявка получена</h1>
      <p class="thanks__p">Ваш кейс уже передан на предварительную проверку.</p>

      <div class="thanks__video">
        <div class="glow" aria-hidden="true"></div>
        <div class="thanks__frame">
          <button type="button" class="video-facade" id="video-facade" aria-label="Смотреть видео о ВНЖ Испании">
            <span class="video-facade__play">${SVG.play}</span>
          </button>
        </div>
      </div>

      <div class="thanks__card">
        <div class="glow" aria-hidden="true"></div>
        <picture>
          <source srcset="../assets/card-720.webp" type="image/webp">
          <img src="../assets/card-720.png" alt="Permiso de residencia España" loading="lazy" decoding="async" width="720" height="540">
        </picture>
      </div>

      <p class="thanks__lead">Напишите прямо сейчас нашему миграционному эксперту, чтобы начать консультацию по ВНЖ Испании</p>
      <p class="thanks__choose">Выберите удобный мессенджер:</p>
      <div class="thanks__links">
        <a class="msg-btn msg-btn--primary" data-messenger="telegram" href="${esc(CONTACTS.telegram || '#')}" target="_blank" rel="noopener">
          <span>Получить в Telegram</span><span aria-hidden="true">→</span>
        </a>
        <a class="msg-btn msg-btn--ghost" data-messenger="whatsapp" href="${esc(CONTACTS.whatsapp || '#')}" target="_blank" rel="noopener">
          <span>Написать в WhatsApp</span><span aria-hidden="true">→</span>
        </a>
      </div>
      <p class="thanks__fine">В плане: требования 2026 года, документы, расходы, сроки и пошаговый порядок оформления.</p>
      <p class="thanks__fine thanks__fine--muted">Даже если вы не перейдёте в мессенджер, заявка уже сохранена и специалист сможет с вами связаться.</p>
    </section>
  </main>
  ${footer(page)}
</div>
${scripts(page)}`;
}

function privacyPage() {
  const page = {
    kind: 'privacy',
    segment: null,
    theme: 'gold',
    depth: 1,
    pathname: '/privacy/',
    title: 'Политика обработки персональных данных | ' + BRAND,
    description: 'Какие данные собирает сайт, зачем, как долго они хранятся и как отозвать согласие.',
    og: 'home'
  };
  const legal = CFG.legal || {};
  const operator = legal.operator || BRAND;
  const email = legal.operatorEmail || '';
  const updated = new Date().toISOString().slice(0, 10);

  return `${head(page)}
<div class="shell">
  ${header(page)}
  <main>
    <article class="article">
      ${eyebrow('Правовая информация', false)}
      <h1 class="h-display">Политика обработки персональных данных</h1>
      <p class="meta">Редакция от ${esc(updated)}</p>

      <h2>1. Кто обрабатывает данные</h2>
      <p>Оператором персональных данных, собранных на этом сайте, является ${esc(operator)}${email ? `, контакт для обращений — <a href="mailto:${esc(email)}">${esc(email)}</a>` : ''}.</p>

      <h2>2. Какие данные мы собираем</h2>
      <ul>
        <li><strong>Данные, которые вы указываете сами:</strong> имя и номер телефона в форме заявки.</li>
        <li><strong>Технические данные:</strong> IP-адрес, тип устройства и браузера, страница входа, источник перехода и метки рекламной кампании (utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid).</li>
        <li><strong>Файлы cookie:</strong> технические cookie сайта и cookie рекламного пикселя Meta (<code>_fbp</code>, <code>_fbc</code>) — только после вашего согласия.</li>
      </ul>

      <h2>3. Зачем мы их обрабатываем</h2>
      <ul>
        <li>Связаться с вами по оставленной заявке и провести предварительную проверку вашего кейса.</li>
        <li>Оценить эффективность рекламных кампаний — какие объявления приводят обращения.</li>
        <li>Обеспечить работу сайта и защиту от автоматических рассылок.</li>
      </ul>
      <p>Правовое основание — ваше согласие, которое вы даёте, отправляя форму или нажимая «Принять» в баннере об аналитике.</p>

      <h2>4. Кому мы их передаём</h2>
      <ul>
        <li><strong>Meta Platforms Ireland Ltd.</strong> — рекламный пиксель и Conversions API для измерения результатов рекламы. Номер телефона и имя передаются только в необратимо хешированном виде (SHA-256), исходные значения Meta не получает.</li>
        <li><strong>Сервисы доставки заявок</strong> — обработчики, через которые заявка попадает к нашим специалистам.</li>
      </ul>
      <p>Мы не продаём персональные данные и не передаём их третьим лицам для их собственных рекламных целей.</p>

      <h2>5. Сколько мы их храним</h2>
      <p>Данные заявки — не более 24 месяцев с момента обращения либо до отзыва согласия. Рекламные cookie — в течение срока, установленного Meta (до 90 дней), либо до момента, когда вы очистите их в браузере.</p>

      <h2>6. Ваши права</h2>
      <p>Вы вправе запросить доступ к своим данным, их исправление или удаление, ограничить обработку, отозвать согласие и подать жалобу в надзорный орган. Отзыв согласия не влияет на законность обработки, совершённой до отзыва.</p>
      <p>Чтобы воспользоваться любым из этих прав${email ? `, напишите на <a href="mailto:${esc(email)}">${esc(email)}</a>` : ', свяжитесь с нами по контактам, указанным на сайте'}. Мы ответим в течение 30 дней.</p>

      <h2>7. Как отозвать согласие на аналитику</h2>
      <p>Согласие на рекламные cookie хранится в вашем браузере. Очистите данные сайта в настройках браузера — баннер появится снова, и вы сможете выбрать «Отклонить». В этом случае рекламный пиксель не отправит ни одного события.</p>

      <h2>8. Изменения политики</h2>
      <p>Актуальная редакция всегда опубликована на этой странице. Дата редакции указана в начале документа.</p>
    </article>
  </main>
  ${footer(page)}
</div>
${scripts(page)}`;
}

function notFoundPage() {
  const page = {
    kind: 'notfound',
    segment: null,
    theme: 'gold',
    depth: 0,
    pathname: '/404.html',
    title: 'Страница не найдена | ' + BRAND,
    description: 'Такой страницы нет. Вернитесь на страницу об оформлении ВНЖ Испании.',
    og: 'home',
    noindex: true
  };
  return `${head(page)}
<div class="shell">
  ${header(page)}
  <main>
    <section class="hub">
      ${eyebrow('Ошибка 404', false)}
      <h1 class="h-display hub__h1">Такой страницы нет</h1>
      <p class="hub__sub">Возможно, ссылка устарела или в адресе опечатка.</p>
      <div class="cta-block" style="margin-top:clamp(26px,3.4vw,40px)">
        <a class="btn-cta" href="/" style="text-decoration:none">
          <span>Вернуться на главную</span><span class="btn-cta__arrow" aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  </main>
  ${footer(page)}
</div>
${scripts(page)}`;
}

/* --------------------------------------------------------------- write -- */

function write(relPath, contents) {
  const full = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
  const kb = (Buffer.byteLength(contents) / 1024).toFixed(1);
  console.log(`  ${relPath.padEnd(30)} ${kb.padStart(7)} KB`);
}

function main() {
  /* Collected up front so every page can carry the same warning list. */
  const problems = [];
  if (!ORIGIN_SET) problems.push('site.config.json: origin всё ещё example.com — canonical, sitemap и og:image указывают в никуда.');
  if (!INT.metaPixelId) problems.push('site.config.json: не указан metaPixelId — события в Meta не отправляются.');
  if (!INT.leadEndpoint && !INT.formsubmitEmail) problems.push('site.config.json: не настроен ни leadEndpoint, ни formsubmitEmail — заявки никуда не уходят.');
  if (!INT.metaDomainVerification) problems.push('site.config.json: не указан metaDomainVerification — домен не подтверждён в Events Manager.');

  console.log(`\nVisa la Vida — build (origin: ${ORIGIN || 'НЕ ЗАДАН'})\n`);

  write('index.html', landingPage(SEGMENTS.visa, {
    depth: 0,
    pathname: '/',
    canonicalPath: `/${SEGMENTS.visa.dir}/`
  }));
  SEGMENT_ORDER.forEach((key) => {
    const seg = SEGMENTS[key];
    write(`${seg.dir}/index.html`, landingPage(seg));
  });
  write('thank-you/index.html', thanksPage());
  write('privacy/index.html', privacyPage());
  write('404.html', notFoundPage());

  write('assets/site.js', fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8'));

  /* '/' is deliberately absent: it renders the visa landing and canonicals
     to /spain-visa/, so listing both would offer the same page twice. */
  const urls = [...SEGMENT_ORDER.map((k) => `/${SEGMENTS[k].dir}/`), '/privacy/'];
  const today = new Date().toISOString().slice(0, 10);
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${absolute(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);

  write('robots.txt', `User-agent: *
Allow: /
Disallow: /thank-you/

Sitemap: ${absolute('/sitemap.xml')}
`);

  if (problems.length) {
    console.log('\n  ⚠  Перед запуском рекламы:');
    problems.forEach((p) => console.log(`     · ${p}`));
  } else {
    console.log('\n  ✓ Конфигурация полная.');
  }
  console.log('');
}

main();

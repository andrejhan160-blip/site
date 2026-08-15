/** Экраны кабинета клиента. Мобильные по построению: одна колонка. */

function portalShell(state, body, active) {
  const unread = state.notifications.client.filter((n) => !n.read).length;
  const tabs = [
    ['home', 'Обзор'],
    ['documents', 'Документы'],
    ['requests', 'Запросы'],
    ['messages', 'Сообщения'],
  ];

  return `
    <div class="cf-portal">
      <header class="cf-portal-top">
        <div class="cf-portal-bar">
          <span class="cf-brand">
            <span class="cf-brand-mark">${esc(state.org.name.charAt(0))}</span>
            <span class="cf-brand-name">${esc(state.org.name)}</span>
          </span>
          <span class="cf-topbar-actions">
            <button class="cf-bell" data-action="notifications" data-side="client" aria-label="Уведомления">
              🔔${unread ? `<span class="cf-bell-count">${unread}</span>` : ''}
            </button>
            ${avatar(`${state.client.firstName} ${state.client.lastName}`, 'sm')}
          </span>
        </div>
        <nav class="cf-portal-nav">
          ${tabs
            .map(
              ([key, label]) =>
                `<button class="cf-portal-tab${key === active ? ' is-active' : ''}" data-go-client="${key}">${label}</button>`,
            )
            .join('')}
        </nav>
      </header>
      <main class="cf-portal-body">${body}</main>
      <footer class="cf-portal-foot">
        <span>${esc(state.org.name)}</span>
        <span>${esc(state.org.supportEmail)}</span>
      </footer>
    </div>`;
}

function portalHome(state) {
  const kase = state.kase;
  const progress = calculateProgress(kase);
  const stage = currentStage(kase);
  const next = kase.stages.find((s) => s.position === stage.position + 1);
  const open = kase.requests.filter((r) => r.status === 'OPEN');
  const tasks = kase.tasks.filter((t) => t.visibility !== 'INTERNAL' && t.status !== 'COMPLETED');
  const deadlines = kase.requirements
    .filter((r) => r.deadline && ['PENDING', 'REJECTED'].includes(r.status))
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  return `
    <section>
      <h1 class="cf-portal-h1">Здравствуйте, ${esc(state.client.firstName)}</h1>
      <p class="cf-portal-lede">${esc(state.org.welcome)}</p>
    </section>

    <section class="cf-card cf-card--pad">
      <p class="cf-summary-label">Ваше дело</p>
      <h2 class="cf-portal-h2">${esc(kase.title)}</h2>
      ${progressBar(progress)}
      <dl class="cf-portal-dl">
        <div><dt>Текущий этап</dt><dd>${esc(stage.name)}</dd></div>
        <div><dt>Следующий этап</dt><dd>${esc(next ? next.name : 'Последний этап')}</dd></div>
        <div><dt>Ваш специалист</dt><dd>${esc(kase.assignedTo)}</dd></div>
      </dl>
    </section>

    ${
      open.length
        ? `<section class="cf-card">
            <header class="cf-card-head cf-card-head--pad"><h2>Ждём от вас</h2><span class="cf-row-sub">${countOf(open.length, 'открыт', 'открыто', 'открыто')}</span></header>
            <ul class="cf-rows">
              ${open
                .map((r) => {
                  const requirement = kase.requirements.find((x) => x.id === r.requirementId);
                  return `
                  <li class="cf-row cf-row--stack">
                    <span class="cf-row-main">
                      <span class="cf-row-title">${esc(r.title)}</span>
                      ${r.description ? `<span class="cf-row-sub">${esc(r.description)}</span>` : ''}
                      <span class="cf-badges">${deadlineBadge(r.deadline)}${statusBadge('request', r.status)}</span>
                    </span>
                    ${
                      requirement
                        ? `<button class="cf-btn cf-btn--primary" data-action="upload" data-req="${requirement.id}" data-portal="1">⬆ Загрузить</button>`
                        : `<button class="cf-btn cf-btn--secondary" data-action="complete-request" data-req-id="${r.id}">Отметить выполненным</button>`
                    }
                  </li>`;
                })
                .join('')}
            </ul>
          </section>`
        : ''
    }

    ${
      tasks.length
        ? `<section class="cf-card">
            <header class="cf-card-head cf-card-head--pad"><h2>Что подготовить</h2></header>
            <ul class="cf-rows">
              ${tasks
                .map(
                  (t) => `
                <li class="cf-row cf-row--stack">
                  <span class="cf-row-main">
                    <span class="cf-row-title">${esc(t.title)}</span>
                    ${t.description ? `<span class="cf-row-sub">${esc(t.description)}</span>` : ''}
                  </span>
                  <span class="cf-badges">${deadlineBadge(t.deadline)}
                    <button class="cf-btn cf-btn--ghost" data-action="toggle-task" data-task="${t.id}">Отметить выполненной</button>
                  </span>
                </li>`,
                )
                .join('')}
            </ul>
          </section>`
        : ''
    }

    ${
      deadlines.length
        ? `<section class="cf-card">
            <header class="cf-card-head cf-card-head--pad"><h2>Ближайшие сроки</h2></header>
            <ul class="cf-rows">
              ${deadlines
                .map(
                  (r) => `
                <li class="cf-row cf-row--static">
                  <span class="cf-row-main"><span class="cf-row-title">${esc(r.name)}</span>
                    <span class="cf-row-sub">До ${formatDate(r.deadline)}</span></span>
                  ${deadlineBadge(r.deadline)}
                </li>`,
                )
                .join('')}
            </ul>
          </section>`
        : ''
    }

    <section class="cf-card cf-card--pad">
      <h2>Где сейчас ваше дело</h2>
      ${stageTimeline(kase, false)}
    </section>

    <section class="cf-card cf-card--pad">
      <h2>Последние события</h2>
      ${activityFeed(kase.events.slice(-6))}
    </section>`;
}

function portalDocuments(state) {
  const kase = state.kase;
  const groups = [
    { title: 'Нужно загрузить', hint: 'Без них дело не движется дальше.', items: kase.requirements.filter((r) => ['PENDING', 'REJECTED'].includes(r.status)) },
    { title: 'На проверке', hint: 'Документы у нас — от вас ничего не требуется.', items: kase.requirements.filter((r) => ['UNDER_REVIEW', 'UPLOADED'].includes(r.status)) },
    { title: 'Принято', hint: null, items: kase.requirements.filter((r) => ['APPROVED', 'WAIVED'].includes(r.status)) },
  ].filter((g) => g.items.length);

  return `
    <section>
      <h1 class="cf-portal-h1">Документы</h1>
      <p class="cf-portal-lede">Что нужно нам, что вы уже прислали и что с этим стало.</p>
    </section>
    ${groups
      .map(
        (group) => `
      <section class="cf-card">
        <header class="cf-card-head cf-card-head--pad">
          <div><h2>${group.title}</h2>${group.hint ? `<p class="cf-row-sub">${group.hint}</p>` : ''}</div>
          <span class="cf-row-sub">${group.items.length}</span>
        </header>
        <ul class="cf-docs">
          ${group.items.map((r) => documentBlock(r, { canReview: false, canUpload: group.title !== 'Принято', portal: true })).join('')}
        </ul>
      </section>`,
      )
      .join('')}`;
}

function portalRequests(state) {
  const kase = state.kase;
  const overdue = kase.requests.filter((r) => r.status === 'OPEN' && isOverdue(r.deadline));
  const open = kase.requests.filter((r) => r.status === 'OPEN' && !isOverdue(r.deadline));
  const done = kase.requests.filter((r) => r.status !== 'OPEN');

  const group = (title, items, hint) =>
    items.length
      ? `<section class="cf-card">
          <header class="cf-card-head cf-card-head--pad">
            <div><h2>${title}</h2>${hint ? `<p class="cf-row-sub">${hint}</p>` : ''}</div>
            <span class="cf-row-sub">${items.length}</span>
          </header>
          <ul class="cf-rows">
            ${items
              .map((r) => {
                const requirement = kase.requirements.find((x) => x.id === r.requirementId);
                return `
                <li class="cf-row cf-row--stack">
                  <span class="cf-row-main">
                    <span class="cf-row-title">${esc(r.title)}</span>
                    ${r.description ? `<span class="cf-row-sub">${esc(r.description)}</span>` : ''}
                    <span class="cf-badges">${deadlineBadge(r.deadline, r.status !== 'OPEN')}${statusBadge('request', r.status)}
                      <span class="cf-row-sub">${esc(LABELS.requestType[r.type])}${r.completedAt ? ` · выполнено ${formatDate(r.completedAt)}` : ''}</span>
                    </span>
                    ${requirement ? `<span class="cf-row-sub">Что сделать: загрузить «${esc(requirement.name)}»</span>` : ''}
                  </span>
                  ${
                    r.status === 'OPEN'
                      ? requirement
                        ? `<button class="cf-btn cf-btn--primary" data-action="upload" data-req="${requirement.id}" data-portal="1">⬆ Загрузить</button>`
                        : `<button class="cf-btn cf-btn--secondary" data-action="complete-request" data-req-id="${r.id}">Отметить выполненным</button>`
                      : ''
                  }
                </li>`;
              })
              .join('')}
          </ul>
        </section>`
      : '';

  return `
    <section>
      <h1 class="cf-portal-h1">Запросы</h1>
      <p class="cf-portal-lede">Всё, о чём вас просила команда по вашему делу.</p>
    </section>
    ${group('Просрочено', overdue, 'Срок по ним уже прошёл.')}
    ${group('Открытые', open)}
    ${group('Выполненные', done)}`;
}

function portalMessages(state) {
  return `
    <section>
      <h1 class="cf-portal-h1">Сообщения</h1>
      <p class="cf-portal-lede">Пишите команде по вашему делу. Вся переписка привязана к делу.</p>
    </section>
    <section class="cf-card cf-card--pad">
      <h2>${esc(state.kase.title)}</h2>
      <p class="cf-row-sub">специалист: ${esc(state.kase.assignedTo)}</p>
      ${messageThread(state, 'CLIENT')}
    </section>`;
}

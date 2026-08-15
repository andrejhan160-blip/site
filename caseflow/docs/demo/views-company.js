/** Экраны кабинета компании. */

function companyNav(active) {
  const items = [
    ['dashboard', 'Рабочий стол'],
    ['cases', 'Дела'],
    ['clients', 'Клиенты'],
    ['workflows', 'Воркфлоу'],
    ['settings', 'Настройки'],
  ];
  return items
    .map(
      ([key, label]) =>
        `<button class="cf-nav-item${key === active ? ' is-active' : ''}" data-go-company="${key}">${label}</button>`,
    )
    .join('');
}

function companyShell(state, body, active) {
  const unread = state.notifications.staff.filter((n) => !n.read).length;
  return `
    <div class="cf-app">
      <aside class="cf-sidebar">
        <div class="cf-brand">
          <span class="cf-brand-mark">${esc(state.org.name.charAt(0))}</span>
          <span class="cf-brand-text">
            <span class="cf-brand-name">${esc(state.org.name)}</span>
            <span class="cf-brand-sub">CaseFlow</span>
          </span>
        </div>
        <nav class="cf-nav">${companyNav(active)}</nav>
        <p class="cf-sidebar-foot">Клиентские процессы</p>
      </aside>
      <div class="cf-main">
        <header class="cf-topbar">
          <div class="cf-topbar-actions">
            <button class="cf-bell" data-action="notifications" data-side="staff" aria-label="Уведомления">
              🔔${unread ? `<span class="cf-bell-count">${unread}</span>` : ''}
            </button>
            <span class="cf-user">
              ${avatar(state.me.name, 'sm')}
              <span class="cf-user-text">
                <span class="cf-user-name">${esc(state.me.name)}</span>
                <span class="cf-user-role">${esc(LABELS.role[state.me.role])}</span>
              </span>
            </span>
          </div>
        </header>
        <main class="cf-content">${body}</main>
      </div>
    </div>`;
}

function companyDashboard(state) {
  const kase = state.kase;
  const forReview = kase.requirements.filter((r) => r.status === 'UNDER_REVIEW');
  const overdue = kase.requests.filter((r) => r.status === 'OPEN' && isOverdue(r.deadline));
  const soon = [
    ...kase.requirements
      .filter((r) => r.deadline && !['APPROVED', 'WAIVED'].includes(r.status))
      .map((r) => ({ title: r.name, deadline: r.deadline, tab: 'documents' })),
    ...kase.requests
      .filter((r) => r.status === 'OPEN' && r.deadline)
      .map((r) => ({ title: r.title, deadline: r.deadline, tab: 'requests' })),
  ]
    .filter((item) => new Date(item.deadline).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const uploads = kase.requirements
    .flatMap((r) => r.documents.map((d) => ({ ...d, requirement: r.name })))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const metric = (label, value, tone) => `
    <div class="cf-card cf-metric">
      <p class="cf-metric-label">${label}</p>
      <p class="cf-metric-value${tone ? ` cf-metric-value--${tone}` : ''}">${value}</p>
    </div>`;

  return `
    <div class="cf-page-head">
      <h1>Здравствуйте, ${esc(state.me.name.split(' ')[0])}</h1>
      <p>Что требует вашего решения сегодня — по срочности.</p>
    </div>

    <div class="cf-metrics">
      ${metric('Дел в работе', 1)}
      ${metric('Мои дела', 1)}
      ${metric('Документов на проверку', forReview.length, forReview.length ? 'accent' : null)}
      ${metric('Просроченных запросов', overdue.length, overdue.length ? 'danger' : null)}
    </div>

    <div class="cf-grid">
      <section class="cf-card cf-span-2">
        <header class="cf-card-head">
          <div>
            <h2>Дела, требующие внимания</h2>
            <p>Просроченные запросы, документы на проверке или неделя без движения.</p>
          </div>
          <button class="cf-link" data-go-company="cases">Все дела</button>
        </header>
        <button class="cf-row cf-row--button" data-open-case="1">
          <span class="cf-row-main">
            <span class="cf-row-title">${esc(kase.title)}</span>
            <span class="cf-row-sub">${esc(state.client.firstName)} ${esc(state.client.lastName)} · ${esc(currentStage(kase).name)} · активность ${formatRelative(kase.lastActivityAt)}</span>
          </span>
          <span class="cf-row-progress">${progressBar(calculateProgress(kase))}</span>
        </button>
      </section>

      <section class="cf-card">
        <header class="cf-card-head"><h2>Документы на проверке</h2></header>
        ${
          forReview.length === 0
            ? '<p class="cf-empty">Очередь проверки пуста</p>'
            : forReview
                .map(
                  (r) => `
          <button class="cf-row cf-row--button" data-open-case="documents">
            <span class="cf-row-main">
              <span class="cf-row-title">${esc(r.name)}</span>
              <span class="cf-row-sub">${esc(state.client.firstName)} ${esc(state.client.lastName)} · ${formatRelative(r.documents[0]?.createdAt)}</span>
            </span>
          </button>`,
                )
                .join('')
        }
      </section>

      <section class="cf-card">
        <header class="cf-card-head"><h2>Просроченные запросы</h2></header>
        ${
          overdue.length === 0
            ? '<p class="cf-empty">Просрочек нет</p>'
            : overdue
                .map(
                  (r) => `
          <button class="cf-row cf-row--button" data-open-case="requests">
            <span class="cf-row-main">
              <span class="cf-row-title">${esc(r.title)}</span>
              <span class="cf-row-sub">${esc(kase.title)}</span>
            </span>
            <span>${deadlineBadge(r.deadline)}</span>
          </button>`,
                )
                .join('')
        }
      </section>

      <section class="cf-card">
        <header class="cf-card-head"><h2>Сроки в ближайшие 48 часов</h2></header>
        ${
          soon.length === 0
            ? '<p class="cf-empty">На два дня вперёд сроков нет</p>'
            : soon
                .map(
                  (item) => `
          <button class="cf-row cf-row--button" data-open-case="${item.tab}">
            <span class="cf-row-main">
              <span class="cf-row-title">${esc(item.title)}</span>
              <span class="cf-row-sub">${esc(kase.title)}</span>
            </span>
            <span>${deadlineBadge(item.deadline)}</span>
          </button>`,
                )
                .join('')
        }
      </section>

      <section class="cf-card">
        <header class="cf-card-head"><h2>Последние загрузки</h2></header>
        ${
          uploads.length === 0
            ? '<p class="cf-empty">Загрузок пока нет</p>'
            : uploads
                .map(
                  (d) => `
          <button class="cf-row cf-row--button" data-open-case="documents">
            <span class="cf-row-main">
              <span class="cf-row-title">${esc(d.filename)}</span>
              <span class="cf-row-sub">${esc(d.requirement)} · ${formatBytes(d.fileSize)} · ${formatRelative(d.createdAt)}</span>
            </span>
          </button>`,
                )
                .join('')
        }
      </section>
    </div>`;
}

const currentStage = (kase) => kase.stages.find((s) => s.status === 'ACTIVE') ?? kase.stages[0];

function companyCases(state) {
  const kase = state.kase;
  return `
    <div class="cf-page-head cf-page-head--row">
      <div>
        <h1>Дела</h1>
        <p>Все процессы команды и этап, на котором каждый стоит.</p>
      </div>
      <button class="cf-btn cf-btn--primary" data-action="new-case-hint">＋ Новое дело</button>
    </div>

    <div class="cf-filters">
      <input class="cf-input" placeholder="Поиск по делу, клиенту или ID сделки" data-action="noop" />
      <select class="cf-input cf-input--auto"><option>Статус</option><option>В работе</option></select>
      <select class="cf-input cf-input--auto"><option>Сотрудник</option><option>Амели Лоран</option></select>
      <select class="cf-input cf-input--auto"><option>Этап</option>${kase.stages.map((s) => `<option>${esc(s.name)}</option>`).join('')}</select>
    </div>

    <div class="cf-card">
      <button class="cf-row cf-row--button" data-open-case="1">
        <span class="cf-row-main">
          <span class="cf-row-title">${esc(kase.title)}</span>
          <span class="cf-row-sub">${esc(state.client.firstName)} ${esc(state.client.lastName)} · сделка №${esc(kase.crmDealId)} · обновлено ${formatRelative(kase.lastActivityAt)}</span>
        </span>
        <span class="cf-chip-plain">${esc(currentStage(kase).name)}</span>
        ${statusBadge('case', kase.status)}
        <span class="cf-row-user">${avatar(kase.assignedTo, 'sm')}<span>${esc(kase.assignedTo)}</span></span>
        <span class="cf-row-progress">${progressBar(calculateProgress(kase))}</span>
      </button>
    </div>`;
}

function companyClients(state) {
  const kase = state.kase;
  return `
    <div class="cf-page-head cf-page-head--row">
      <div>
        <h1>Клиенты</h1>
        <p>Все, чьи дела ведёт ваша команда.</p>
      </div>
      <button class="cf-btn cf-btn--primary" data-action="new-case-hint">＋ Новый клиент</button>
    </div>
    <div class="cf-card">
      <table class="cf-table">
        <thead>
          <tr><th>Клиент</th><th>Дел в работе</th><th>Ответственный</th><th>Последняя активность</th><th>Статус</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <span class="cf-cell-user">${avatar(`${state.client.firstName} ${state.client.lastName}`, 'sm')}
                <span><span class="cf-row-title">${esc(state.client.firstName)} ${esc(state.client.lastName)}</span>
                <span class="cf-row-sub">${esc(state.client.email)}</span></span>
              </span>
            </td>
            <td>1</td>
            <td>${esc(kase.assignedTo)}</td>
            <td>${formatRelative(kase.lastActivityAt)}</td>
            <td>${badge('accent', 'В работе')}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

function companyWorkflows(state) {
  const kase = state.kase;
  const byStage = (stage) => kase.requirements.filter((r) => r.stageId === stage.id);
  return `
    <div class="cf-page-head">
      <h1>Воркфлоу</h1>
      <p>Шаблоны процессов. При открытии дела шаблон копируется — правки шаблона уже существующие дела не меняют.</p>
    </div>
    <div class="cf-card">
      <header class="cf-card-head">
        <div><h2>${esc(kase.workflow)}</h2><p>${countOf(kase.stages.length, 'этап', 'этапа', 'этапов')} · ${countOf(kase.requirements.length, 'документ', 'документа', 'документов')}</p></div>
        ${badge('success', 'Активен')}
      </header>
      <ol class="cf-workflow">
        ${kase.stages
          .map(
            (stage, index) => `
          <li>
            <span class="cf-workflow-num">${index + 1}</span>
            <div>
              <p class="cf-row-title">${esc(stage.name)}</p>
              <p class="cf-row-sub">${esc(stage.description)}</p>
              ${
                byStage(stage).length
                  ? `<ul class="cf-workflow-docs">${byStage(stage).map((r) => `<li>${esc(r.name)}${r.required ? '' : ' <em>(по желанию)</em>'}</li>`).join('')}</ul>`
                  : ''
              }
            </div>
          </li>`,
          )
          .join('')}
      </ol>
    </div>`;
}

function companySettings(state) {
  return `
    <div class="cf-page-head">
      <h1>Настройки</h1>
      <p>Как ваша компания выглядит для клиентов. Меняйте — оба кабинета перерисуются сразу.</p>
    </div>
    <div class="cf-card cf-card--pad">
      <div class="cf-field">
        <label>Название компании</label>
        <input class="cf-input" value="${esc(state.org.name)}" data-bind="org.name" />
      </div>
      <div class="cf-field">
        <label>Основной цвет</label>
        <div class="cf-color-row">
          <input type="color" value="${esc(state.org.primaryColor)}" data-bind="org.primaryColor" />
          <span class="cf-mono">${esc(state.org.primaryColor)}</span>
        </div>
      </div>
      <div class="cf-field">
        <label>Приветствие в кабинете клиента</label>
        <textarea class="cf-input" rows="3" data-bind="org.welcome">${esc(state.org.welcome)}</textarea>
      </div>
      <p class="cf-hint">Изменения применяются мгновенно — переключитесь на кабинет клиента и посмотрите.</p>
    </div>`;
}

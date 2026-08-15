/** Карточка дела — главный экран сотрудника. */

function stageTimeline(kase, showRequirements) {
  return `<ol class="cf-timeline">
    ${kase.stages
      .map((stage) => {
        const own = kase.requirements.filter((r) => r.stageId === stage.id);
        const icon = stage.status === 'COMPLETED' ? '✓' : stage.status === 'ACTIVE' ? '●' : '';
        const note =
          stage.status === 'COMPLETED' && stage.completedAt
            ? `Завершён ${formatDate(stage.completedAt)}`
            : LABELS.stage[stage.status];
        return `
        <li class="cf-timeline-item is-${stage.status.toLowerCase()}">
          <span class="cf-timeline-dot">${icon}</span>
          <div class="cf-timeline-body">
            <div class="cf-timeline-head">
              <span class="cf-timeline-name">${esc(stage.name)}</span>
              <span class="cf-timeline-note">${esc(note)}</span>
            </div>
            ${stage.description ? `<p class="cf-row-sub">${esc(stage.description)}</p>` : ''}
            ${
              showRequirements && own.length
                ? `<ul class="cf-timeline-docs">${own
                    .map(
                      (r) =>
                        `<li><span class="cf-dot cf-dot--${TONES.requirement[r.status]}"></span>${esc(r.name)}${r.required ? '' : ' <em>(по желанию)</em>'}</li>`,
                    )
                    .join('')}</ul>`
                : ''
            }
          </div>
        </li>`;
      })
      .join('')}
  </ol>`;
}

function documentBlock(requirement, { canReview, canUpload, portal }) {
  const latest = requirement.documents[0];
  const history = requirement.documents.slice(1);
  const settled = requirement.status === 'APPROVED' || requirement.status === 'WAIVED';

  return `
    <li class="cf-doc">
      <div class="cf-doc-head">
        <div class="cf-doc-title">
          <p class="cf-row-title">${esc(requirement.name)}${requirement.required ? '' : ' <em class="cf-row-sub">по желанию</em>'}</p>
          <div class="cf-badges">
            ${statusBadge('requirement', requirement.status)}
            ${deadlineBadge(requirement.deadline, settled)}
          </div>
          ${requirement.instructions ? `<p class="cf-row-sub">${esc(requirement.instructions)}</p>` : ''}
        </div>
        ${
          canUpload && requirement.status !== 'APPROVED'
            ? `<button class="cf-btn ${requirement.status === 'REJECTED' ? 'cf-btn--primary' : 'cf-btn--secondary'}"
                 data-action="upload" data-req="${requirement.id}" data-portal="${portal ? '1' : ''}">
                 ⬆ ${requirement.documents.length ? 'Загрузить замену' : 'Загрузить'}
               </button>`
            : ''
        }
      </div>

      ${
        latest
          ? `<div class="cf-file">
              <div class="cf-file-head">
                <div class="cf-file-meta">
                  <span class="cf-file-icon">📄</span>
                  <span>
                    <span class="cf-row-title">${esc(latest.filename)}</span>
                    <span class="cf-row-sub">в. ${latest.version} · ${formatBytes(latest.fileSize)} · загружен ${formatDateTime(latest.createdAt)}</span>
                  </span>
                </div>
                <div class="cf-file-actions">
                  ${statusBadge('document', latest.status)}
                  ${
                    canReview && latest.status === 'UNDER_REVIEW'
                      ? `<button class="cf-btn cf-btn--success" data-action="approve" data-doc="${latest.id}">✓ Принять</button>
                         <button class="cf-btn cf-btn--secondary" data-action="reject" data-doc="${latest.id}">✕ Отклонить</button>`
                      : ''
                  }
                </div>
              </div>
              ${
                latest.status === 'REJECTED' && latest.rejectionReason
                  ? `<p class="cf-reject"><strong>Отклонён:</strong> ${esc(latest.rejectionReason)}</p>`
                  : ''
              }
              ${
                latest.status === 'APPROVED' && latest.reviewedAt
                  ? `<p class="cf-approved">Принят ${formatDateTime(latest.reviewedAt)}${latest.reviewedBy ? `, ${esc(latest.reviewedBy)}` : ''}</p>`
                  : ''
              }
            </div>`
          : ''
      }

      ${
        history.length
          ? `<details class="cf-history">
              <summary>${countOf(history.length, 'предыдущая версия', 'предыдущие версии', 'предыдущих версий')}</summary>
              <ul>${history
                .map(
                  (d) =>
                    `<li>в. ${d.version} · ${esc(d.filename)} · ${formatDateTime(d.createdAt)} ${statusBadge('document', d.status)}</li>`,
                )
                .join('')}</ul>
            </details>`
          : ''
      }
    </li>`;
}

function companyCase(state, tab) {
  const kase = state.kase;
  const progress = calculateProgress(kase);
  const stage = currentStage(kase);
  const openRequests = kase.requests.filter((r) => r.status === 'OPEN');
  const pendingDocs = kase.requirements.filter((r) => !['APPROVED', 'WAIVED'].includes(r.status));
  const openTasks = kase.tasks.filter((t) => t.status !== 'COMPLETED');
  const approved = kase.requirements.filter((r) => r.status === 'APPROVED').length;

  const tabs = [
    ['overview', 'Обзор', 0],
    ['stages', 'Этапы', 0],
    ['documents', 'Документы', pendingDocs.length],
    ['requests', 'Запросы', openRequests.length],
    ['tasks', 'Задачи', openTasks.length],
    ['messages', 'Сообщения', kase.messages.length],
    ['activity', 'История', 0],
  ];

  const body = {
    overview: () => `
      <div class="cf-grid">
        <section class="cf-card cf-card--pad cf-span-2">
          <h2>Что с делом сейчас</h2>
          <p class="cf-row-sub">${esc(kase.description)}</p>
          <h3 class="cf-subhead">Ждём от клиента</h3>
          ${
            openRequests.length === 0 && pendingDocs.length === 0
              ? '<p class="cf-empty">Сейчас от клиента ничего не ждём.</p>'
              : `<ul class="cf-list">
                  ${openRequests.map((r) => `<li><span>${esc(r.title)}</span><span class="cf-badges">${deadlineBadge(r.deadline)}${statusBadge('request', r.status)}</span></li>`).join('')}
                  ${pendingDocs
                    .filter((r) => r.status !== 'UNDER_REVIEW')
                    .map((r) => `<li><span>${esc(r.name)}</span><span class="cf-badges">${deadlineBadge(r.deadline)}${statusBadge('requirement', r.status)}</span></li>`)
                    .join('')}
                </ul>`
          }
          <h3 class="cf-subhead">На стороне команды</h3>
          <ul class="cf-list">
            ${kase.requirements
              .filter((r) => r.status === 'UNDER_REVIEW')
              .map((r) => `<li><span>${esc(r.name)}</span>${badge('info', 'Ждёт проверки')}</li>`)
              .join('')}
            ${openTasks.map((t) => `<li><span>${esc(t.title)}</span><span class="cf-badges">${deadlineBadge(t.deadline)}${statusBadge('task', t.status)}</span></li>`).join('')}
          </ul>
        </section>
        <section class="cf-card cf-card--pad">
          <h2>Этапы</h2>
          ${stageTimeline(kase, false)}
        </section>
      </div>`,

    stages: () => `
      <section class="cf-card cf-card--pad">
        <header class="cf-card-head"><h2>Этапы воркфлоу</h2>
          <button class="cf-btn cf-btn--secondary" data-action="change-stage">Сменить этап</button>
        </header>
        ${stageTimeline(kase, true)}
      </section>`,

    documents: () => `
      <section class="cf-card">
        <header class="cf-card-head cf-card-head--pad"><h2>Документы</h2>
          <button class="cf-btn cf-btn--primary" data-action="request-document">＋ Запросить документ</button>
        </header>
        <ul class="cf-docs">
          ${kase.requirements.map((r) => documentBlock(r, { canReview: true, canUpload: true, portal: false })).join('')}
        </ul>
      </section>`,

    requests: () => `
      <section class="cf-card">
        <header class="cf-card-head cf-card-head--pad"><h2>Запросы клиенту</h2>
          <button class="cf-btn cf-btn--secondary" data-action="new-request">＋ Новый запрос</button>
        </header>
        <ul class="cf-rows">
          ${kase.requests
            .map(
              (r) => `
            <li class="cf-row cf-row--static">
              <span class="cf-row-main">
                <span class="cf-row-title">${esc(r.title)}</span>
                ${r.description ? `<span class="cf-row-sub">${esc(r.description)}</span>` : ''}
                <span class="cf-row-sub">${esc(LABELS.requestType[r.type])} · создан ${formatDate(r.createdAt)}, ${esc(r.createdBy)}${r.completedAt ? ` · выполнен ${formatDate(r.completedAt)}` : ''}</span>
              </span>
              <span class="cf-badges">
                ${deadlineBadge(r.deadline, r.status !== 'OPEN')}
                ${statusBadge('request', r.status)}
                ${r.status === 'OPEN' ? `<button class="cf-btn cf-btn--ghost" data-action="cancel-request" data-req-id="${r.id}">Отменить</button>` : ''}
              </span>
            </li>`,
            )
            .join('')}
        </ul>
      </section>`,

    tasks: () => `
      <section class="cf-card">
        <header class="cf-card-head cf-card-head--pad"><h2>Задачи</h2>
          <button class="cf-btn cf-btn--secondary" data-action="new-task">＋ Новая задача</button>
        </header>
        <ul class="cf-rows">
          ${kase.tasks
            .map(
              (t) => `
            <li class="cf-row cf-row--static">
              <span class="cf-row-main">
                <span class="cf-row-title">${esc(t.title)}</span>
                ${t.description ? `<span class="cf-row-sub">${esc(t.description)}</span>` : ''}
                <span class="cf-row-sub">${esc(t.assignedTo)} · ${esc(LABELS.visibility[t.visibility])}</span>
              </span>
              <span class="cf-badges">
                ${deadlineBadge(t.deadline, t.status === 'COMPLETED')}
                ${statusBadge('task', t.status)}
                <button class="cf-btn cf-btn--ghost" data-action="toggle-task" data-task="${t.id}">
                  ${t.status === 'COMPLETED' ? 'Вернуть в работу' : 'Отметить выполненной'}
                </button>
              </span>
            </li>`,
            )
            .join('')}
        </ul>
      </section>`,

    messages: () => `
      <section class="cf-card cf-card--pad">
        <h2>Переписка с клиентом: ${esc(state.client.firstName)}</h2>
        ${messageThread(state, 'STAFF')}
      </section>`,

    activity: () => `
      <section class="cf-card cf-card--pad">
        <header class="cf-card-head"><h2>История дела</h2><p class="cf-row-sub">Только дополняется — записи не редактируются.</p></header>
        ${activityFeed(kase.events)}
      </section>`,
  }[tab]();

  return `
    <button class="cf-back" data-go-company="cases">← Все дела</button>
    <div class="cf-page-head cf-page-head--row">
      <div>
        <h1>${esc(kase.title)} ${statusBadge('case', kase.status)}</h1>
        <p>${esc(state.client.firstName)} ${esc(state.client.lastName)} · ${esc(state.client.email)} · сделка в CRM №${esc(kase.crmDealId)}</p>
      </div>
    </div>

    <div class="cf-actions">
      <button class="cf-btn cf-btn--primary" data-action="request-document">＋ Запросить документ</button>
      <button class="cf-btn cf-btn--secondary" data-action="change-stage">Сменить этап</button>
      <button class="cf-btn cf-btn--secondary" data-action="new-request">Новый запрос</button>
      <button class="cf-btn cf-btn--secondary" data-action="new-task">Новая задача</button>
    </div>

    <div class="cf-card cf-summary">
      <div><span class="cf-summary-label">Текущий этап</span><span class="cf-summary-value">${esc(stage.name)}</span><span class="cf-row-sub">Этап ${stage.position + 1} из ${kase.stages.length}</span></div>
      <div><span class="cf-summary-label">Прогресс</span>${progressBar(progress)}<span class="cf-row-sub">Принято ${approved} из ${countOf(kase.requirements.length, 'документа', 'документов', 'документов')}</span></div>
      <div><span class="cf-summary-label">Ответственный</span><span class="cf-summary-value cf-row-user">${avatar(kase.assignedTo, 'sm')}${esc(kase.assignedTo)}</span></div>
      <div><span class="cf-summary-label">Воркфлоу</span><span class="cf-summary-value">${esc(kase.workflow)}</span><span class="cf-row-sub">Открыто ${formatDate(kase.createdAt)} · обновлено ${formatRelative(kase.lastActivityAt)}</span></div>
    </div>

    <nav class="cf-tabs">
      ${tabs
        .map(
          ([key, label, count]) =>
            `<button class="cf-tab${key === tab ? ' is-active' : ''}" data-tab="${key}">${label}${count ? `<span class="cf-tab-count">${count}</span>` : ''}</button>`,
        )
        .join('')}
    </nav>

    <div class="cf-tab-body">${body}</div>`;
}

function activityFeed(events) {
  if (!events.length) return '<p class="cf-empty">Пока ничего не происходило.</p>';
  return `<ol class="cf-feed">
    ${[...events]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(
        (e) => `
      <li>
        <span class="cf-feed-dot cf-feed-dot--${e.actor.toLowerCase()}"></span>
        <p>${esc(e.text)}</p>
        <p class="cf-row-sub">${esc(e.label)} · ${formatDateTime(e.createdAt)} (${formatRelative(e.createdAt)})</p>
      </li>`,
      )
      .join('')}
  </ol>`;
}

function messageThread(state, side) {
  const kase = state.kase;
  return `
    <div class="cf-thread">
      ${kase.messages
        .map(
          (m) => `
        <div class="cf-msg${m.from === side ? ' is-mine' : ''}">
          ${avatar(m.author, 'sm')}
          <div>
            <div class="cf-bubble">${esc(m.body)}</div>
            <p class="cf-row-sub">${esc(m.author)} · ${formatDateTime(m.createdAt)}</p>
          </div>
        </div>`,
        )
        .join('')}
    </div>
    <form class="cf-composer" data-send="${side}">
      <textarea class="cf-input" rows="3" name="body" placeholder="${side === 'STAFF' ? 'Написать клиенту…' : 'Написать вашему специалисту…'}" required></textarea>
      <div class="cf-composer-foot">
        <span class="cf-row-sub">Ответы появляются сразу — обе стороны смотрят на одно дело.</span>
        <button class="cf-btn cf-btn--primary" type="submit">Отправить</button>
      </div>
    </form>`;
}

/**
 * Витрина CaseFlow: два кабинета поверх одного состояния.
 *
 * Состояние живёт в памяти вкладки — сервера, базы и файлового хранилища за
 * ней нет. Всё остальное настоящее: действие в одном кабинете меняет данные,
 * которые тут же видит второй, прогресс пересчитывается той же формулой, что
 * на бэкенде, а отказ без причины не проходит.
 */

let state = createState();

const route = { cabinet: 'company', company: 'dashboard', tab: 'overview', client: 'home' };

const mounts = {
  company: () => document.getElementById('cf-company'),
  client: () => document.getElementById('cf-client'),
};

// --- события и уведомления -------------------------------------------------

function logEvent(actor, label, text) {
  state.kase.events.push({ id: uid('ev'), actor, label, text, createdAt: new Date().toISOString() });
  state.kase.lastActivityAt = new Date().toISOString();
}

function notify(side, subject, body) {
  state.notifications[side].unshift({
    id: uid('n'),
    subject,
    body,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

function toast(text) {
  const node = document.getElementById('cf-toast');
  node.textContent = text;
  node.classList.add('is-visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('is-visible'), 2600);
}

// --- отрисовка -------------------------------------------------------------

function render() {
  document.documentElement.style.setProperty('--brand', state.org.primaryColor);

  const companyBody = {
    dashboard: () => companyDashboard(state),
    cases: () => companyCases(state),
    case: () => companyCase(state, route.tab),
    clients: () => companyClients(state),
    workflows: () => companyWorkflows(state),
    settings: () => companySettings(state),
  }[route.company]();

  mounts.company().innerHTML = companyShell(state, companyBody, route.company === 'case' ? 'cases' : route.company);

  const clientBody = {
    home: () => portalHome(state),
    documents: () => portalDocuments(state),
    requests: () => portalRequests(state),
    messages: () => portalMessages(state),
  }[route.client]();

  mounts.client().innerHTML = portalShell(state, clientBody, route.client);
}

// --- модальные окна --------------------------------------------------------

function openModal({ title, description, fields, submitLabel, onSubmit }) {
  const host = document.getElementById('cf-modal');
  host.innerHTML = `
    <div class="cf-modal-backdrop" data-close-modal></div>
    <form class="cf-modal" novalidate>
      <header class="cf-modal-head">
        <div>
          <h2>${esc(title)}</h2>
          ${description ? `<p>${esc(description)}</p>` : ''}
        </div>
        <button type="button" class="cf-modal-close" data-close-modal aria-label="Закрыть">✕</button>
      </header>
      <div class="cf-modal-body">
        ${fields
          .map((field) => {
            if (field.type === 'checkbox') {
              return `<label class="cf-check"><input type="checkbox" name="${field.name}" ${field.checked ? 'checked' : ''}/> ${esc(field.label)}</label>`;
            }
            const control =
              field.type === 'textarea'
                ? `<textarea class="cf-input" name="${field.name}" rows="${field.rows ?? 3}" placeholder="${esc(field.placeholder ?? '')}"></textarea>`
                : field.type === 'select'
                  ? `<select class="cf-input" name="${field.name}">${field.options.map((o) => `<option value="${esc(o.value)}"${o.selected ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`
                  : `<input class="cf-input" type="${field.type ?? 'text'}" name="${field.name}" placeholder="${esc(field.placeholder ?? '')}" />`;
            return `<div class="cf-field"><label>${esc(field.label)}</label>${control}${field.hint ? `<p class="cf-hint">${esc(field.hint)}</p>` : ''}</div>`;
          })
          .join('')}
        <p class="cf-modal-error" hidden></p>
      </div>
      <footer class="cf-modal-foot">
        <button type="button" class="cf-btn cf-btn--secondary" data-close-modal>Отмена</button>
        <button type="submit" class="cf-btn cf-btn--primary">${esc(submitLabel)}</button>
      </footer>
    </form>`;
  host.hidden = false;

  const form = host.querySelector('form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    for (const field of fields) {
      if (field.type === 'checkbox') values[field.name] = form.querySelector(`[name="${field.name}"]`).checked;
    }
    const error = onSubmit(values);
    if (error) {
      const box = form.querySelector('.cf-modal-error');
      box.textContent = error;
      box.hidden = false;
      return;
    }
    closeModal();
    render();
  });
  form.querySelector('input, textarea, select')?.focus();
}

function closeModal() {
  const host = document.getElementById('cf-modal');
  host.hidden = true;
  host.innerHTML = '';
}

// --- действия --------------------------------------------------------------

const findRequirement = (id) => state.kase.requirements.find((r) => r.id === id);
const findDocument = (id) => {
  for (const requirement of state.kase.requirements) {
    const document = requirement.documents.find((d) => d.id === id);
    if (document) return { requirement, document };
  }
  return null;
};

const actions = {
  'request-document'() {
    openModal({
      title: 'Запрос документа',
      description: 'Создаёт требование и запрос клиенту, отправляет уведомление.',
      submitLabel: 'Отправить запрос',
      fields: [
        { name: 'name', label: 'Документ', placeholder: 'Например: полис медицинского страхования' },
        {
          name: 'stageId',
          label: 'Этап',
          type: 'select',
          options: state.kase.stages.map((s) => ({ value: s.id, label: `${s.position + 1}. ${s.name}`, selected: s.status === 'ACTIVE' })),
        },
        { name: 'instructions', label: 'Инструкция', type: 'textarea', placeholder: 'Что именно загрузить — клиент увидит этот текст дословно.' },
        { name: 'deadline', label: 'Срок', type: 'date' },
        { name: 'required', label: 'Обязательный документ', type: 'checkbox', checked: true },
        { name: 'notify', label: 'Уведомить клиента', type: 'checkbox', checked: true },
      ],
      onSubmit(values) {
        const name = values.name.trim();
        if (!name) return 'Укажите название документа';

        const requirement = {
          id: uid('req'),
          stageId: values.stageId,
          name,
          instructions: values.instructions.trim() || null,
          required: values.required,
          deadline: values.deadline ? new Date(values.deadline).toISOString() : null,
          status: 'PENDING',
          documents: [],
        };
        state.kase.requirements.push(requirement);
        state.kase.requests.unshift({
          id: uid('rq'),
          type: 'DOCUMENT',
          title: name,
          description: requirement.instructions,
          deadline: requirement.deadline,
          status: 'OPEN',
          requirementId: requirement.id,
          createdAt: new Date().toISOString(),
          createdBy: state.me.name,
          completedAt: null,
        });

        logEvent('USER', state.me.name, `Запрошен документ «${name}»`);
        if (values.notify) notify('client', `Нужен документ: ${name}`, requirement.instructions ?? 'Загрузите документ в кабинете.');
        toast('Запрос отправлен клиенту');
        return null;
      },
    });
  },

  approve(button) {
    const found = findDocument(button.dataset.doc);
    if (!found) return;
    found.document.status = 'APPROVED';
    found.document.reviewedAt = new Date().toISOString();
    found.document.reviewedBy = state.me.name;
    found.document.rejectionReason = null;
    found.requirement.status = 'APPROVED';

    state.kase.requests
      .filter((r) => r.requirementId === found.requirement.id && r.status === 'OPEN')
      .forEach((r) => {
        r.status = 'COMPLETED';
        r.completedAt = new Date().toISOString();
      });

    logEvent('USER', state.me.name, `Принят документ ${found.document.filename}`);
    notify('client', `Документ принят: ${found.document.filename}`, 'Спасибо, документ принят.');
    toast('Документ принят');
    render();
  },

  reject(button) {
    const found = findDocument(button.dataset.doc);
    if (!found) return;
    openModal({
      title: 'Отклонить документ',
      description: `${found.document.filename} — клиент увидит эту причину и загрузит замену.`,
      submitLabel: 'Отклонить документ',
      fields: [
        {
          name: 'reason',
          label: 'Причина отказа',
          type: 'textarea',
          rows: 4,
          hint: 'Напишите конкретно, что не так — клиент увидит только это.',
          placeholder: 'Например: полис истекает раньше конца запрошенного срока.',
        },
      ],
      onSubmit(values) {
        const reason = values.reason.trim();
        // То же правило, что на сервере: отказ без причины не принимается.
        if (!reason) return 'Укажите причину отказа — её увидит клиент';

        found.document.status = 'REJECTED';
        found.document.rejectionReason = reason;
        found.document.reviewedAt = new Date().toISOString();
        found.document.reviewedBy = state.me.name;
        found.requirement.status = 'REJECTED';

        const existing = state.kase.requests.find((r) => r.requirementId === found.requirement.id);
        if (existing) {
          existing.status = 'OPEN';
          existing.completedAt = null;
          existing.description = reason;
        } else {
          state.kase.requests.unshift({
            id: uid('rq'),
            type: 'DOCUMENT',
            title: `Заменить: ${found.requirement.name}`,
            description: reason,
            deadline: found.requirement.deadline,
            status: 'OPEN',
            requirementId: found.requirement.id,
            createdAt: new Date().toISOString(),
            createdBy: state.me.name,
            completedAt: null,
          });
        }

        logEvent('USER', state.me.name, `Отклонён документ ${found.document.filename}`);
        notify('client', `Нужно загрузить заново: ${found.document.filename}`, reason);
        toast('Документ отклонён, клиент уведомлён');
        return null;
      },
    });
  },

  'change-stage'() {
    const kase = state.kase;
    openModal({
      title: 'Смена этапа',
      description: 'Предыдущие этапы отмечаются завершёнными, клиент получает уведомление.',
      submitLabel: 'Перевести дело',
      fields: [
        {
          name: 'stageId',
          label: 'Перевести на этап',
          type: 'select',
          options: kase.stages.map((s) => ({
            value: s.id,
            label: `${s.position + 1}. ${s.name}${s.status === 'ACTIVE' ? ' (текущий)' : ''}`,
            selected: s.status === 'ACTIVE',
          })),
        },
        { name: 'note', label: 'Внутренняя заметка', type: 'textarea', rows: 2, hint: 'Попадёт в историю дела; клиент её не увидит.' },
      ],
      onSubmit(values) {
        const target = kase.stages.find((s) => s.id === values.stageId);
        if (!target) return 'Выберите этап';
        const from = currentStage(kase);
        if (target.id === from.id) return 'Дело уже на этом этапе';

        kase.stages.forEach((stage) => {
          if (stage.position < target.position) {
            stage.status = 'COMPLETED';
            stage.completedAt = stage.completedAt ?? new Date().toISOString();
          } else if (stage.position === target.position) {
            stage.status = 'ACTIVE';
            stage.completedAt = null;
          } else {
            stage.status = 'PENDING';
            stage.completedAt = null;
          }
        });

        logEvent('USER', state.me.name, `Этап изменён с «${from.name}» на «${target.name}»`);
        notify('client', `Дело перешло на этап «${target.name}»`, `Ваше дело «${kase.title}» перешло на этап «${target.name}».`);
        toast(`Дело на этапе «${target.name}»`);
        return null;
      },
    });
  },

  'new-request'() {
    openModal({
      title: 'Запрос клиенту',
      description: 'Для информации, подтверждений и действий, которые не являются документом.',
      submitLabel: 'Отправить запрос',
      fields: [
        { name: 'title', label: 'Заголовок', placeholder: 'Например: подтвердите даты поездки' },
        {
          name: 'type',
          label: 'Тип',
          type: 'select',
          options: [
            { value: 'INFORMATION', label: 'Информация' },
            { value: 'ACTION', label: 'Действие' },
            { value: 'APPOINTMENT', label: 'Запись на приём' },
            { value: 'PAYMENT_CONFIRMATION', label: 'Подтверждение оплаты' },
          ],
        },
        { name: 'description', label: 'Описание', type: 'textarea' },
        { name: 'deadline', label: 'Срок', type: 'date' },
        { name: 'notify', label: 'Уведомить клиента', type: 'checkbox', checked: true },
      ],
      onSubmit(values) {
        const title = values.title.trim();
        if (!title) return 'Укажите заголовок запроса';
        state.kase.requests.unshift({
          id: uid('rq'),
          type: values.type,
          title,
          description: values.description.trim() || null,
          deadline: values.deadline ? new Date(values.deadline).toISOString() : null,
          status: 'OPEN',
          requirementId: null,
          createdAt: new Date().toISOString(),
          createdBy: state.me.name,
          completedAt: null,
        });
        logEvent('USER', state.me.name, `Новый запрос: ${title}`);
        if (values.notify) notify('client', `Новый запрос: ${title}`, values.description || 'Откройте кабинет, чтобы ответить.');
        toast('Запрос отправлен клиенту');
        return null;
      },
    });
  },

  'new-task'() {
    openModal({
      title: 'Новая задача',
      description: 'Внутренние задачи видит только команда. Клиентские появляются в его кабинете.',
      submitLabel: 'Создать задачу',
      fields: [
        { name: 'title', label: 'Заголовок' },
        { name: 'description', label: 'Описание', type: 'textarea' },
        {
          name: 'assignedTo',
          label: 'Исполнитель',
          type: 'select',
          options: state.staff.map((u) => ({ value: u.name, label: u.name, selected: u.name === state.me.name })),
        },
        { name: 'deadline', label: 'Срок', type: 'date' },
        {
          name: 'visibility',
          label: 'Кому видно',
          type: 'select',
          options: [
            { value: 'INTERNAL', label: 'Только для команды' },
            { value: 'CLIENT', label: 'Только клиенту' },
            { value: 'BOTH', label: 'Команде и клиенту' },
          ],
        },
      ],
      onSubmit(values) {
        const title = values.title.trim();
        if (!title) return 'Укажите заголовок задачи';
        state.kase.tasks.unshift({
          id: uid('task'),
          title,
          description: values.description.trim() || null,
          assignedTo: values.assignedTo,
          deadline: values.deadline ? new Date(values.deadline).toISOString() : null,
          status: 'OPEN',
          visibility: values.visibility,
        });
        logEvent('USER', state.me.name, `Создана задача: ${title}`);
        if (values.visibility !== 'INTERNAL') notify('client', `Новая задача: ${title}`, values.description || '');
        toast('Задача создана');
        return null;
      },
    });
  },

  'toggle-task'(button) {
    const task = state.kase.tasks.find((t) => t.id === button.dataset.task);
    if (!task) return;
    task.status = task.status === 'COMPLETED' ? 'OPEN' : 'COMPLETED';
    if (task.status === 'COMPLETED') logEvent('USER', state.me.name, `Задача выполнена: ${task.title}`);
    render();
  },

  'cancel-request'(button) {
    const request = state.kase.requests.find((r) => r.id === button.dataset.reqId);
    if (!request) return;
    request.status = 'CANCELLED';
    logEvent('USER', state.me.name, `Запрос отменён: ${request.title}`);
    toast('Запрос отменён');
    render();
  },

  'complete-request'(button) {
    const request = state.kase.requests.find((r) => r.id === button.dataset.reqId);
    if (!request) return;
    request.status = 'COMPLETED';
    request.completedAt = new Date().toISOString();
    logEvent('CLIENT', `${state.client.firstName} ${state.client.lastName}`, `Запрос выполнен: ${request.title}`);
    notify('staff', `Запрос выполнен: ${request.title}`, 'Клиент отметил запрос выполненным.');
    toast('Отмечено выполненным');
    render();
  },

  upload(button) {
    const requirement = findRequirement(button.dataset.req);
    if (!requirement) return;
    const portal = Boolean(button.dataset.portal);

    const picker = document.getElementById('cf-file');
    picker.value = '';
    picker.onchange = () => {
      const file = picker.files[0];
      if (!file) return;

      // Те же проверки, что делает сервер: тип, расширение и размер.
      const allowed = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'webp', 'doc', 'docx'];
      const extension = (file.name.split('.').pop() ?? '').toLowerCase();
      if (!allowed.includes(extension)) {
        toast(`Расширение .${extension} не разрешено`);
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast('Файл больше допустимых 20 МБ');
        return;
      }

      requirement.documents.unshift({
        id: uid('doc'),
        version: requirement.documents.length + 1,
        filename: file.name,
        fileSize: file.size,
        status: 'UNDER_REVIEW',
        rejectionReason: null,
        createdAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        uploadedBy: portal ? `${state.client.firstName} ${state.client.lastName}` : state.me.name,
      });
      requirement.status = 'UNDER_REVIEW';

      const who = portal ? `${state.client.firstName} ${state.client.lastName}` : state.me.name;
      logEvent(portal ? 'CLIENT' : 'USER', who, `Загружен файл ${file.name} (в. ${requirement.documents.length})`);
      if (portal) notify('staff', `Загружен документ: ${file.name}`, `${who} загрузил «${requirement.name}». Документ ждёт проверки.`);
      toast('Документ загружен и ждёт проверки');
      render();
    };
    picker.click();
  },

  notifications(button) {
    const side = button.dataset.side;
    const items = state.notifications[side];
    items.forEach((n) => (n.read = true));
    openModal({
      title: 'Уведомления',
      description: side === 'staff' ? 'Что происходит по делам вашей команды.' : 'Что происходит по вашему делу.',
      submitLabel: 'Закрыть',
      fields: [],
      onSubmit: () => null,
    });
    const body = document.querySelector('#cf-modal .cf-modal-body');
    body.innerHTML = items.length
      ? `<ul class="cf-notifications">${items
          .map(
            (n) => `<li><p class="cf-row-title">${esc(n.subject)}</p><p class="cf-row-sub">${esc(n.body)}</p>
                    <p class="cf-row-sub">${formatRelative(n.createdAt)}</p></li>`,
          )
          .join('')}</ul>`
      : '<p class="cf-empty">Пока ничего нового.</p>';
    render();
  },

  'new-case-hint'() {
    toast('В витрине открыто одно дело — оно уже создано');
  },

  reset() {
    state = createState();
    route.company = 'dashboard';
    route.tab = 'overview';
    route.client = 'home';
    toast('Демо сброшено к исходному состоянию');
    render();
  },

  noop() {},
};

// --- обработчики -----------------------------------------------------------

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action], [data-go-company], [data-go-client], [data-tab], [data-open-case], [data-cabinet], [data-close-modal]');
  if (!target) return;

  if (target.hasAttribute('data-close-modal')) return closeModal();

  if (target.dataset.cabinet) {
    route.cabinet = target.dataset.cabinet;
    document.querySelectorAll('[data-cabinet]').forEach((n) => {
      n.classList.toggle('is-active', n.dataset.cabinet === route.cabinet);
      n.setAttribute('aria-selected', String(n.dataset.cabinet === route.cabinet));
    });
    document.querySelectorAll('.cf-stage').forEach((n) => n.classList.toggle('is-active', n.id === `cf-stage-${route.cabinet}`));
    return;
  }

  if (target.dataset.goCompany) {
    route.company = target.dataset.goCompany;
    return render();
  }
  if (target.dataset.goClient) {
    route.client = target.dataset.goClient;
    return render();
  }
  if (target.dataset.openCase) {
    route.company = 'case';
    route.tab = ['documents', 'requests', 'tasks', 'messages', 'activity', 'stages'].includes(target.dataset.openCase)
      ? target.dataset.openCase
      : 'overview';
    return render();
  }
  if (target.dataset.tab) {
    route.tab = target.dataset.tab;
    return render();
  }

  const action = actions[target.dataset.action];
  if (action) action(target);
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-send]');
  if (!form) return;
  event.preventDefault();

  const side = form.dataset.send;
  const body = form.querySelector('[name="body"]').value.trim();
  if (!body) return;

  const author = side === 'STAFF' ? state.me.name : `${state.client.firstName} ${state.client.lastName}`;
  state.kase.messages.push({ id: uid('msg'), from: side, author, body, createdAt: new Date().toISOString() });
  logEvent(side === 'STAFF' ? 'USER' : 'CLIENT', author, `Сообщение: «${body.slice(0, 60)}${body.length > 60 ? '…' : ''}»`);
  notify(side === 'STAFF' ? 'client' : 'staff', `Новое сообщение по делу «${state.kase.title}»`, body.slice(0, 120));
  toast('Сообщение отправлено');
  render();
});

document.addEventListener('input', (event) => {
  const bind = event.target.dataset.bind;
  if (!bind) return;
  const [group, key] = bind.split('.');
  state[group][key] = event.target.value;
  render();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});

render();

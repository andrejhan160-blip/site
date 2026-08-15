/**
 * Демо-данные и правила предметной области.
 *
 * Это витрина: состояние живёт в памяти вкладки, сервера за ней нет. Но данные
 * и формулы — те же, что в продукте: набор документов Ивана Петрова повторяет
 * сид, а прогресс считается тем же способом, что и на бэкенде.
 */

const uid = (() => {
  let n = 0;
  return (prefix) => `${prefix}-${(n += 1)}`;
})();

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (d) => new Date(Date.now() - d * DAY).toISOString();
const daysAhead = (d) => new Date(Date.now() + d * DAY).toISOString();

const STAGE_BLUEPRINT = [
  { name: 'Договор', description: 'Договор на сопровождение подписан, дело открыто.' },
  { name: 'Анкета', description: 'Собраны данные о заявителе, семье и поездках.' },
  { name: 'Сбор документов', description: 'Документы о статусе, финансах и жилье собраны.' },
  { name: 'Юридическая проверка', description: 'Юрист проверяет комплектность дела и правовые риски.' },
  { name: 'Перевод', description: 'Присяжный перевод всех нефранцузских документов.' },
  { name: 'Подготовка заявления', description: 'Формы заполнены, досье собрано и дважды проверено.' },
  { name: 'Подача', description: 'Досье подано в консульство или префектуру.' },
  { name: 'Рассмотрение', description: 'Ожидание решения ведомства.' },
  { name: 'Решение', description: 'Решение получено, вид на жительство выдан.' },
];

const REQUIREMENT_BLUEPRINT = [
  ['Договор', 'Подписанный договор', 'Подпишите каждую страницу и загрузите скан одним PDF-файлом.', 'APPROVED', 'dogovor-podpisan.pdf', 308],
  ['Анкета', 'Заполненная анкета', 'Заполните все разделы. Где неприменимо — напишите «нет».', 'APPROVED', 'anketa-klienta.pdf', 836],
  ['Сбор документов', 'Загранпаспорт (все страницы)', 'Цветной скан всех страниц, включая пустые.', 'APPROVED', 'zagranpasport-petrov.pdf', 414],
  ['Сбор документов', 'Свидетельство о рождении', 'Выдано не более 3 месяцев назад, с апостилем.', 'APPROVED', 'svidetelstvo-o-rozhdenii.pdf', 972],
  ['Сбор документов', 'Свидетельство о браке', 'Оригинал с апостилем.', 'APPROVED', 'svidetelstvo-o-brake.pdf', 640],
  ['Сбор документов', 'Подтверждение жилья во Франции', 'Договор аренды или attestation d’hébergement.', 'APPROVED', 'dogovor-arendy-lyon.pdf', 1180],
  ['Сбор документов', 'Выписка по счёту за 3 месяца', 'С печатью банка и фамилией владельца счёта.', 'APPROVED', 'vypiska-po-schetu.pdf', 512],
  ['Сбор документов', 'Трудовой договор', 'Подписан обеими сторонами, со всеми приложениями.', 'APPROVED', 'trudovoy-dogovor.pdf', 760],
  ['Сбор документов', 'Полис медицинского страхования', 'Покрытие Франции на весь срок пребывания, не менее 30 000 €.', 'REJECTED', 'medstrahovka-polis.pdf', 1020],
  ['Сбор документов', 'Фотографии на документы', 'Две фотографии 35×45 мм на белом фоне, снятые не ранее 6 месяцев назад.', 'APPROVED', 'foto-35x45.png', 978],
  ['Юридическая проверка', 'Справка о несудимости', 'Из каждой страны проживания за последние 5 лет.', 'APPROVED', 'spravka-o-nesudimosti.pdf', 316],
  ['Юридическая проверка', 'Диплом с апостилем', 'Диплом о высшем образовании, с апостилем, читаемый скан.', 'APPROVED', 'diplom-apostil.pdf', 184],
  ['Юридическая проверка', 'Подтверждение связей с родиной', 'Свидетельство о собственности, регистрация бизнеса или аналог.', 'UNDER_REVIEW', 'svidetelstvo-sobstvennosti.pdf', 759],
  ['Юридическая проверка', 'Свидетельства о составе семьи', 'Livret de famille или аналог, все заполненные страницы.', 'APPROVED', 'sostav-semyi.pdf', 972, false],
  ['Перевод', 'Комплект присяжного перевода', 'Готовит наш партнёр-переводчик; от вас нужно подтвердить написание имён.', 'PENDING', null, 0],
  ['Подготовка заявления', 'Подписанная форма CERFA', 'Мы заполняем, вы подписываете и возвращаете.', 'PENDING', null, 0],
];

const REJECTION_REASON =
  'Полис заканчивается 30 сентября — раньше конца запрошенного срока пребывания. Загрузите полис на все 12 месяцев с покрытием не менее 30 000 €.';

function createState() {
  const staff = [
    { id: 'u-elena', name: 'Елена Соколова', role: 'OWNER' },
    { id: 'u-marc', name: 'Марк Дюбуа', role: 'MANAGER' },
    { id: 'u-amelie', name: 'Амели Лоран', role: 'SPECIALIST' },
  ];

  const stages = STAGE_BLUEPRINT.map((stage, index) => ({
    id: uid('stage'),
    name: stage.name,
    description: stage.description,
    position: index,
    status: index < 3 ? 'COMPLETED' : index === 3 ? 'ACTIVE' : 'PENDING',
    completedAt: index < 3 ? daysAgo(44 - index * 11) : null,
  }));

  const stageByName = Object.fromEntries(stages.map((stage) => [stage.name, stage]));
  let uploadedAt = 40;

  const requirements = REQUIREMENT_BLUEPRINT.map(
    ([stageName, name, instructions, status, filename, sizeKb, required = true]) => {
      const requirement = {
        id: uid('req'),
        stageId: stageByName[stageName].id,
        name,
        instructions,
        required,
        deadline: status === 'PENDING' ? daysAhead(name.includes('CERFA') ? 7 : 2) : daysAgo(10),
        status,
        documents: [],
      };

      if (filename) {
        uploadedAt -= 2;
        requirement.documents.push({
          id: uid('doc'),
          version: 1,
          filename,
          fileSize: sizeKb * 1024,
          status: status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : 'UNDER_REVIEW',
          rejectionReason: status === 'REJECTED' ? REJECTION_REASON : null,
          createdAt: daysAgo(uploadedAt),
          reviewedAt: status === 'UNDER_REVIEW' ? null : daysAgo(uploadedAt - 1),
          reviewedBy: status === 'UNDER_REVIEW' ? null : 'Амели Лоран',
          uploadedBy: 'Иван Петров',
        });
      }

      return requirement;
    },
  );

  const insurance = requirements.find((r) => r.name === 'Полис медицинского страхования');

  return {
    org: {
      name: 'Глобал Миграция',
      primaryColor: '#1f6feb',
      supportEmail: 'support@globalmigration.example',
      welcome:
        'Здесь всё о вашем деле: что нужно от вас, над чем работаем мы и на каком этапе сейчас ваши документы.',
    },
    staff,
    me: staff[1],
    client: { firstName: 'Иван', lastName: 'Петров', email: 'ivan.petrov@example.com', phone: '+33 6 12 34 56 78' },
    kase: {
      title: 'ВНЖ Франции — Иван Петров',
      description:
        'Категория «паспорт таланта». Работодатель: Lumen Robotics SAS (Лион). Супруга подаёт отдельно по воссоединению семьи.',
      status: 'ACTIVE',
      assignedTo: 'Амели Лоран',
      workflow: 'ВНЖ Франции',
      createdAt: daysAgo(48),
      lastActivityAt: daysAgo(1),
      crmDealId: '4021',
      stages,
      requirements,
      requests: [
        {
          id: uid('rq'),
          type: 'DOCUMENT',
          title: 'Заменить: полис медицинского страхования',
          description:
            'Текущий полис заканчивается раньше конца срока пребывания. Загрузите полис на все 12 месяцев с покрытием не менее 30 000 €.',
          deadline: daysAhead(2),
          status: 'OPEN',
          requirementId: insurance.id,
          createdAt: daysAgo(3),
          createdBy: 'Амели Лоран',
          completedAt: null,
        },
        {
          id: uid('rq'),
          type: 'INFORMATION',
          title: 'Подтвердите написание имени для присяжного перевода',
          description:
            'Переводчику нужна точная латинская транслитерация, как в загранпаспорте, включая отчество.',
          deadline: daysAhead(1),
          status: 'OPEN',
          requirementId: null,
          createdAt: daysAgo(2),
          createdBy: 'Амели Лоран',
          completedAt: null,
        },
        {
          id: uid('rq'),
          type: 'APPOINTMENT',
          title: 'Подтвердите даты для записи в консульство',
          description: 'У нас забронированы слоты с 12 по 20 октября.',
          deadline: null,
          status: 'COMPLETED',
          requirementId: null,
          createdAt: daysAgo(12),
          createdBy: 'Марк Дюбуа',
          completedAt: daysAgo(10),
        },
      ],
      tasks: [
        {
          id: uid('task'),
          title: 'Проверить свидетельство о собственности по критерию связей с родиной',
          description: 'Убедиться, что доля собственности и дата выдачи соответствуют требованиям консульства.',
          assignedTo: 'Амели Лоран',
          deadline: daysAhead(1),
          status: 'IN_PROGRESS',
          visibility: 'INTERNAL',
        },
        {
          id: uid('task'),
          title: 'Передать дело присяжному переводчику',
          description: null,
          assignedTo: 'Марк Дюбуа',
          deadline: daysAhead(4),
          status: 'OPEN',
          visibility: 'INTERNAL',
        },
        {
          id: uid('task'),
          title: 'Подготовить две фотографии для визита в консульство',
          description: 'Принесите напечатанные оригиналы на приём — сканы в окне не принимают.',
          assignedTo: 'Амели Лоран',
          deadline: daysAhead(9),
          status: 'OPEN',
          visibility: 'CLIENT',
        },
      ],
      messages: [
        {
          id: uid('msg'),
          from: 'STAFF',
          author: 'Амели Лоран',
          body: 'Иван, хорошие новости: справка о несудимости и диплом прошли юридическую проверку. Остались полис и комплект перевода.',
          createdAt: daysAgo(4),
        },
        {
          id: uid('msg'),
          from: 'CLIENT',
          author: 'Иван Петров',
          body: 'Спасибо! Брокер говорит, новый полис выпустят в четверг. Успеваем?',
          createdAt: daysAgo(3),
        },
        {
          id: uid('msg'),
          from: 'STAFF',
          author: 'Амели Лоран',
          body: 'Четверг подходит. Загрузите в тот же день, чтобы я успела проверить до начала перевода — номер полиса войдёт в комплект.',
          createdAt: daysAgo(3),
        },
        {
          id: uid('msg'),
          from: 'CLIENT',
          author: 'Иван Петров',
          body: 'Понял. Вопрос по переводу: отчество писать так же, как в загранпаспорте?',
          createdAt: daysAgo(1),
        },
      ],
      events: [
        { id: uid('ev'), actor: 'INTEGRATION', label: 'BITRIX24', text: 'Синхронизация с CRM (ONCRMDEALUPDATE)', createdAt: daysAgo(12) },
        { id: uid('ev'), actor: 'INTEGRATION', label: 'BITRIX24', text: 'Этап изменён с «Сбор документов» на «Юридическая проверка»', createdAt: daysAgo(12) },
        { id: uid('ev'), actor: 'USER', label: 'Амели Лоран', text: 'Отклонён документ medstrahovka-polis.pdf', createdAt: daysAgo(3) },
        { id: uid('ev'), actor: 'USER', label: 'Амели Лоран', text: 'Запрошен документ «Заменить: полис медицинского страхования»', createdAt: daysAgo(3) },
        { id: uid('ev'), actor: 'CLIENT', label: 'Иван Петров', text: 'Загружен файл svidetelstvo-sobstvennosti.pdf (в. 1)', createdAt: daysAgo(2) },
        { id: uid('ev'), actor: 'CLIENT', label: 'Иван Петров', text: 'Сообщение: «Вопрос по переводу…»', createdAt: daysAgo(1) },
      ],
    },
    notifications: { staff: [], client: [] },
  };
}

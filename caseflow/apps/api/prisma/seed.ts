/**
 * Демо-данные: миграционная компания с делом, продвинутым достаточно далеко,
 * чтобы задействовать все экраны. Идемпотентно — повторный запуск пересоздаёт
 * демо-организацию, а не плодит копии.
 */
import {
  ActorType,
  Prisma,
  CaseStatus,
  CrmProviderKind,
  DocumentStatus,
  EventType,
  PrismaClient,
  RequestStatus,
  RequestType,
  RequirementStatus,
  Role,
  StageStatus,
  TaskStatus,
  TaskVisibility,
} from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY);
const daysAhead = (days: number) => new Date(now.getTime() + days * DAY);

const ORG_SLUG = 'global-migration';

/** Схема этапов воркфлоу «ВНЖ Франции». */
const FRANCE_WORKFLOW = [
  {
    name: 'Договор',
    description: 'Договор на сопровождение подписан, дело открыто.',
    requirements: [
      {
        name: 'Подписанный договор',
        instructions: 'Подпишите каждую страницу и загрузите скан одним PDF-файлом.',
        deadlineDays: 3,
      },
    ],
  },
  {
    name: 'Анкета',
    description: 'Собраны данные о заявителе, семье и поездках.',
    requirements: [
      {
        name: 'Заполненная анкета',
        instructions: 'Заполните все разделы. Не оставляйте пустых полей — где неприменимо, напишите «нет».',
        deadlineDays: 7,
      },
    ],
  },
  {
    name: 'Сбор документов',
    description: 'Документы о статусе, финансах и жилье собраны.',
    requirements: [
      { name: 'Загранпаспорт (все страницы)', instructions: 'Цветной скан всех страниц, включая пустые.', deadlineDays: 14 },
      { name: 'Свидетельство о рождении', instructions: 'Выдано не более 3 месяцев назад, с апостилем.', deadlineDays: 14 },
      { name: 'Свидетельство о браке', instructions: 'Оригинал с апостилем.', deadlineDays: 14 },
      { name: 'Подтверждение жилья во Франции', instructions: 'Договор аренды или attestation d’hébergement.', deadlineDays: 21 },
      { name: 'Выписка по счёту за 3 месяца', instructions: 'С печатью банка и фамилией владельца счёта.', deadlineDays: 21 },
      { name: 'Трудовой договор', instructions: 'Подписан обеими сторонами, со всеми приложениями.', deadlineDays: 21 },
      { name: 'Полис медицинского страхования', instructions: 'Покрытие Франции на весь срок пребывания, не менее 30 000 €.', deadlineDays: 21 },
      { name: 'Фотографии на документы', instructions: 'Две одинаковые фотографии 35×45 мм на белом фоне, снятые не ранее 6 месяцев назад.', deadlineDays: 21 },
    ],
  },
  {
    name: 'Юридическая проверка',
    description: 'Юрист проверяет комплектность дела и правовые риски.',
    requirements: [
      { name: 'Справка о несудимости', instructions: 'Из каждой страны проживания за последние 5 лет.', deadlineDays: 30 },
      { name: 'Диплом с апостилем', instructions: 'Диплом о высшем образовании, с апостилем, читаемый скан.', deadlineDays: 30 },
      { name: 'Подтверждение связей с родиной', instructions: 'Свидетельство о собственности, регистрация бизнеса или аналог.', deadlineDays: 35 },
      { name: 'Свидетельства о составе семьи', instructions: 'Livret de famille или аналог, все заполненные страницы.', required: false, deadlineDays: 35 },
    ],
  },
  {
    name: 'Перевод',
    description: 'Присяжный перевод всех нефранцузских документов.',
    requirements: [
      { name: 'Комплект присяжного перевода', instructions: 'Готовит наш партнёр-переводчик; от вас нужно только подтвердить написание имён.', deadlineDays: 45 },
    ],
  },
  {
    name: 'Подготовка заявления',
    description: 'Формы заполнены, досье собрано и дважды проверено.',
    requirements: [
      { name: 'Подписанная форма CERFA', instructions: 'Мы заполняем, вы подписываете и возвращаете.', deadlineDays: 55 },
    ],
  },
  {
    name: 'Подача',
    description: 'Досье подано в консульство или префектуру.',
    requirements: [],
  },
  {
    name: 'Рассмотрение',
    description: 'Ожидание решения ведомства.',
    requirements: [],
  },
  {
    name: 'Решение',
    description: 'Решение получено, вид на жительство выдан.',
    requirements: [],
  },
];

/**
 * Состояние демо-дела Ивана Петрова: 16 требований — 12 принято, 1 на проверке,
 * 1 отклонён, 2 не загружено (получено 13 из 16).
 */
const DEMO_REQUIREMENT_STATE: Record<string, RequirementStatus> = {
  'Подписанный договор': RequirementStatus.APPROVED,
  'Заполненная анкета': RequirementStatus.APPROVED,
  'Загранпаспорт (все страницы)': RequirementStatus.APPROVED,
  'Свидетельство о рождении': RequirementStatus.APPROVED,
  'Свидетельство о браке': RequirementStatus.APPROVED,
  'Подтверждение жилья во Франции': RequirementStatus.APPROVED,
  'Выписка по счёту за 3 месяца': RequirementStatus.APPROVED,
  'Трудовой договор': RequirementStatus.APPROVED,
  'Полис медицинского страхования': RequirementStatus.REJECTED,
  'Фотографии на документы': RequirementStatus.APPROVED,
  'Справка о несудимости': RequirementStatus.APPROVED,
  'Диплом с апостилем': RequirementStatus.APPROVED,
  'Подтверждение связей с родиной': RequirementStatus.UNDER_REVIEW,
  'Свидетельства о составе семьи': RequirementStatus.APPROVED,
  'Комплект присяжного перевода': RequirementStatus.PENDING,
  'Подписанная форма CERFA': RequirementStatus.PENDING,
};

const FILENAMES: Record<string, string> = {
  'Подписанный договор': 'dogovor-podpisan.pdf',
  'Заполненная анкета': 'anketa-klienta.pdf',
  'Загранпаспорт (все страницы)': 'zagranpasport-petrov.pdf',
  'Свидетельство о рождении': 'svidetelstvo-o-rozhdenii-apostil.pdf',
  'Свидетельство о браке': 'svidetelstvo-o-brake.pdf',
  'Подтверждение жилья во Франции': 'dogovor-arendy-lyon.pdf',
  'Выписка по счёту за 3 месяца': 'vypiska-po-schetu.pdf',
  'Трудовой договор': 'trudovoy-dogovor.pdf',
  'Полис медицинского страхования': 'medstrahovka-polis.pdf',
  'Фотографии на документы': 'foto-35x45.png',
  'Справка о несудимости': 'spravka-o-nesudimosti.pdf',
  'Диплом с апостилем': 'diplom-apostil.pdf',
  'Подтверждение связей с родиной': 'svidetelstvo-sobstvennosti.pdf',
  'Свидетельства о составе семьи': 'sostav-semyi.pdf',
};

async function main(): Promise<void> {
  console.info('Заполняем демо-данные CaseFlow…');

  await prisma.organization.deleteMany({ where: { slug: ORG_SLUG } });

  const organization = await prisma.organization.create({
    data: {
      name: 'Глобал Миграция',
      slug: ORG_SLUG,
      primaryColor: '#1F6FEB',
      timezone: 'Europe/Paris',
      supportEmail: 'support@globalmigration.example',
      portalWelcomeText:
        'Здесь всё о вашем деле: что нужно от вас, над чем работаем мы и на каком этапе сейчас ваши документы.',
    },
  });

  const [owner, manager, specialist] = await Promise.all([
    prisma.user.create({
      data: {
        organizationId: organization.id,
        name: 'Елена Соколова',
        email: 'elena@globalmigration.example',
        role: Role.OWNER,
      },
    }),
    prisma.user.create({
      data: {
        organizationId: organization.id,
        name: 'Марк Дюбуа',
        email: 'marc@globalmigration.example',
        role: Role.MANAGER,
      },
    }),
    prisma.user.create({
      data: {
        organizationId: organization.id,
        name: 'Амели Лоран',
        email: 'amelie@globalmigration.example',
        role: Role.SPECIALIST,
      },
    }),
  ]);

  const template = await prisma.workflowTemplate.create({
    data: {
      organizationId: organization.id,
      name: 'ВНЖ Франции',
      description:
        'Стандартный процесс из девяти этапов: от договора до решения по виду на жительство во Франции.',
      stages: {
        create: FRANCE_WORKFLOW.map((stage, stageIndex) => ({
          name: stage.name,
          description: stage.description,
          position: stageIndex,
          requirements: {
            create: stage.requirements.map((requirement, requirementIndex) => ({
              name: requirement.name,
              instructions: requirement.instructions,
              required: requirement.required ?? true,
              deadlineDays: requirement.deadlineDays,
              position: requirementIndex,
            })),
          },
        })),
      },
    },
    include: { stages: { orderBy: { position: 'asc' }, include: { requirements: true } } },
  });

  const client = await prisma.client.create({
    data: {
      organizationId: organization.id,
      firstName: 'Иван',
      lastName: 'Петров',
      email: 'ivan.petrov@example.com',
      phone: '+33 6 12 34 56 78',
      externalCrmContactId: '1042',
      notes: 'Переезжает с супругой. Работодатель в Лионе уже выдал трудовой договор.',
    },
  });

  await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: 'Иван Петров',
      email: client.email,
      role: Role.CLIENT,
      clientId: client.id,
    },
  });

  const caseStart = daysAgo(48);

  const kase = await prisma.case.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      assignedUserId: specialist.id,
      workflowTemplateId: template.id,
      title: 'ВНЖ Франции — Иван Петров',
      description:
        'Категория «паспорт таланта». Работодатель: Lumen Robotics SAS (Лион). Супруга подаёт отдельно по воссоединению семьи.',
      status: CaseStatus.ACTIVE,
      crmProvider: CrmProviderKind.BITRIX24,
      externalCrmEntityId: '4021',
      crmPipelineId: '0',
      crmStageId: 'C0:PREPARATION',
      createdAt: caseStart,
      lastActivityAt: daysAgo(1),
    },
  });

  // Копируем шаблон в дело: этапы 1–3 завершены, «Юридическая проверка» активна.
  const activePosition = 3;
  const stageIdByName = new Map<string, string>();

  for (const templateStage of template.stages) {
    const completed = templateStage.position < activePosition;
    const active = templateStage.position === activePosition;

    const stage = await prisma.caseStage.create({
      data: {
        caseId: kase.id,
        name: templateStage.name,
        description: templateStage.description,
        position: templateStage.position,
        status: completed ? StageStatus.COMPLETED : active ? StageStatus.ACTIVE : StageStatus.PENDING,
        startedAt: completed || active ? daysAgo(48 - templateStage.position * 11) : null,
        completedAt: completed ? daysAgo(44 - templateStage.position * 11) : null,
      },
    });
    stageIdByName.set(templateStage.name, stage.id);
  }

  const currentStageId = stageIdByName.get('Юридическая проверка')!;
  await prisma.case.update({ where: { id: kase.id }, data: { currentStageId } });

  let uploadedAt = daysAgo(40);
  const documentsByRequirement = new Map<string, { id: string; status: DocumentStatus }>();

  for (const templateStage of template.stages) {
    for (const templateRequirement of templateStage.requirements) {
      const status = DEMO_REQUIREMENT_STATE[templateRequirement.name] ?? RequirementStatus.PENDING;
      const stageId = stageIdByName.get(templateStage.name)!;

      const requirement = await prisma.documentRequirement.create({
        data: {
          caseId: kase.id,
          stageId,
          name: templateRequirement.name,
          instructions: templateRequirement.instructions,
          required: templateRequirement.required,
          status,
          deadline:
            templateRequirement.deadlineDays === null
              ? null
              : new Date(caseStart.getTime() + (templateRequirement.deadlineDays ?? 30) * DAY),
        },
      });

      if (status === RequirementStatus.PENDING) continue;

      uploadedAt = new Date(uploadedAt.getTime() + 1.5 * DAY);
      const filename = FILENAMES[templateRequirement.name] ?? 'document.pdf';
      const documentStatus =
        status === RequirementStatus.APPROVED
          ? DocumentStatus.APPROVED
          : status === RequirementStatus.REJECTED
            ? DocumentStatus.REJECTED
            : DocumentStatus.UNDER_REVIEW;

      const document = await prisma.document.create({
        data: {
          organizationId: organization.id,
          caseId: kase.id,
          requirementId: requirement.id,
          uploadedByType: ActorType.CLIENT,
          version: 1,
          filename,
          // За демо-документами нет байтов; ключ хранилища имеет боевой формат,
          // поэтому ссылки на скачивание отрабатывают и корректно возвращают 404.
          storageKey: `org/${organization.id}/cases/${kase.id}/${randomUUID()}.pdf`,
          mimeType: filename.endsWith('.png') ? 'image/png' : 'application/pdf',
          fileSize: 180_000 + Math.round(Math.abs(Math.sin(requirement.name.length)) * 900_000),
          checksum: createHash('sha256').update(filename).digest('hex'),
          status: documentStatus,
          rejectionReason:
            documentStatus === DocumentStatus.REJECTED
              ? 'Полис заканчивается 30 сентября — раньше конца запрошенного срока пребывания. Загрузите полис на все 12 месяцев с покрытием не менее 30 000 €.'
              : null,
          createdAt: uploadedAt,
          reviewedAt: documentStatus === DocumentStatus.UNDER_REVIEW ? null : new Date(uploadedAt.getTime() + DAY),
          reviewedById: documentStatus === DocumentStatus.UNDER_REVIEW ? null : specialist.id,
        },
      });

      documentsByRequirement.set(requirement.name, { id: document.id, status: documentStatus });

      if (documentStatus === DocumentStatus.REJECTED) {
        // Отклонённый документ возвращается в очередь запросов клиента.
        await prisma.clientRequest.create({
          data: {
            organizationId: organization.id,
            caseId: kase.id,
            clientId: client.id,
            requirementId: requirement.id,
            type: RequestType.DOCUMENT,
            title: 'Заменить: полис медицинского страхования',
            description:
              'Текущий полис заканчивается раньше конца срока пребывания. Загрузите полис на все 12 месяцев с покрытием не менее 30 000 €.',
            deadline: daysAhead(2),
            status: RequestStatus.OPEN,
            createdById: specialist.id,
            createdAt: daysAgo(3),
          },
        });
      }
    }
  }

  // Открытый запрос, по которому клиент должен действовать, и один уже закрытый.
  await prisma.clientRequest.create({
    data: {
      organizationId: organization.id,
      caseId: kase.id,
      clientId: client.id,
      type: RequestType.INFORMATION,
      title: 'Подтвердите написание имени для присяжного перевода',
      description:
        'Переводчику нужна точная латинская транслитерация, как в загранпаспорте, включая отчество. Напишите в сообщениях или отметьте запрос выполненным, когда проверите.',
      deadline: daysAhead(1),
      status: RequestStatus.OPEN,
      createdById: specialist.id,
      createdAt: daysAgo(2),
    },
  });

  await prisma.clientRequest.create({
    data: {
      organizationId: organization.id,
      caseId: kase.id,
      clientId: client.id,
      type: RequestType.APPOINTMENT,
      title: 'Подтвердите даты для записи в консульство',
      description: 'У нас забронированы слоты с 12 по 20 октября. Скажите, какие даты вам не подходят.',
      status: RequestStatus.COMPLETED,
      createdById: manager.id,
      createdAt: daysAgo(12),
      completedAt: daysAgo(10),
    },
  });

  await prisma.task.createMany({
    data: [
      {
        organizationId: organization.id,
        caseId: kase.id,
        assignedToId: specialist.id,
        title: 'Проверить свидетельство о собственности по критерию связей с родиной',
        description: 'Убедиться, что доля собственности и дата выдачи соответствуют требованиям консульства.',
        deadline: daysAhead(1),
        status: TaskStatus.IN_PROGRESS,
        visibility: TaskVisibility.INTERNAL,
      },
      {
        organizationId: organization.id,
        caseId: kase.id,
        assignedToId: manager.id,
        title: 'Передать дело присяжному переводчику',
        deadline: daysAhead(4),
        status: TaskStatus.OPEN,
        visibility: TaskVisibility.INTERNAL,
      },
      {
        organizationId: organization.id,
        caseId: kase.id,
        assignedToId: specialist.id,
        title: 'Подготовить две фотографии для визита в консульство',
        description: 'Принесите напечатанные оригиналы на приём — сканы в окне не принимают.',
        deadline: daysAhead(9),
        status: TaskStatus.OPEN,
        visibility: TaskVisibility.CLIENT,
      },
    ],
  });

  const clientUser = await prisma.user.findFirstOrThrow({
    where: { organizationId: organization.id, clientId: client.id },
  });

  await prisma.message.createMany({
    data: [
      {
        organizationId: organization.id,
        caseId: kase.id,
        senderId: specialist.id,
        senderType: ActorType.USER,
        body: 'Иван, хорошие новости: справка о несудимости и диплом прошли юридическую проверку. Остались полис и комплект перевода.',
        createdAt: daysAgo(4),
        readByClientAt: daysAgo(4),
      },
      {
        organizationId: organization.id,
        caseId: kase.id,
        senderId: clientUser.id,
        senderType: ActorType.CLIENT,
        body: 'Спасибо! Брокер говорит, новый полис выпустят в четверг. Успеваем?',
        createdAt: daysAgo(3),
        readByStaffAt: daysAgo(3),
      },
      {
        organizationId: organization.id,
        caseId: kase.id,
        senderId: specialist.id,
        senderType: ActorType.USER,
        body: 'Четверг подходит. Загрузите в тот же день, чтобы я успела проверить до начала перевода — номер полиса войдёт в комплект.',
        createdAt: daysAgo(3),
      },
      {
        organizationId: organization.id,
        caseId: kase.id,
        senderId: clientUser.id,
        senderType: ActorType.CLIENT,
        body: 'Понял. Вопрос по переводу: отчество писать так же, как в загранпаспорте?',
        createdAt: daysAgo(1),
      },
    ],
  });

  const events: Array<{
    eventType: EventType;
    createdAt: Date;
    actorType: ActorType;
    actorId?: string;
    actorLabel: string;
    payload: Prisma.InputJsonObject;
  }> = [
    {
      eventType: EventType.CASE_CREATED,
      createdAt: caseStart,
      actorType: ActorType.USER,
      actorId: manager.id,
      actorLabel: manager.name,
      payload: { title: kase.title, templateName: template.name },
    },
    {
      eventType: EventType.STAGE_CHANGED,
      createdAt: daysAgo(41),
      actorType: ActorType.USER,
      actorId: specialist.id,
      actorLabel: specialist.name,
      payload: { from: 'Договор', to: 'Анкета' },
    },
    {
      eventType: EventType.STAGE_CHANGED,
      createdAt: daysAgo(30),
      actorType: ActorType.USER,
      actorId: specialist.id,
      actorLabel: specialist.name,
      payload: { from: 'Анкета', to: 'Сбор документов' },
    },
    {
      eventType: EventType.DOCUMENT_UPLOADED,
      createdAt: daysAgo(20),
      actorType: ActorType.CLIENT,
      actorId: clientUser.id,
      actorLabel: 'Иван Петров',
      payload: { filename: 'zagranpasport-petrov.pdf', version: 1 },
    },
    {
      eventType: EventType.DOCUMENT_APPROVED,
      createdAt: daysAgo(19),
      actorType: ActorType.USER,
      actorId: specialist.id,
      actorLabel: specialist.name,
      payload: { filename: 'zagranpasport-petrov.pdf', version: 1 },
    },
    {
      eventType: EventType.STAGE_CHANGED,
      createdAt: daysAgo(12),
      actorType: ActorType.INTEGRATION,
      actorLabel: 'BITRIX24',
      payload: { from: 'Сбор документов', to: 'Юридическая проверка', source: 'BITRIX24', externalStageId: 'C0:PREPARATION' },
    },
    {
      eventType: EventType.DOCUMENT_REJECTED,
      createdAt: daysAgo(3),
      actorType: ActorType.USER,
      actorId: specialist.id,
      actorLabel: specialist.name,
      payload: {
        filename: 'medstrahovka-polis.pdf',
        version: 1,
        rejectionReason: 'Полис заканчивается раньше конца срока пребывания.',
      },
    },
    {
      eventType: EventType.DOCUMENT_REQUESTED,
      createdAt: daysAgo(3),
      actorType: ActorType.USER,
      actorId: specialist.id,
      actorLabel: specialist.name,
      payload: { name: 'Заменить: полис медицинского страхования', deadline: daysAhead(2).toISOString() },
    },
    {
      eventType: EventType.DOCUMENT_UPLOADED,
      createdAt: daysAgo(2),
      actorType: ActorType.CLIENT,
      actorId: clientUser.id,
      actorLabel: 'Иван Петров',
      payload: { filename: 'svidetelstvo-sobstvennosti.pdf', version: 1 },
    },
    {
      eventType: EventType.MESSAGE_SENT,
      createdAt: daysAgo(1),
      actorType: ActorType.CLIENT,
      actorId: clientUser.id,
      actorLabel: 'Иван Петров',
      payload: { excerpt: 'Вопрос по переводу…' },
    },
  ];

  for (const event of events) {
    await prisma.event.create({
      data: {
        organizationId: organization.id,
        caseId: kase.id,
        actorType: event.actorType,
        actorId: event.actorId ?? null,
        actorLabel: event.actorLabel,
        eventType: event.eventType,
        payload: event.payload,
        createdAt: event.createdAt,
      },
    });
  }

  // Второй клиент и дело, чтобы списки не состояли из одной строки.
  const secondClient = await prisma.client.create({
    data: {
      organizationId: organization.id,
      firstName: 'Марта',
      lastName: 'Ковальская',
      email: 'marta.kowalski@example.com',
      phone: '+48 601 222 333',
    },
  });

  await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: 'Марта Ковальская',
      email: secondClient.email,
      role: Role.CLIENT,
      clientId: secondClient.id,
    },
  });

  const secondCase = await prisma.case.create({
    data: {
      organizationId: organization.id,
      clientId: secondClient.id,
      assignedUserId: manager.id,
      workflowTemplateId: template.id,
      title: 'ВНЖ Франции — Марта Ковальская',
      status: CaseStatus.ACTIVE,
      createdAt: daysAgo(11),
      lastActivityAt: daysAgo(9),
    },
  });

  for (const templateStage of template.stages) {
    const stage = await prisma.caseStage.create({
      data: {
        caseId: secondCase.id,
        name: templateStage.name,
        description: templateStage.description,
        position: templateStage.position,
        status:
          templateStage.position === 0
            ? StageStatus.COMPLETED
            : templateStage.position === 1
              ? StageStatus.ACTIVE
              : StageStatus.PENDING,
        startedAt: templateStage.position <= 1 ? daysAgo(11 - templateStage.position) : null,
        completedAt: templateStage.position === 0 ? daysAgo(10) : null,
      },
    });

    if (templateStage.position === 1) {
      await prisma.case.update({ where: { id: secondCase.id }, data: { currentStageId: stage.id } });
    }

    for (const requirement of templateStage.requirements) {
      await prisma.documentRequirement.create({
        data: {
          caseId: secondCase.id,
          stageId: stage.id,
          name: requirement.name,
          instructions: requirement.instructions,
          required: requirement.required,
          status: templateStage.position === 0 ? RequirementStatus.APPROVED : RequirementStatus.PENDING,
          deadline: new Date(daysAgo(11).getTime() + (requirement.deadlineDays ?? 30) * DAY),
        },
      });
    }
  }

  await prisma.event.create({
    data: {
      organizationId: organization.id,
      caseId: secondCase.id,
      actorType: ActorType.USER,
      actorId: manager.id,
      actorLabel: manager.name,
      eventType: EventType.CASE_CREATED,
      payload: { title: secondCase.title, templateName: template.name },
      createdAt: daysAgo(11),
    },
  });

  // Подключение к Битрикс24 с сопоставлением стадий: чтобы связать с реальным
  // порталом, достаточно вставить адрес входящего вебхука в «Настройки → Интеграции».
  const connection = await prisma.crmConnection.create({
    data: {
      organizationId: organization.id,
      provider: CrmProviderKind.BITRIX24,
      isActive: false,
      baseUrl: 'https://globalmigration.bitrix24.eu',
      credentials: {},
      webhookSecret: randomBytes(24).toString('base64url'),
      syncedFields: ['TITLE', 'STAGE_ID', 'ASSIGNED_BY_ID', 'CONTACT_ID', 'UF_CRM_PERMIT_TYPE'],
    },
  });

  const mappings: Array<[string, string, string]> = [
    ['C0:NEW', 'Новый лид', 'Договор'],
    ['C0:PREPARATION', 'Документы получены', 'Юридическая проверка'],
    ['C0:EXECUTING', 'В переводе', 'Перевод'],
    ['C0:FINAL_INVOICE', 'Подано', 'Подача'],
    ['C0:WON', 'Одобрено', 'Решение'],
  ];

  for (const [externalStageId, externalStageName, stageName] of mappings) {
    const templateStage = template.stages.find((stage) => stage.name === stageName);
    await prisma.crmStageMapping.create({
      data: {
        connectionId: connection.id,
        pipelineId: '0',
        pipelineName: 'Виды на жительство',
        externalStageId,
        externalStageName,
        templateStageId: templateStage?.id ?? null,
      },
    });
  }

  // Прогресс считается из состояния дела, а не проставляется руками.
  for (const target of [kase.id, secondCase.id]) {
    const stages = await prisma.caseStage.findMany({
      where: { caseId: target },
      select: { status: true, requirements: { select: { status: true, required: true } } },
    });
    const { calculateProgress } = await import('../src/modules/cases/case-progress');
    await prisma.case.update({ where: { id: target }, data: { progress: calculateProgress(stages) } });
  }

  const demoCase = await prisma.case.findUniqueOrThrow({ where: { id: kase.id } });

  console.info(`
Демо-организация готова: ${organization.name} (/${organization.slug})

  Сотрудники  ${owner.email} (владелец)
              ${manager.email} (менеджер)
              ${specialist.email} (специалист)
  Клиент      ${client.email} (кабинет клиента)

  Дело        ${demoCase.title}
              этап «Юридическая проверка», прогресс ${demoCase.progress}%
              16 требований к документам — 12 принято, 1 на проверке, 1 отклонён, 2 не загружено

Вход: на экране входа введите один из адресов выше и откройте ссылку,
напечатанную в логе API.
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });

/**
 * Demo seed: a realistic immigration-consulting organization with one case far
 * enough along to exercise every screen. Idempotent — running it again resets
 * the demo organization rather than duplicating it.
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

/** Stage blueprint for the France Residence Permit workflow. */
const FRANCE_WORKFLOW = [
  {
    name: 'Contract',
    description: 'Service agreement signed and the engagement opened.',
    requirements: [
      {
        name: 'Signed service agreement',
        instructions: 'Sign every page and upload the scan as a single PDF.',
        deadlineDays: 3,
      },
    ],
  },
  {
    name: 'Questionnaire',
    description: 'Client profile, family situation and travel history collected.',
    requirements: [
      {
        name: 'Completed client questionnaire',
        instructions: 'Fill in every section. Leave nothing blank — write "N/A" where a question does not apply.',
        deadlineDays: 7,
      },
    ],
  },
  {
    name: 'Document collection',
    description: 'Civil status, financial and accommodation evidence gathered.',
    requirements: [
      { name: 'Passport (all pages)', instructions: 'Colour scan of every page, including empty ones.', deadlineDays: 14 },
      { name: 'Birth certificate', instructions: 'Issued within the last 3 months, with apostille.', deadlineDays: 14 },
      { name: 'Marriage certificate', instructions: 'Original with apostille.', deadlineDays: 14 },
      { name: 'Proof of accommodation in France', instructions: 'Lease agreement or attestation d’hébergement.', deadlineDays: 21 },
      { name: 'Bank statements (last 3 months)', instructions: 'Stamped by the bank, showing the account holder name.', deadlineDays: 21 },
      { name: 'Employment contract', instructions: 'Signed by both parties, all annexes included.', deadlineDays: 21 },
      { name: 'Health insurance policy', instructions: 'Must cover France for the full stay, minimum €30,000.', deadlineDays: 21 },
      { name: 'Passport photographs', instructions: 'Two identical photos, 35×45 mm, white background, taken within 6 months.', deadlineDays: 21 },
    ],
  },
  {
    name: 'Legal review',
    description: 'Lawyer checks the file for completeness and legal risk.',
    requirements: [
      { name: 'Criminal record certificate', instructions: 'From every country of residence in the last 5 years.', deadlineDays: 30 },
      { name: 'Diploma with apostille', instructions: 'Higher education diploma, apostilled and legible.', deadlineDays: 30 },
      { name: 'Proof of ties to home country', instructions: 'Property deed, business registration or similar.', deadlineDays: 35 },
      { name: 'Family civil status book', instructions: 'Livret de famille or equivalent, all filled pages.', required: false, deadlineDays: 35 },
    ],
  },
  {
    name: 'Translation',
    description: 'Sworn translation of every non-French document.',
    requirements: [
      { name: 'Sworn translation set', instructions: 'Prepared by our partner translator; you only confirm the spelling of names.', deadlineDays: 45 },
    ],
  },
  {
    name: 'Application preparation',
    description: 'Forms filled, dossier assembled and checked twice.',
    requirements: [
      { name: 'Signed CERFA application form', instructions: 'We prepare it, you sign and return it.', deadlineDays: 55 },
    ],
  },
  {
    name: 'Submission',
    description: 'Dossier submitted at the consulate or prefecture.',
    requirements: [],
  },
  {
    name: 'Processing',
    description: 'Waiting for the authority to process the application.',
    requirements: [],
  },
  {
    name: 'Decision',
    description: 'Decision received and the residence permit handed over.',
    requirements: [],
  },
];

/**
 * Demo state for Ivan Petrov's case: 16 requirements — 12 approved, 1 under
 * review, 1 rejected, 2 still missing (13 of 16 received).
 */
const DEMO_REQUIREMENT_STATE: Record<string, RequirementStatus> = {
  'Signed service agreement': RequirementStatus.APPROVED,
  'Completed client questionnaire': RequirementStatus.APPROVED,
  'Passport (all pages)': RequirementStatus.APPROVED,
  'Birth certificate': RequirementStatus.APPROVED,
  'Marriage certificate': RequirementStatus.APPROVED,
  'Proof of accommodation in France': RequirementStatus.APPROVED,
  'Bank statements (last 3 months)': RequirementStatus.APPROVED,
  'Employment contract': RequirementStatus.APPROVED,
  'Health insurance policy': RequirementStatus.REJECTED,
  'Passport photographs': RequirementStatus.APPROVED,
  'Criminal record certificate': RequirementStatus.APPROVED,
  'Diploma with apostille': RequirementStatus.APPROVED,
  'Proof of ties to home country': RequirementStatus.UNDER_REVIEW,
  'Family civil status book': RequirementStatus.APPROVED,
  'Sworn translation set': RequirementStatus.PENDING,
  'Signed CERFA application form': RequirementStatus.PENDING,
};

const FILENAMES: Record<string, string> = {
  'Signed service agreement': 'service-agreement-signed.pdf',
  'Completed client questionnaire': 'client-questionnaire.pdf',
  'Passport (all pages)': 'passport-petrov.pdf',
  'Birth certificate': 'birth-certificate-apostille.pdf',
  'Marriage certificate': 'marriage-certificate.pdf',
  'Proof of accommodation in France': 'lease-lyon-rue-victor-hugo.pdf',
  'Bank statements (last 3 months)': 'bank-statements-q2.pdf',
  'Employment contract': 'employment-contract-signed.pdf',
  'Health insurance policy': 'health-insurance-policy.pdf',
  'Passport photographs': 'photos-35x45.png',
  'Criminal record certificate': 'criminal-record-certificate.pdf',
  'Diploma with apostille': 'diploma-apostille.pdf',
  'Proof of ties to home country': 'property-deed.pdf',
  'Family civil status book': 'family-book.pdf',
};

async function main(): Promise<void> {
  console.info('Seeding CaseFlow demo data…');

  await prisma.organization.deleteMany({ where: { slug: ORG_SLUG } });

  const organization = await prisma.organization.create({
    data: {
      name: 'Global Migration',
      slug: ORG_SLUG,
      primaryColor: '#1F6FEB',
      timezone: 'Europe/Paris',
      supportEmail: 'support@globalmigration.example',
      portalWelcomeText:
        'Welcome to your Global Migration portal. Everything about your application lives here: what we need from you, what we are working on, and where your file stands right now.',
    },
  });

  const [owner, manager, specialist] = await Promise.all([
    prisma.user.create({
      data: {
        organizationId: organization.id,
        name: 'Elena Sokolova',
        email: 'elena@globalmigration.example',
        role: Role.OWNER,
      },
    }),
    prisma.user.create({
      data: {
        organizationId: organization.id,
        name: 'Marc Dubois',
        email: 'marc@globalmigration.example',
        role: Role.MANAGER,
      },
    }),
    prisma.user.create({
      data: {
        organizationId: organization.id,
        name: 'Amélie Laurent',
        email: 'amelie@globalmigration.example',
        role: Role.SPECIALIST,
      },
    }),
  ]);

  const template = await prisma.workflowTemplate.create({
    data: {
      organizationId: organization.id,
      name: 'France Residence Permit',
      description:
        'Standard nine-stage process for a French residence permit application, from contract to decision.',
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
      firstName: 'Ivan',
      lastName: 'Petrov',
      email: 'ivan.petrov@example.com',
      phone: '+33 6 12 34 56 78',
      externalCrmContactId: '1042',
      notes: 'Relocating with spouse. Employer in Lyon has already issued the work contract.',
    },
  });

  await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: 'Ivan Petrov',
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
      title: 'France Residence Permit — Ivan Petrov',
      description:
        'Talent-passport route. Employer: Lumen Robotics SAS (Lyon). Spouse joins on a family reunification application handled separately.',
      status: CaseStatus.ACTIVE,
      crmProvider: CrmProviderKind.BITRIX24,
      externalCrmEntityId: '4021',
      crmPipelineId: '0',
      crmStageId: 'C0:PREPARATION',
      createdAt: caseStart,
      lastActivityAt: daysAgo(1),
    },
  });

  // Copy the template into the case: stages 1–3 completed, Legal review active.
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

  const currentStageId = stageIdByName.get('Legal review')!;
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
          // Demo documents have no bytes behind them; the storage key follows the
          // production layout so download links resolve and fail cleanly.
          storageKey: `org/${organization.id}/cases/${kase.id}/${randomUUID()}.pdf`,
          mimeType: filename.endsWith('.png') ? 'image/png' : 'application/pdf',
          fileSize: 180_000 + Math.round(Math.abs(Math.sin(requirement.name.length)) * 900_000),
          checksum: createHash('sha256').update(filename).digest('hex'),
          status: documentStatus,
          rejectionReason:
            documentStatus === DocumentStatus.REJECTED
              ? 'The policy expires on 30 September, before the end of the requested stay. Please upload a policy that covers the full 12 months with at least €30,000 of cover.'
              : null,
          createdAt: uploadedAt,
          reviewedAt: documentStatus === DocumentStatus.UNDER_REVIEW ? null : new Date(uploadedAt.getTime() + DAY),
          reviewedById: documentStatus === DocumentStatus.UNDER_REVIEW ? null : specialist.id,
        },
      });

      documentsByRequirement.set(requirement.name, { id: document.id, status: documentStatus });

      if (documentStatus === DocumentStatus.REJECTED) {
        // The rejected item goes back into the client's request queue.
        await prisma.clientRequest.create({
          data: {
            organizationId: organization.id,
            caseId: kase.id,
            clientId: client.id,
            requirementId: requirement.id,
            type: RequestType.DOCUMENT,
            title: 'Replace: Health insurance policy',
            description:
              'Your current policy expires before the end of the requested stay. Please upload a policy covering the full 12 months with at least €30,000 of cover.',
            deadline: daysAhead(2),
            status: RequestStatus.OPEN,
            createdById: specialist.id,
            createdAt: daysAgo(3),
          },
        });
      }
    }
  }

  // An open request the client must act on, plus one already completed.
  await prisma.clientRequest.create({
    data: {
      organizationId: organization.id,
      caseId: kase.id,
      clientId: client.id,
      type: RequestType.INFORMATION,
      title: 'Confirm the spelling of your name for the sworn translation',
      description:
        'The translator needs the exact Latin transliteration as it appears in your passport, including middle name. Reply in the messages tab or complete this request once you have checked.',
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
      title: 'Confirm availability for the consulate appointment window',
      description: 'We hold slots between 12 and 20 October. Tell us which dates do not work for you.',
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
        title: 'Review the property deed against the ties-to-home-country criteria',
        description: 'Check that the ownership share and the issue date satisfy the consulate guidance.',
        deadline: daysAhead(1),
        status: TaskStatus.IN_PROGRESS,
        visibility: TaskVisibility.INTERNAL,
      },
      {
        organizationId: organization.id,
        caseId: kase.id,
        assignedToId: manager.id,
        title: 'Brief the sworn translator on the file',
        deadline: daysAhead(4),
        status: TaskStatus.OPEN,
        visibility: TaskVisibility.INTERNAL,
      },
      {
        organizationId: organization.id,
        caseId: kase.id,
        assignedToId: specialist.id,
        title: 'Prepare two passport photographs for the consulate visit',
        description: 'Bring the printed originals to the appointment — scans are not accepted at the counter.',
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
        body: 'Good news, Ivan — your criminal record certificate and diploma both passed legal review. We are now down to the insurance policy and the translation set.',
        createdAt: daysAgo(4),
        readByClientAt: daysAgo(4),
      },
      {
        organizationId: organization.id,
        caseId: kase.id,
        senderId: clientUser.id,
        senderType: ActorType.CLIENT,
        body: 'Thank you! My broker says the new policy will be issued on Thursday. Is that early enough?',
        createdAt: daysAgo(3),
        readByStaffAt: daysAgo(3),
      },
      {
        organizationId: organization.id,
        caseId: kase.id,
        senderId: specialist.id,
        senderType: ActorType.USER,
        body: 'Thursday works. Please upload it the same day so I can review it before the translator starts — the policy number goes into the translated set.',
        createdAt: daysAgo(3),
      },
      {
        organizationId: organization.id,
        caseId: kase.id,
        senderId: clientUser.id,
        senderType: ActorType.CLIENT,
        body: 'Understood. One question about the translation: should my middle name be included the way it appears in the passport?',
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
      payload: { from: 'Contract', to: 'Questionnaire' },
    },
    {
      eventType: EventType.STAGE_CHANGED,
      createdAt: daysAgo(30),
      actorType: ActorType.USER,
      actorId: specialist.id,
      actorLabel: specialist.name,
      payload: { from: 'Questionnaire', to: 'Document collection' },
    },
    {
      eventType: EventType.DOCUMENT_UPLOADED,
      createdAt: daysAgo(20),
      actorType: ActorType.CLIENT,
      actorId: clientUser.id,
      actorLabel: 'Ivan Petrov',
      payload: { filename: 'passport-petrov.pdf', version: 1 },
    },
    {
      eventType: EventType.DOCUMENT_APPROVED,
      createdAt: daysAgo(19),
      actorType: ActorType.USER,
      actorId: specialist.id,
      actorLabel: specialist.name,
      payload: { filename: 'passport-petrov.pdf', version: 1 },
    },
    {
      eventType: EventType.STAGE_CHANGED,
      createdAt: daysAgo(12),
      actorType: ActorType.INTEGRATION,
      actorLabel: 'BITRIX24',
      payload: { from: 'Document collection', to: 'Legal review', source: 'BITRIX24', externalStageId: 'C0:PREPARATION' },
    },
    {
      eventType: EventType.DOCUMENT_REJECTED,
      createdAt: daysAgo(3),
      actorType: ActorType.USER,
      actorId: specialist.id,
      actorLabel: specialist.name,
      payload: {
        filename: 'health-insurance-policy.pdf',
        version: 1,
        rejectionReason: 'Policy expires before the end of the requested stay.',
      },
    },
    {
      eventType: EventType.DOCUMENT_REQUESTED,
      createdAt: daysAgo(3),
      actorType: ActorType.USER,
      actorId: specialist.id,
      actorLabel: specialist.name,
      payload: { name: 'Replace: Health insurance policy', deadline: daysAhead(2).toISOString() },
    },
    {
      eventType: EventType.DOCUMENT_UPLOADED,
      createdAt: daysAgo(2),
      actorType: ActorType.CLIENT,
      actorId: clientUser.id,
      actorLabel: 'Ivan Petrov',
      payload: { filename: 'property-deed.pdf', version: 1 },
    },
    {
      eventType: EventType.MESSAGE_SENT,
      createdAt: daysAgo(1),
      actorType: ActorType.CLIENT,
      actorId: clientUser.id,
      actorLabel: 'Ivan Petrov',
      payload: { excerpt: 'One question about the translation…' },
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

  // A second client and case so list screens are not single-row.
  const secondClient = await prisma.client.create({
    data: {
      organizationId: organization.id,
      firstName: 'Marta',
      lastName: 'Kowalski',
      email: 'marta.kowalski@example.com',
      phone: '+48 601 222 333',
    },
  });

  await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: 'Marta Kowalski',
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
      title: 'France Residence Permit — Marta Kowalski',
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

  // Bitrix24 connection with pipeline/stage mapping, ready to be pointed at a
  // real portal by pasting an inbound webhook URL in Settings → Integrations.
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
    ['C0:NEW', 'New lead', 'Contract'],
    ['C0:PREPARATION', 'Docs received', 'Legal review'],
    ['C0:EXECUTING', 'In translation', 'Translation'],
    ['C0:FINAL_INVOICE', 'Submitted', 'Submission'],
    ['C0:WON', 'Approved', 'Decision'],
  ];

  for (const [externalStageId, externalStageName, stageName] of mappings) {
    const templateStage = template.stages.find((stage) => stage.name === stageName);
    await prisma.crmStageMapping.create({
      data: {
        connectionId: connection.id,
        pipelineId: '0',
        pipelineName: 'Residence permits',
        externalStageId,
        externalStageName,
        templateStageId: templateStage?.id ?? null,
      },
    });
  }

  // Progress is computed from the seeded state, never written by hand.
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
Demo organization ready: ${organization.name} (/${organization.slug})

  Employees   ${owner.email} (OWNER)
              ${manager.email} (MANAGER)
              ${specialist.email} (SPECIALIST)
  Client      ${client.email} (CLIENT portal)

  Case        ${demoCase.title}
              stage "Legal review", progress ${demoCase.progress}%
              16 document requirements — 12 approved, 1 under review, 1 rejected, 2 outstanding

Sign in from the login screen: enter one of the addresses above and open the
magic link printed in the API log.
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

import { Body, Controller, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import { CrmProviderKind, Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser, Public, Roles } from '../../../common/decorators';
import { zodPipe } from '../../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../../common/types/auth-context';
import {
  replaceMappingsSchema,
  upsertConnectionSchema,
  type ReplaceMappingsInput,
  type UpsertConnectionInput,
} from './crm.schema';
import { CrmService } from './crm.service';
import { CrmWebhookService } from './crm-webhook.service';

@Controller('integrations')
export class CrmController {
  constructor(
    private readonly crm: CrmService,
    private readonly webhooks: CrmWebhookService,
  ) {}

  @Get('crm')
  @Roles(Role.OWNER, Role.ADMIN)
  settings(@CurrentUser() auth: AuthContext) {
    return this.crm.getSettings(auth);
  }

  @Put('crm/connection')
  @Roles(Role.OWNER, Role.ADMIN)
  upsert(
    @CurrentUser() auth: AuthContext,
    @Body(zodPipe(upsertConnectionSchema)) body: UpsertConnectionInput,
  ) {
    return this.crm.upsertConnection(auth, body);
  }

  @Post('crm/connection/:id/test')
  @Roles(Role.OWNER, Role.ADMIN)
  test(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.crm.testConnection(auth, id);
  }

  @Post('crm/connection/:id/disconnect')
  @Roles(Role.OWNER, Role.ADMIN)
  disconnect(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.crm.disconnect(auth, id);
  }

  @Put('crm/connection/:id/mappings')
  @Roles(Role.OWNER, Role.ADMIN)
  mappings(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(replaceMappingsSchema)) body: ReplaceMappingsInput,
  ) {
    return this.crm.replaceMappings(auth, id, body);
  }

  /**
   * Inbound Bitrix24 webhook. Public by necessity — authentication is the
   * application token carried in the payload, matched against the stored
   * connection secret, which is also what identifies the tenant.
   */
  @Public()
  @Throttle({ webhook: { limit: 120, ttl: 60_000 } })
  @HttpCode(200)
  @Post('bitrix24/webhook')
  async bitrixWebhook(@Req() request: Request, @Body() body: Record<string, unknown>) {
    const result = await this.webhooks.handle(CrmProviderKind.BITRIX24, {
      headers: request.headers,
      body: body ?? {},
    });
    // Always 200: Bitrix retries aggressively on non-2xx, and an unmatched or
    // duplicate delivery is a normal outcome rather than a failure.
    return result;
  }
}

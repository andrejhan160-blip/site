import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../common/types/auth-context';
import {
  createClientSchema,
  listClientsSchema,
  updateClientSchema,
  type CreateClientInput,
  type ListClientsQuery,
  type UpdateClientInput,
} from './clients.schema';
import { ClientsService } from './clients.service';

@Controller('clients')
@Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SPECIALIST)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(@CurrentUser() auth: AuthContext, @Query(zodPipe(listClientsSchema)) query: ListClientsQuery) {
    return this.clients.list(auth, query);
  }

  @Get(':id')
  get(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.clients.get(auth, id);
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER)
  create(@CurrentUser() auth: AuthContext, @Body(zodPipe(createClientSchema)) body: CreateClientInput) {
    return this.clients.create(auth, body);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER)
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(updateClientSchema)) body: UpdateClientInput,
  ) {
    return this.clients.update(auth, id, body);
  }
}

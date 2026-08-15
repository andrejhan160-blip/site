import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { AppConfig } from '../../config/configuration';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('SESSION_SECRET', { infer: true }),
        signOptions: { issuer: 'caseflow' },
        verifyOptions: { issuer: 'caseflow' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionService],
  exports: [SessionService, AuthService],
})
export class AuthModule {}

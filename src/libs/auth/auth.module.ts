import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { RedlockModule } from '../redlock/redlock.module';
import { AttemptLimiterService } from './attemptLimiter.service';
import { AuthService } from './auth.service';

@Module({
  imports: [JwtModule.register({}), RedlockModule],
  controllers: [],
  providers: [AuthService, AttemptLimiterService],
  exports: [AuthService, AttemptLimiterService],
})
export class AuthModule {}

import { Injectable } from '@nestjs/common';
import { GraphQLError } from 'graphql';

import { RedisService } from '../redis/redis.service';
import { RedlockService } from '../redlock/redlock.service';

export const MAX_LOGIN_ATTEMPTS = 10;
export const LOGIN_ATTEMPT_WINDOW_SECONDS = 15 * 60;

export const MAX_TWO_FACTOR_ATTEMPTS = 5;
export const TWO_FACTOR_ATTEMPT_WINDOW_SECONDS = 10 * 60;

export const loginAttemptKey = (email: string) => `loginAttempts-${email}`;
export const twoFactorAttemptKey = (sessionId: string) =>
  `twoFactorAttempts-${sessionId}`;

@Injectable()
export class AttemptLimiterService {
  constructor(
    private redis: RedisService,
    private redlock: RedlockService,
  ) {}

  async registerAttempt(
    key: string,
    maxAttempts: number,
    windowSeconds: number,
  ): Promise<void> {
    await this.redlock.using(
      key,
      async () => {
        const attempts = (await this.redis.get<number>(key)) || 0;

        if (attempts >= maxAttempts) {
          throw new GraphQLError('Too many attempts. Please try again later.');
        }

        await this.redis.set<number>(key, attempts + 1, {
          ttl: windowSeconds,
        });
      },
      'Too many attempts. Please try again later.',
    );
  }

  async reset(key: string): Promise<void> {
    await this.redis.delete(key);
  }
}

import {
  Args,
  Context,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { account_2fa } from '@prisma/client';
import { Response } from 'express';
import { GraphQLError } from 'graphql';
import { CurrentUser } from 'src/auth/auth.decorators';
import { TwoFactorSession } from 'src/libs/2fa/2fa.types';
import {
  AttemptLimiterService,
  MAX_TWO_FACTOR_ATTEMPTS,
  TWO_FACTOR_ATTEMPT_WINDOW_SECONDS,
  twoFactorAttemptKey,
} from 'src/libs/auth/attemptLimiter.service';
import { PasskeyService } from 'src/libs/passkey/passkey.service';
import { RedisService } from 'src/libs/redis/redis.service';
import { TwoFactorRepository } from 'src/repo/2fa/2fa.repo';

import { AccountService } from '../account/account.service';
import { TwoFactorLoginMutations } from '../account/account.types';
import { TwoFactorService } from './2fa.service';
import {
  SimpleTwoFactor,
  TwoFactorMutations,
  TwoFactorOTPLogin,
  TwoFactorQueries,
} from './2fa.types';
import { twoFactorSessionKey } from './2fa.utils';

@Resolver(TwoFactorLoginMutations)
export class TwoFactorLoginMutationsResolver {
  constructor(
    private accountService: AccountService,
    private twoFactorService: TwoFactorService,
    private redisService: RedisService,
    private attemptLimiter: AttemptLimiterService,
  ) {}

  @ResolveField()
  async otp(
    @Args('input') input: TwoFactorOTPLogin,
    @Context() { res }: { res: Response },
  ) {
    const sessionKey = twoFactorSessionKey(input.session_id);
    const attemptKey = twoFactorAttemptKey(input.session_id);

    const session = await this.redisService.get<TwoFactorSession>(sessionKey);

    if (!session) {
      throw new GraphQLError(`Could not verify`);
    }

    await this.attemptLimiter.registerAttempt(
      attemptKey,
      MAX_TWO_FACTOR_ATTEMPTS,
      TWO_FACTOR_ATTEMPT_WINDOW_SECONDS,
    );

    const { accountId, accessToken, refreshToken } = session;

    const isValid = await this.twoFactorService.validOTP(accountId, input.code);
    if (!isValid) throw new GraphQLError(`Token invalid`);

    await this.redisService.delete(sessionKey);
    await this.attemptLimiter.reset(attemptKey);

    await this.accountService.setLoginCookies(
      res,
      accountId,
      accessToken,
      refreshToken,
    );

    return {
      id: accessToken,
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  @ResolveField()
  passkey() {
    return {};
  }
}

@Resolver(TwoFactorMutations)
export class TwoFactorMutationsResolver {
  @ResolveField()
  otp() {
    return {};
  }

  @ResolveField()
  passkey() {
    return {};
  }
}

@Resolver(SimpleTwoFactor)
export class SimpleTwoFactorResolver {
  constructor(private passkeyService: PasskeyService) {}

  @ResolveField()
  created_at(@Parent() { created_at }: account_2fa) {
    return created_at.toISOString();
  }

  @ResolveField()
  async passkey_name(@Parent() { payload }: account_2fa) {
    if (payload.type !== 'PASSKEY') return;
    const info = await this.passkeyService.getPasskeyInfo(payload.aaguid);
    return info.name;
  }
}

@Resolver(TwoFactorQueries)
export class TwoFactorQueriesResolver {
  constructor(private twoFactorRepo: TwoFactorRepository) {}

  @ResolveField()
  id(@CurrentUser() { user_id }: any) {
    return user_id;
  }

  @ResolveField()
  async find_many(@CurrentUser() { user_id }: any) {
    return this.twoFactorRepo.findAllForAccount(user_id);
  }
}

@Resolver()
export class TwoFactorMainMutationResolver {
  @Mutation(() => TwoFactorMutations)
  async two_factor() {
    return {};
  }
}

@Resolver()
export class TwoFactorMainQueryResolver {
  @Query(() => TwoFactorQueries)
  async two_factor() {
    return {};
  }
}

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { ConfigSchemaType } from './libs/config/validation';
import { CustomLogger } from './libs/logging';

const toAllowedOrigins = (domains: string[]): string[] =>
  domains.flatMap((domain) =>
    domain.includes('localhost')
      ? [`http://${domain}`, `https://${domain}`]
      : [`https://${domain}`],
  );

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);

  const domains =
    config.getOrThrow<ConfigSchemaType['server']['domains']>('server.domains');

  app.enableCors({
    origin: toAllowedOrigins(domains),
    credentials: true,
  });

  app.set('trust proxy', 1);

  app.useLogger(await app.resolve(CustomLogger));
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ forbidUnknownValues: false }));

  await app.listen(process.env.PORT || 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
void bootstrap();

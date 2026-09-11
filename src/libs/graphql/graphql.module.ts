import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { Request, Response } from 'express';
import { getIp } from 'src/utils/ip';

import { DataloaderModule } from '../dataloader/dataloader.module';
import { DataloaderService } from '../dataloader/dataloader.service';
import { ContextType } from './context.type';
import { graphqlLimitsPlugin } from './graphql.limits';

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      imports: [DataloaderModule, ConfigModule],
      inject: [DataloaderService, ConfigService],
      driver: ApolloDriver,
      useFactory: (
        dataloaderService: DataloaderService,
        config: ConfigService,
      ) => {
        const isProduction = config.get<boolean>('isProduction');

        return {
          path: 'api/graphql',
          driver: ApolloDriver,
          autoSchemaFile: 'schema.gql',
          sortSchema: true,
          playground: false,
          plugins: [
            graphqlLimitsPlugin(),
            ...(isProduction
              ? []
              : [ApolloServerPluginLandingPageLocalDefault()]),
          ],
          status400ForVariableCoercionErrors: true,
          context: async ({
            req,
            res,
          }: {
            req: Request;
            res: Response;
          }): Promise<ContextType> => {
            return {
              req,
              res,
              ip: getIp(req),
              loaders: dataloaderService.createLoaders(),
            };
          },
        };
      },
    }),
  ],
})
export class GraphqlModule {}

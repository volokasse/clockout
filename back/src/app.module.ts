import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { TimeTrackingModule } from './time-tracking/time-tracking.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,
    HealthModule,
    TimeTrackingModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

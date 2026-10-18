import { Module } from '@nestjs/common';
import { InfrastructureController } from './infrastructure.controller';
import { AuthModule } from './domains/auth.module';
import { UsersModule } from './domains/users.module';
import { StudyModule } from './domains/study.module';
import { AiModule } from './domains/ai.module';
import { SignalsModule } from './domains/signals.module';
import { AnalyticsModule } from './domains/analytics.module';
import { NotificationsModule } from './domains/notifications.module';
@Module({
  imports: [
    AuthModule,
    UsersModule,
    StudyModule,
    AiModule,
    SignalsModule,
    AnalyticsModule,
    NotificationsModule
  ],
  controllers: [InfrastructureController]
})
export class AppModule {}

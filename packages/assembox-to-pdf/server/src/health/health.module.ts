import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PoolModule } from '../pool/pool.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PoolModule, QueueModule],
  controllers: [HealthController],
})
export class HealthModule {}

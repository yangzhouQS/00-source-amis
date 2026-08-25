import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { PoolModule } from '../pool/pool.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PoolModule, QueueModule],
  controllers: [MetricsController],
})
export class MetricsModule {}

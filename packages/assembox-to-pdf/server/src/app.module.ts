import { Module } from '@nestjs/common';
import { QueueModule } from './queue/queue.module';
import { TicketModule } from './ticket/ticket.module';
import { SceneModule } from './scene/scene.module';
import { PoolModule } from './pool/pool.module';
import { RenderModule } from './render/render.module';
import { ExportsModule } from './exports/exports.module';
import { ClaimModule } from './claim/claim.module';
import { MockModule } from './mock/mock.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { PrintHostModule } from './printhost/printhost.module';

@Module({
  imports: [
    QueueModule,
    TicketModule,
    SceneModule,
    PoolModule,
    RenderModule,
    ExportsModule,
    ClaimModule,
    MockModule,
    HealthModule,
    MetricsModule,
    PrintHostModule,
  ],
})
export class AppModule {}


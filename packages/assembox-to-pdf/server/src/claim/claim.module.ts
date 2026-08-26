import { Module } from '@nestjs/common';
import { TicketModule } from '../ticket/ticket.module';
import { SceneModule } from '../scene/scene.module';
import { QueueModule } from '../queue/queue.module';
import { ClaimController } from './claim.controller';

@Module({
  imports: [TicketModule, SceneModule, QueueModule],
  controllers: [ClaimController],
})
export class ClaimModule {}

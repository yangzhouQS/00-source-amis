import { Module } from '@nestjs/common';
import { PoolModule } from '../pool/pool.module';
import { QueueModule } from '../queue/queue.module';
import { TicketModule } from '../ticket/ticket.module';
import { RenderService } from './render.service';
import { RenderWorker } from './render-worker';
import { PdfOptionsHelper } from './pdf-options';

@Module({
  imports: [PoolModule, QueueModule, TicketModule],
  providers: [RenderService, RenderWorker, PdfOptionsHelper],
  exports: [RenderService, RenderWorker, PdfOptionsHelper],
})
export class RenderModule {}

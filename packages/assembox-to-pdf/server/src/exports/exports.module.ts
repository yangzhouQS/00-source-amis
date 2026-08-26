import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { SceneModule } from '../scene/scene.module';
import { RenderModule } from '../render/render.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [QueueModule, SceneModule, RenderModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}

import { Module } from '@nestjs/common';
import { PrintHostController } from './printhost.controller';
import { SceneModule } from '../scene/scene.module';

@Module({
  imports: [SceneModule],
  controllers: [PrintHostController],
})
export class PrintHostModule {}

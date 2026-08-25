import { Module } from '@nestjs/common';
import { SceneService } from './scene.service';

@Module({
  providers: [SceneService],
  exports: [SceneService],
})
export class SceneModule {}

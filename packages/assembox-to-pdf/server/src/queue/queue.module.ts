import { Module } from '@nestjs/common';
import { InProcessQueue } from './in-process-queue';
import { TaskStore } from './task-store';

@Module({
  providers: [TaskStore, InProcessQueue],
  exports: [TaskStore, InProcessQueue],
})
export class QueueModule {}

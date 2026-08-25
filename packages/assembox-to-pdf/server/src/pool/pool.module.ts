import { Module } from '@nestjs/common';
import { BrowserPool } from './browser-pool';

@Module({
  providers: [BrowserPool],
  exports: [BrowserPool],
})
export class PoolModule {}

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });

  // printOptions 白名单收敛：未知字段剥除 + 类型转换
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // 打印宿主页静态资产（vite base=/print-assets/）：JS/CSS/vendor
  if (existsSync(config.printHostDist)) {
    app.useStaticAssets(config.printHostDist, { prefix: '/print-assets' });
  } else {
    logger.warn(`打印宿主页产物不存在: ${config.printHostDist}（先 pnpm --filter @cs/print-host build）`);
  }

  app.enableShutdownHooks(); // SIGTERM → 优雅停机（BrowserPool.onModuleDestroy）

  await app.listen(config.port, '0.0.0.0');
  logger.log(`assembox pdf-server listening on ${config.publicBaseUrl}`);
  logger.log(
    `chromium=${config.chromiumExecutablePath ?? '(未探测到!)'} pool=${config.poolContexts} queueMax=${config.queueMax}`,
  );
}

bootstrap().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('bootstrap failed', e);
  process.exit(1);
});

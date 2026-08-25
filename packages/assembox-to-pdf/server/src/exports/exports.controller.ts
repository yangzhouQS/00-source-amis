import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { ExportsService } from './exports.service';
import { CreateExportDto } from './dto';

@Controller('api/v1/exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  /** 创建异步导出任务 */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async create(@Body() dto: CreateExportDto): Promise<Record<string, unknown>> {
    // 测试环境租户固定；生产从网关身份取
    const task = await this.exportsService.create(dto, 'test-tenant');
    return {
      taskId: task.id,
      status: task.status,
      pollUrl: `/api/v1/exports/${task.id}`,
    };
  }

  /** 同步小文档通道：直接流式返回 PDF */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async createSync(
    @Body() dto: CreateExportDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, taskId } = await this.exportsService.renderSync(dto, 'test-tenant');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${dto.sceneId}-${taskId.slice(0, 8)}.pdf"`,
      'X-Task-Id': taskId,
    });
    return new StreamableFile(buffer);
  }

  /** 轮询任务状态 */
  @Get(':id')
  get(@Param('id') id: string): Record<string, unknown> {
    const task = this.exportsService.get(id);
    return {
      taskId: task.id,
      status: task.status,
      result: task.result
        ? {
            url: task.result.url,
            expiresAt: new Date(task.result.expiresAt).toISOString(),
            bytes: task.result.bytes,
            pages: task.result.pages,
          }
        : undefined,
      error: task.error,
      metrics: task.metrics,
    };
  }

  /** 取消排队任务 */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string): Record<string, unknown> {
    const task = this.exportsService.cancel(id);
    return { taskId: task.id, status: task.status };
  }

  /** 产物下载（测试环境未做签名，生产演进为签名 URL 直连对象存储） */
  @Get(':id/file')
  file(@Param('id') id: string, @Res({ passthrough: true }) res: Response): StreamableFile {
    const task = this.exportsService.get(id);
    if (task.status !== 'done' || !task.result) {
      throw new HttpException('任务未完成', HttpStatus.CONFLICT);
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${task.sceneId}-${task.id.slice(0, 8)}.pdf"`,
    });
    return new StreamableFile(createReadStream(task.result.file));
  }
}

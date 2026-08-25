import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { TicketService } from '../ticket/ticket.service';
import { SceneService } from '../scene/scene.service';
import { TaskStore } from '../queue/task-store';

class ClaimDto {
  @IsString()
  @IsNotEmpty()
  ticket!: string;
}

/**
 * 宿主页内部接口（方案 A §7.1 /internal/*）：
 * 一次性票据 → 完整任务载荷（场景 + 打印选项）。
 * 测试环境与公开 API 同端口；生产演进为独立内网端口/Guard（§9）。
 */
@Controller('internal/task')
export class ClaimController {
  constructor(
    private readonly tickets: TicketService,
    private readonly scenes: SceneService,
    private readonly store: TaskStore,
  ) {}

  @Post('claim')
  claim(@Body() dto: ClaimDto): Record<string, unknown> {
    const record = this.tickets.consume(dto.ticket);
    if (!record) {
      throw new HttpException('票据无效或已消费', HttpStatus.UNAUTHORIZED);
    }
    const task = this.store.get(record.taskId);
    const scene = this.scenes.assemble(record.sceneId);
    return {
      taskId: record.taskId,
      sceneName: scene.sceneName,
      uiSkeleton: scene.uiSkeleton,
      dataSource: scene.dataSource,
      routerConfig: scene.routerConfig,
      printOptions: {
        ...(task?.printOptions ?? {}),
        // 票据一次性消费后即失效：载荷内不再携带任何凭证（D1 凭证即票据本身）
      },
    };
  }

  /** 调试端点：签发测试票据（仅本地环境；生产部署必须关闭） */
  @Post('debug-ticket')
  debugTicket(@Body() dto: ClaimDto): Record<string, unknown> {
    const sceneId = dto.ticket; // 复用字段传 sceneId
    this.scenes.assemble(sceneId); // 校验存在
    const taskId = `debug-${Date.now().toString(36)}`;
    const ticket = this.tickets.issue(taskId, sceneId);
    return { printUrl: `/print?ticket=${encodeURIComponent(ticket)}` };
  }
}

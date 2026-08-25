import { IsIn, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Length, Max, Min } from 'class-validator';

/** printOptions 白名单收敛（未知字段由全局 ValidationPipe whitelist 剥除） */
export class PrintOptionsDto {
  @IsOptional()
  @IsIn(['A4', 'A3', 'Letter'])
  format?: 'A4' | 'A3' | 'Letter';

  @IsOptional()
  @IsIn(['portrait', 'landscape'])
  orientation?: 'portrait' | 'landscape';

  @IsOptional()
  @IsObject()
  marginsMm?: { top?: number; bottom?: number; left?: number; right?: number };

  @IsOptional()
  @IsString()
  @Length(0, 200)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  rowLimit?: number;

  @IsOptional()
  @IsIn([true, false])
  keepNav?: boolean;

  @IsOptional()
  @IsIn([true, false])
  tolerant?: boolean;

  @IsOptional()
  @IsIn(['browser', 'prefetch'])
  dataMode?: 'browser' | 'prefetch';

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  scale?: number;

  @IsOptional()
  @IsIn([true, false])
  showPageNumber?: boolean;
}

export class CreateExportDto {
  @IsString()
  @IsNotEmpty({ message: 'sceneId 不能为空' })
  sceneId!: string;

  @IsOptional()
  printOptions?: PrintOptionsDto;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}

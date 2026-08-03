import { join } from "node:path";
import { CasClientModule } from "@cs/nest-cas-client";
import { CSModule } from "@cs/nest-cloud";
import { ConfigModule, ConfigService } from "@cs/nest-config";
import { DatabaseModule } from "@cs/nest-typeorm";
import { Global } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";

@Global()
@CSModule({
  imports: [
    CasClientModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        return {
          ...config.get("cas"),
        };
      },
    }),
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        return [
          {
            rootPath: join(__dirname, "../..", "dist/"),
            serveRoot: `/${config.get("serverPath")}`,
            exclude: [], // 定义要排除的路径模式，这些路径不会被作为静态文件处理
            serveStaticOptions: {
              fallthrough: false, // 表示如果找不到请求的静态文件，继续传递请求给下一个中间件或路由处理器
            },
          },
        ];
      },
    }),
    DatabaseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        return config.get("mysql");
      },
    }),
  ],
  providers: [],
  exports: [],
})
export class ShareModule {}

import { CasClientMiddleware } from "@cs/nest-cas-client";
import { MiddlewareConsumer, Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ShareModule } from "./share.module";

@Module({
  imports: [ShareModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CasClientMiddleware).forRoutes("/*");
  }
}

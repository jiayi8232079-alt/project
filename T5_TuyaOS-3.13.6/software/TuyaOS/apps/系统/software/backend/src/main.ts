import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) (globalThis as any).crypto = webcrypto;

// 全局锁定业务时区为 Asia/Shanghai：保证 new Date().toLocaleString()、日志时间戳、
// JS 内部 Date 对象和 cron 触发等与数据库 +08:00 对齐，抵御部署到非中国机器时的时区漂移。
if (!process.env.TZ) {
  process.env.TZ = 'Asia/Shanghai';
}

import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProd = nodeEnv === 'production';
  const corsOrigin = configService.get<string>('CORS_ORIGIN');

  if (isProd && !corsOrigin) {
    throw new Error('CORS_ORIGIN must be configured in production');
  }
  app.enableCors({
    origin: corsOrigin
      ? corsOrigin
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.use(helmet({ contentSecurityPolicy: false }));

  // 全局 JSON/表单 body 大小限制（默认 1MB）。文件上传走 multer，不受此限制。
  // 防止公开端点（如 /public/health-profile/:sceneCode）被发超大 payload 撑爆数据库 JSON 列。
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // 保护 uploads/generated/ 下的敏感 HTML（健康档案、委托书等）：
  // 真实校验 JWT 签名，防止任意「Bearer xxx」字串都能绕过的旧实现。
  // 同时支持 `?token=xxx` query（小程序 web-view 不便注入 Authorization 头）。
  // 细粒度授权（这份档案是不是你的）仍由对应 API 端点负责，此处只负责把
  // 「未登录用户拿到 URL 直接访问」这类匿名访问拦在门外。
  const jwtService = app.get(JwtService);
  app.use('/uploads/generated', (req: any, res: any, next: () => void) => {
    const auth: string | undefined = req.headers?.authorization;
    const headerToken =
      auth && auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
    const queryToken =
      typeof req.query?.token === 'string' ? String(req.query.token).trim() : '';
    const token = headerToken || queryToken;
    if (!token) {
      res.status(401).json({ message: '需要登录才能访问' });
      return;
    }
    try {
      jwtService.verify(token);
      next();
    } catch {
      res.status(401).json({ message: '登录已失效或无权访问' });
    }
  });

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline');
      }
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const swaggerCfg = configService.get<string>('SWAGGER_ENABLED');
  const swaggerEnabled =
    swaggerCfg === 'true' ||
    (!isProd && swaggerCfg !== 'false');
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('陪了个伴陪诊服务管理系统 API')
      .setDescription('陪了个伴陪诊服务管理系统后端接口文档')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, document);
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  if (swaggerEnabled) {
    console.log(`Swagger docs: http://localhost:${port}/api-docs`);
  }
}
bootstrap();

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ThirdPartyApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('THIRD_PARTY_API_KEY', '').trim();
    if (!expected) {
      throw new ForbiddenException('第三方接口未启用');
    }

    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      query?: Record<string, string | string[] | undefined>;
    }>();

    const headerRaw = request.headers?.['x-api-key'];
    const queryRaw = request.query?.apiKey;
    const provided = this.pickFirstString(headerRaw) || this.pickFirstString(queryRaw) || '';

    if (!provided || provided !== expected) {
      throw new UnauthorizedException('API Key 无效');
    }
    return true;
  }

  private pickFirstString(value: string | string[] | undefined): string {
    if (Array.isArray(value)) return value[0] || '';
    return value || '';
  }
}

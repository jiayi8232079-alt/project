import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  DeviceBinding,
  DeviceBindingRole,
} from '../../../entities/device-binding.entity.js';
import { Device } from '../../../entities/device.entity.js';
import { DeviceContext } from '../tools/tool.interface.js';

/**
 * 解析 MCP 请求头里的 X-Device-Id → 反查得到 userId/tenantId/serviceTargetId
 * → 挂在 request.deviceContext 上，供 tool 安全使用。
 *
 * 安全意义：tool 不再信任 LLM 传入的 userId/tenantId，
 * 一切以「这台设备的 owner 绑定」为准。
 *
 * 失败场景：
 * - 缺 X-Device-Id           → 401
 * - 设备不在我们系统         → 401（涂鸦云转 fake 也拒）
 * - 设备没有 owner 绑定       → 401（已解绑/未配网完成）
 */
@Injectable()
export class DeviceContextGuard implements CanActivate {
  private readonly logger = new Logger(DeviceContextGuard.name);

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(DeviceBinding)
    private readonly bindingRepo: Repository<DeviceBinding>,
  ) {}

  async canActivate(execCtx: ExecutionContext): Promise<boolean> {
    const req = execCtx.switchToHttp().getRequest();
    const tuyaDeviceId = req.headers['x-device-id'] as string | undefined;
    const sessionId = (req.headers['x-session-id'] as string) ?? '';
    const requestId = (req.headers['x-request-id'] as string) ?? '';

    if (!tuyaDeviceId) {
      throw new UnauthorizedException('缺少 X-Device-Id 请求头');
    }

    const device = await this.deviceRepo.findOne({
      where: { tuyaDeviceId },
    });
    if (!device) {
      this.logger.warn(`未知设备调用 MCP：${tuyaDeviceId}`);
      throw new UnauthorizedException('设备未注册');
    }

    const ownerBinding = await this.bindingRepo.findOne({
      where: {
        deviceId: device.id,
        role: DeviceBindingRole.OWNER,
        unboundAt: IsNull(),
      },
    });
    if (!ownerBinding) {
      throw new UnauthorizedException('设备未绑定主人');
    }

    const deviceContext: DeviceContext = {
      tuyaDeviceId,
      deviceId: device.id,
      userId: ownerBinding.userId,
      tenantId: device.tenantId,
      serviceTargetId: ownerBinding.serviceTargetId,
      sessionId,
      requestId,
    };
    req.deviceContext = deviceContext;
    return true;
  }
}

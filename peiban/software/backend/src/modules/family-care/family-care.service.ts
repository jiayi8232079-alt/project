import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FamilyMessage } from '../../entities/family-message.entity.js';
import { FamilyTask, FamilyTaskStatus } from '../../entities/family-task.entity.js';
import { VoiceprintProfile, VoiceprintStatus } from '../../entities/voiceprint-profile.entity.js';
import {
  CreateFamilyMessageDto,
  CreateFamilyTaskDto,
  CreateVoiceprintDto,
  MockFamilyTaskReceiptDto,
  UpdateVoiceprintStatusDto,
} from './dto/family-care.dto.js';

@Injectable()
export class FamilyCareService {
  constructor(
    @InjectRepository(FamilyTask)
    private readonly taskRepo: Repository<FamilyTask>,
    @InjectRepository(FamilyMessage)
    private readonly messageRepo: Repository<FamilyMessage>,
    @InjectRepository(VoiceprintProfile)
    private readonly voiceprintRepo: Repository<VoiceprintProfile>,
  ) {}

  createMessage(userId: number, dto: CreateFamilyMessageDto) {
    return this.messageRepo.save(
      this.messageRepo.create({
        familyId: dto.familyId,
        elderId: dto.elderId ?? null,
        createdBy: userId,
        message: dto.message,
        broadcastMode: dto.broadcastMode ?? 'next_available',
        broadcastedAt: null,
      }),
    );
  }

  listMessages(familyId: number) {
    return this.messageRepo.find({
      where: { familyId },
      order: { createdAt: 'DESC' },
    });
  }

  createTask(userId: number, dto: CreateFamilyTaskDto) {
    return this.taskRepo.save(
      this.taskRepo.create({
        familyId: dto.familyId,
        elderId: dto.elderId ?? null,
        createdBy: userId,
        title: dto.title,
        type: dto.type,
        message: dto.message ?? null,
        scheduleMode: dto.scheduleMode ?? 'next_available',
        remindAt: dto.remindAt ? new Date(dto.remindAt) : null,
        status: FamilyTaskStatus.PENDING,
        broadcastedAt: null,
        elderResponse: null,
      }),
    );
  }

  listTasks(familyId: number) {
    return this.taskRepo.find({
      where: { familyId },
      order: { createdAt: 'DESC' },
    });
  }

  async cancelTask(id: number) {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('家庭任务不存在');
    }
    task.status = FamilyTaskStatus.CANCELLED;
    return this.taskRepo.save(task);
  }

  async mockTaskReceipt(id: number, dto: MockFamilyTaskReceiptDto) {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('家庭任务不存在');
    }
    task.status = dto.status;
    task.broadcastedAt =
      dto.status === FamilyTaskStatus.BROADCASTED ||
      dto.status === FamilyTaskStatus.RESPONDED
        ? new Date()
        : task.broadcastedAt;
    task.elderResponse = dto.elderResponse ?? task.elderResponse;
    return this.taskRepo.save(task);
  }

  async createVoiceprint(dto: CreateVoiceprintDto) {
    const existing = await this.voiceprintRepo.findOne({
      where: { familyId: dto.familyId, memberId: dto.memberId },
    });
    if (existing) return existing;
    return this.voiceprintRepo.save(
      this.voiceprintRepo.create({
        familyId: dto.familyId,
        memberId: dto.memberId,
        status: VoiceprintStatus.ENROLLING,
        confidence: null,
        enrolledAt: null,
        revokedAt: null,
        misrecognitionCount: 0,
      }),
    );
  }

  listVoiceprints(familyId: number) {
    return this.voiceprintRepo.find({
      where: { familyId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateVoiceprintStatus(id: number, dto: UpdateVoiceprintStatusDto) {
    const profile = await this.voiceprintRepo.findOne({ where: { id } });
    if (!profile) {
      throw new NotFoundException('声纹记录不存在');
    }
    profile.status = dto.status;
    profile.confidence = dto.confidence ?? profile.confidence;
    profile.enrolledAt =
      dto.status === VoiceprintStatus.ACTIVE ? new Date() : profile.enrolledAt;
    profile.revokedAt =
      dto.status === VoiceprintStatus.REVOKED ? new Date() : profile.revokedAt;
    return this.voiceprintRepo.save(profile);
  }
}

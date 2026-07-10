import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ServiceProvider,
  ServiceProviderStatus,
} from '../../entities/service-provider.entity.js';
import {
  HospitalPartnership,
  HospitalPartnershipStatus,
} from '../../entities/hospital-partnership.entity.js';
import {
  CreateHospitalPartnershipDto,
  CreateServiceProviderDto,
} from './dto/service-collaboration.dto.js';

@Injectable()
export class ServiceCollaborationService {
  constructor(
    @InjectRepository(ServiceProvider)
    private readonly providerRepo: Repository<ServiceProvider>,
    @InjectRepository(HospitalPartnership)
    private readonly partnershipRepo: Repository<HospitalPartnership>,
  ) {}

  createProvider(dto: CreateServiceProviderDto) {
    return this.providerRepo.save(
      this.providerRepo.create({
        name: dto.name,
        type: dto.type,
        status: ServiceProviderStatus.ACTIVE,
        serviceArea: dto.serviceArea ?? null,
        catalog: dto.catalog ?? null,
        credentials: dto.credentials ?? null,
        settlement: dto.settlement ?? null,
      }),
    );
  }

  listProviders() {
    return this.providerRepo.find({ order: { createdAt: 'DESC' } });
  }

  createHospitalPartnership(dto: CreateHospitalPartnershipDto) {
    return this.partnershipRepo.save(
      this.partnershipRepo.create({
        hospitalId: dto.hospitalId ?? null,
        hospitalName: dto.hospitalName,
        partnershipType: dto.partnershipType,
        status: HospitalPartnershipStatus.ACTIVE,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        resources: dto.resources ?? null,
        benefits: dto.benefits ?? null,
      }),
    );
  }

  listHospitalPartnerships() {
    return this.partnershipRepo.find({
      where: { status: HospitalPartnershipStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }
}

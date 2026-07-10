import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../../entities/order.entity.js';
import { Review } from '../../entities/review.entity.js';
import { Attendant } from '../../entities/attendant.entity.js';
import { FinanceRecord } from '../../entities/finance-record.entity.js';
import { AuditLog } from '../../entities/audit-log.entity.js';
import {
  FinanceRecordStatus,
  OrderStatus,
  PaymentStatus,
  SettlementStatus,
} from '../../common/enums/index.js';

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function addDays(d: Date, days: number) {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}
function pctDelta(current: number, previous: number): number | null {
  if (!previous) {
    if (!current) return 0;
    return null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Attendant)
    private readonly attendantRepo: Repository<Attendant>,
    @InjectRepository(FinanceRecord)
    private readonly financeRepo: Repository<FinanceRecord>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async getOverview() {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const yesterdayStart = addDays(todayStart, -1);
    const yesterdayEnd = addDays(todayEnd, -1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999,
    );
    const last30Start = addDays(todayStart, -29);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      todayOrders,
      yesterdayOrders,
      monthIncomeRaw,
      lastMonthIncomeRaw,
      todayIncomeRaw,
      yesterdayIncomeRaw,
      activeAttendants,
      completedOrders,
      canceledOrders,
      emergencyOrders,
      unpaidOrders,
      pendingSettlementOrders,
      pendingFinanceRecords,
      reviewAgg,
      lowRatingCount,
      recentReviews,
      topAttendantsRaw,
      last24hAdminActions,
      last24hLoginFailures,
      last24hCreatedOrders,
    ] = await Promise.all([
      this.orderRepo
        .createQueryBuilder('o')
        .where('o.created_at BETWEEN :a AND :b', {
          a: todayStart,
          b: todayEnd,
        })
        .getCount(),
      this.orderRepo
        .createQueryBuilder('o')
        .where('o.created_at BETWEEN :a AND :b', {
          a: yesterdayStart,
          b: yesterdayEnd,
        })
        .getCount(),
      this.orderRepo
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o.total_fee), 0)', 'total')
        .where('o.created_at BETWEEN :a AND :b', {
          a: monthStart,
          b: monthEnd,
        })
        .andWhere('o.payment_status = :ps', { ps: PaymentStatus.PAID })
        .getRawOne<{ total: string | number }>(),
      this.orderRepo
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o.total_fee), 0)', 'total')
        .where('o.created_at BETWEEN :a AND :b', {
          a: lastMonthStart,
          b: lastMonthEnd,
        })
        .andWhere('o.payment_status = :ps', { ps: PaymentStatus.PAID })
        .getRawOne<{ total: string | number }>(),
      this.orderRepo
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o.total_fee), 0)', 'total')
        .where('o.created_at BETWEEN :a AND :b', {
          a: todayStart,
          b: todayEnd,
        })
        .andWhere('o.payment_status = :ps', { ps: PaymentStatus.PAID })
        .getRawOne<{ total: string | number }>(),
      this.orderRepo
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o.total_fee), 0)', 'total')
        .where('o.created_at BETWEEN :a AND :b', {
          a: yesterdayStart,
          b: yesterdayEnd,
        })
        .andWhere('o.payment_status = :ps', { ps: PaymentStatus.PAID })
        .getRawOne<{ total: string | number }>(),
      this.attendantRepo.count({ where: { status: 'active' } }),
      this.orderRepo
        .createQueryBuilder('o')
        .where('o.status = :s', { s: OrderStatus.COMPLETED })
        .andWhere('o.updated_at BETWEEN :a AND :b', {
          a: last30Start,
          b: todayEnd,
        })
        .getCount(),
      this.orderRepo
        .createQueryBuilder('o')
        .where('o.status = :s', { s: OrderStatus.CANCELED })
        .andWhere('o.updated_at BETWEEN :a AND :b', {
          a: last30Start,
          b: todayEnd,
        })
        .getCount(),
      this.orderRepo.count({
        where: { status: OrderStatus.EMERGENCY },
      }),
      this.orderRepo
        .createQueryBuilder('o')
        .where('o.payment_status = :ps', { ps: PaymentStatus.UNPAID })
        .andWhere('o.status NOT IN (:...excluded)', {
          excluded: [OrderStatus.CANCELED],
        })
        .getCount(),
      this.orderRepo
        .createQueryBuilder('o')
        .where('o.status = :s', { s: OrderStatus.COMPLETED })
        .andWhere('o.settlement_status = :ss', {
          ss: SettlementStatus.PENDING,
        })
        .getCount(),
      this.financeRepo.count({
        where: { status: FinanceRecordStatus.PENDING },
      }),
      this.reviewRepo
        .createQueryBuilder('r')
        .select('COUNT(r.id)', 'cnt')
        .addSelect('COALESCE(AVG(r.rating), 0)', 'avg')
        .where('r.created_at >= :start', { start: last30Start })
        .getRawOne<{ cnt: string | number; avg: string | number }>(),
      this.reviewRepo
        .createQueryBuilder('r')
        .where('r.created_at >= :start', { start: last30Start })
        .andWhere('r.rating <= :rating', { rating: 2 })
        .getCount(),
      this.reviewRepo
        .createQueryBuilder('r')
        .leftJoinAndSelect('r.order', 'o')
        .where('r.rating <= :rating', { rating: 2 })
        .orderBy('r.id', 'DESC')
        .limit(5)
        .getMany(),
      this.orderRepo
        .createQueryBuilder('o')
        .select('o.attendant_id', 'attendantId')
        .addSelect('COUNT(o.id)', 'orderCount')
        .addSelect('COALESCE(SUM(o.total_fee), 0)', 'totalFee')
        .where('o.status = :s', { s: OrderStatus.COMPLETED })
        .andWhere('o.attendant_id IS NOT NULL')
        .andWhere('o.updated_at >= :start', { start: last30Start })
        .groupBy('o.attendant_id')
        .orderBy('orderCount', 'DESC')
        .limit(5)
        .getRawMany<{
          attendantId: number | string;
          orderCount: string | number;
          totalFee: string | number;
        }>(),
      this.auditRepo
        .createQueryBuilder('log')
        .where('log.created_at >= :t', { t: last24h })
        .andWhere('log.actor_type = :at', { at: 'admin' })
        .getCount(),
      this.auditRepo
        .createQueryBuilder('log')
        .where('log.created_at >= :t', { t: last24h })
        .andWhere('log.action = :a', { a: 'auth.login' })
        .andWhere('log.status_code >= :s', { s: 400 })
        .getCount(),
      this.orderRepo
        .createQueryBuilder('o')
        .where('o.created_at >= :t', { t: last24h })
        .getCount(),
    ]);

    // 附加 attendant 信息
    const topAttendantIds = topAttendantsRaw
      .map((r) => Number(r.attendantId))
      .filter((id) => Number.isFinite(id) && id > 0);
    const attendantMap = new Map<number, Attendant>();
    if (topAttendantIds.length) {
      const attendants = await this.attendantRepo.find({
        where: { id: In(topAttendantIds) },
      });
      attendants.forEach((a) => attendantMap.set(a.id, a));
    }
    const topAttendants = topAttendantsRaw.map((raw) => {
      const id = Number(raw.attendantId);
      const att = attendantMap.get(id);
      return {
        attendantId: id,
        attendantName: att?.realName || `陪诊员#${id}`,
        avatar: att?.avatarUrl || null,
        orderCount: Number(raw.orderCount || 0),
        totalFee: Number(raw.totalFee || 0),
      };
    });

    const recentLowReviews = recentReviews.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderNumber: (r as any).order?.orderNumber || '',
      rating: r.rating,
      comment: (r.comment || '').slice(0, 80),
      createdAt: r.createdAt ? r.createdAt.toISOString() : null,
    }));

    const monthIncome = Number(monthIncomeRaw?.total || 0);
    const lastMonthIncome = Number(lastMonthIncomeRaw?.total || 0);
    const todayIncome = Number(todayIncomeRaw?.total || 0);
    const yesterdayIncome = Number(yesterdayIncomeRaw?.total || 0);
    const reviewCount = Number(reviewAgg?.cnt || 0);
    const avgRating = Number(reviewAgg?.avg || 0);
    const goodReviewRate =
      reviewCount > 0
        ? Math.round(((reviewCount - lowRatingCount) / reviewCount) * 1000) / 10
        : null;

    return {
      updatedAt: now.toISOString(),
      kpis: {
        todayOrders,
        yesterdayOrders,
        ordersDoD: pctDelta(todayOrders, yesterdayOrders),
        todayIncome,
        yesterdayIncome,
        incomeDoD: pctDelta(todayIncome, yesterdayIncome),
        monthIncome,
        lastMonthIncome,
        incomeMoM: pctDelta(monthIncome, lastMonthIncome),
        activeAttendants,
        last24hCreatedOrders,
      },
      operations: {
        completedLast30: completedOrders,
        canceledLast30: canceledOrders,
        emergencyNow: emergencyOrders,
        unpaidOrders,
        pendingSettlementOrders,
        pendingFinanceRecords,
      },
      reviews: {
        last30Count: reviewCount,
        avgRating: Math.round(avgRating * 100) / 100,
        lowRatingCount,
        goodReviewRate,
        recentLow: recentLowReviews,
      },
      topAttendants,
      audit: {
        last24hAdminActions,
        last24hLoginFailures,
      },
    };
  }
}

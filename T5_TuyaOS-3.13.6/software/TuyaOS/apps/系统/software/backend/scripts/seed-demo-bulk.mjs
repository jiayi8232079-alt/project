#!/usr/bin/env node
/**
 * 全局演示数据批量种子 —— 约 400 用户 + 全模块关联数据。
 * 可重复执行：仅补齐 demo_bulk_* 用户至 TARGET_USERS。
 *
 * 用法: node scripts/seed-demo-bulk.mjs
 *       TARGET_USERS=500 node scripts/seed-demo-bulk.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_USERS = Number(process.env.TARGET_USERS || 400);
const BATCH = 80;
const OPENID_PREFIX = 'demo_bulk_';

const SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗', '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧'];
const GIVEN = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '华', '平', '刚', '桂英', '玉兰', '建国', '建华', '志强', '秀兰', '国华', '春梅', '淑珍'];
const CITIES = ['丽水', '温州', '杭州', '上海', '宁波', '金华'];
const HOSPITALS = ['市中心医院', '人民医院', '中医院', '第一医院', '第二医院'];
const DEPTS = ['心内科', '老年病科', '骨科', '神经内科', '内分泌科', '体检中心'];
const SERVICE_TYPES = ['陪诊服务', '半日陪诊', '体检陪同', '住院陪护', '专家匹配'];
const ORDER_STATUSES = ['pending_dispatch', 'pending_accept', 'pending_grab', 'in_progress', 'pending_review', 'completed', 'canceled'];
const MEDICINES = ['阿司匹林', '二甲双胍', '氨氯地平', '阿托伐他汀', '奥美拉唑', '硝苯地平', '格列美脲'];

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function nameOf(i) {
  return pick(SURNAMES, i) + pick(GIVEN, i * 3 + 7) + (i % 9 === 0 ? pick(GIVEN, i + 1) : '');
}

function elderNameOf(i) {
  const s = pick(SURNAMES, i + 11);
  return (i % 2 === 0 ? s + '奶奶' : s + '爷爷');
}

function phoneOf(i) {
  return `138${String(10000000 + i).slice(-8)}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function batchInsert(conn, table, columns, rows) {
  if (!rows.length) return;
  for (const part of chunk(rows, BATCH)) {
    const placeholders = part.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    const flat = part.flat();
    await conn.query(`INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(',')}) VALUES ${placeholders}`, flat);
  }
}

async function countLike(conn, table, col, prefix) {
  const [[r]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${table}\` WHERE \`${col}\` LIKE ?`, [`${prefix}%`]);
  return r.c;
}

async function main() {
  const env = loadEnv();
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    multipleStatements: false,
  });

  console.log(`=== 全局演示数据批量种子（目标 ${TARGET_USERS} 用户）===\n`);

  const existing = await countLike(conn, 'users', 'openid', OPENID_PREFIX);
  const toCreate = Math.max(0, TARGET_USERS - existing);
  if (toCreate === 0) {
    console.log(`已有 ${existing} 个 demo_bulk 用户，已达目标。正在补齐关联数据…\n`);
  } else {
    console.log(`已有 ${existing} 个，将新增 ${toCreate} 个用户及关联数据\n`);
  }

  const [tenants] = await conn.query('SELECT id FROM tenants ORDER BY id');
  const tenantIds = tenants.map((t) => t.id);
  const [hospitals] = await conn.query('SELECT id, name, city FROM hospitals LIMIT 200');
  const [levels] = await conn.query('SELECT id FROM membership_levels ORDER BY id LIMIT 5');
  const [cardTypes] = await conn.query('SELECT id FROM membership_card_types ORDER BY id LIMIT 1');
  const [roles] = await conn.query('SELECT id, tenant_id FROM tenant_roles WHERE tenant_id IS NOT NULL OR tenant_id = 1 LIMIT 20');
  const [proServices] = await conn.query('SELECT id FROM professional_services WHERE enabled = 1 LIMIT 5');
  const levelId = levels[0]?.id ?? 1;
  const cardTypeId = cardTypes[0]?.id ?? null;
  const attendantPwd = await bcrypt.hash('123456', 8);

  // ── 订阅套餐（若空）──
  let [[planCount]] = await conn.query('SELECT COUNT(*) AS c FROM subscription_plans');
  if (planCount.c === 0) {
    await conn.query(
      `INSERT INTO subscription_plans (tenant_id, code, name, category, billing_cycle, price, trial_days, benefits, description, created_at, updated_at)
       VALUES (1,'basic','基础陪护套餐','device','monthly',99.00,7,'["AI陪聊","用药提醒"]','演示套餐',NOW(),NOW()),
              (1,'premium','尊享健康套餐','ai','monthly',199.00,14,'["AI陪聊","健康周报","设备联动"]','演示套餐',NOW(),NOW())`,
    );
    console.log('[+] subscription_plans × 2');
  }
  const [plans] = await conn.query('SELECT id FROM subscription_plans LIMIT 5');

  const startIdx = existing + 1;
  const endIdx = existing + toCreate;

  const userRows = [];
  const userMeta = [];

  for (let i = startIdx; i <= endIdx; i++) {
    const seq = String(i).padStart(4, '0');
    const isAttendant = i % 10 === 0;
    const tenantId = pick(tenantIds, i);
    userRows.push([
      `${OPENID_PREFIX}${seq}`,
      nameOf(i),
      phoneOf(i),
      isAttendant ? 'attendant' : 'user',
      1,
      i % 5 === 0 ? 'simplified' : 'normal',
      tenantId,
    ]);
    userMeta.push({ seq: i, isAttendant, tenantId });
  }

  if (userRows.length) {
    await batchInsert(
      conn,
      'users',
      ['openid', 'nickname', 'phone', 'role', 'status', 'ui_mode', 'tenant_id', 'created_at', 'updated_at'],
      userRows.map((r) => [...r, new Date(), new Date()]),
    );
    console.log(`[+] users × ${userRows.length}`);
  }

  const [bulkUsers] = await conn.query(
    `SELECT id, openid, nickname, phone, role, tenant_id FROM users WHERE openid LIKE ? ORDER BY openid`,
    [`${OPENID_PREFIX}%`],
  );
  console.log(`    当前 demo 用户总数: ${bulkUsers.length}`);

  const userByOpenid = new Map(bulkUsers.map((u) => [u.openid, u]));

  // ── 服务对象 ──
  const [existingTargetUserIds] = await conn.query(
    `SELECT user_id FROM service_targets WHERE user_id IN (${bulkUsers.map(() => '?').join(',')})`,
    bulkUsers.map((u) => u.id),
  );
  const hasTarget = new Set(existingTargetUserIds.map((r) => r.user_id));
  const targetRows = [];
  for (const u of bulkUsers) {
    if (hasTarget.has(u.id)) continue;
    const idx = Number(u.openid.replace(OPENID_PREFIX, ''));
    const age = 65 + (idx % 25);
    targetRows.push([
      u.id,
      elderNameOf(idx),
      idx % 2 === 0 ? '女' : '男',
      age,
      phoneOf(idx + 500000),
      `${pick(CITIES, idx)}市莲都区演示路${idx}号`,
      JSON.stringify({ chronicDiseases: [pick(['高血压', '糖尿病', '冠心病'], idx)], demo: true }),
      u.tenant_id,
    ]);
  }

  if (targetRows.length) {
    await batchInsert(
      conn,
      'service_targets',
      ['user_id', 'name', 'gender', 'age', 'phone', 'home_address', 'health_profile', 'tenant_id', 'created_at', 'updated_at'],
      targetRows.map((r) => [...r, new Date(), new Date()]),
    );
    console.log(`[+] service_targets × ${targetRows.length}`);
  }

  const [allTargets] = await conn.query(
    `SELECT id, user_id, name, tenant_id FROM service_targets WHERE user_id IN (${bulkUsers.map(() => '?').join(',')})`,
    bulkUsers.map((u) => u.id),
  );
  const targetByUser = new Map(allTargets.map((t) => [t.user_id, t]));

  // ── 护工/服务人员 ──
  const attendantUsers = bulkUsers.filter((u) => u.role === 'attendant');
  const [[attCount]] = await conn.query(
    `SELECT COUNT(*) AS c FROM attendants WHERE username LIKE 'demo_att_%'`,
  );
  if (attCount.c < attendantUsers.length * 0.8) {
    const attRows = attendantUsers.map((u, i) => {
      const idx = Number(u.openid.replace(OPENID_PREFIX, ''));
      return [
        u.id,
        u.nickname,
        `demo_att_${String(idx).padStart(4, '0')}`,
        attendantPwd,
        u.phone,
        'attendant',
        JSON.stringify(['attendant']),
        JSON.stringify(['陪诊', '老年护理']),
        4.5 + (i % 5) * 0.1,
        'active',
        3 + (i % 8),
        u.tenant_id,
      ];
    });
    await batchInsert(
      conn,
      'attendants',
      ['user_id', 'real_name', 'username', 'password', 'phone', 'primary_role', 'professional_roles', 'specialties', 'rating', 'status', 'experience_years', 'tenant_id', 'created_at', 'updated_at'],
      attRows.map((r) => [...r, new Date(), new Date()]),
    );
    console.log(`[+] attendants × ${attRows.length}`);
  }

  const [allAttendants] = await conn.query(`SELECT id, user_id, tenant_id FROM attendants WHERE username LIKE 'demo_att_%'`);
  const attendantByUser = new Map(allAttendants.map((a) => [a.user_id, a]));

  // ── 家庭组 + 成员 ──
  const [[fgCount]] = await conn.query(`SELECT COUNT(*) AS c FROM family_groups WHERE invite_code LIKE 'BLK%'`);
  const groupsNeeded = Math.ceil(bulkUsers.length / 3) - fgCount.c;
  const groupIds = [];
  if (groupsNeeded > 0) {
    const fgRows = [];
    for (let g = 0; g < groupsNeeded; g++) {
      const owner = bulkUsers[(fgCount.c + g) * 3 % bulkUsers.length];
      fgRows.push([`演示家庭${fgCount.c + g + 1}`, `BLK${String(fgCount.c + g + 1).padStart(5, '0')}`, owner.id, 'preset:home', owner.tenant_id]);
    }
    for (const row of fgRows) {
      const [r] = await conn.query(
        `INSERT INTO family_groups (name, invite_code, created_by, avatar_url, tenant_id, created_at, updated_at) VALUES (?,?,?,?,?,NOW(),NOW())`,
        row,
      );
      groupIds.push(r.insertId);
    }
    console.log(`[+] family_groups × ${fgRows.length}`);
  }

  const [allGroups] = await conn.query(`SELECT id, created_by, tenant_id FROM family_groups WHERE invite_code LIKE 'BLK%'`);
  const [[fmCount]] = await conn.query(`SELECT COUNT(*) AS c FROM family_members fm JOIN family_groups fg ON fg.id=fm.family_group_id WHERE fg.invite_code LIKE 'BLK%'`);
  if (fmCount.c < allGroups.length * 2) {
    const fmRows = [];
    for (let gi = 0; gi < allGroups.length; gi++) {
      const g = allGroups[gi];
      const members = bulkUsers.slice(gi * 3, gi * 3 + 3);
      if (!members.length) continue;
      const guardian = members[0];
      fmRows.push([g.id, guardian.id, 'guardian', 'child', guardian.nickname, JSON.stringify({ viewHealth: true, receiveAlerts: true }), new Date(), null, 0, g.tenant_id]);
      for (const m of members) {
        const t = targetByUser.get(m.id);
        if (!t) continue;
        fmRows.push([g.id, null, 'member', 'parent', t.name, JSON.stringify({ viewHealth: true }), new Date(), t.id, 1, g.tenant_id]);
      }
    }
    await batchInsert(
      conn,
      'family_members',
      ['family_group_id', 'user_id', 'role', 'relation', 'nickname', 'permissions', 'joined_at', 'linked_service_target_id', 'is_elder', 'tenant_id', 'created_at', 'updated_at'],
      fmRows.map((r) => [...r, new Date(), new Date()]),
    );
    console.log(`[+] family_members × ${fmRows.length}`);
  }

  // ── 租户用户关联 ──
  const [[tuCount]] = await conn.query(`SELECT COUNT(*) AS c FROM tenant_users tu JOIN users u ON u.id=tu.user_id WHERE u.openid LIKE ?`, [`${OPENID_PREFIX}%`]);
  if (tuCount.c < bulkUsers.length * 0.5 && roles.length) {
    const tuRows = bulkUsers.slice(0, Math.min(bulkUsers.length, 200)).map((u, i) => [
      u.tenant_id,
      u.id,
      pick(roles, i).id ?? roles[0].id,
      i % 20 === 0 ? 1 : 0,
      'active',
      new Date(),
    ]);
    await batchInsert(
      conn,
      'tenant_users',
      ['tenant_id', 'user_id', 'role_id', 'is_owner', 'status', 'joined_at', 'created_at', 'updated_at'],
      tuRows.map((r) => [...r, new Date(), new Date()]),
    );
    console.log(`[+] tenant_users × ${tuRows.length}`);
  }

  // ── 会员 ──
  const [[umCount]] = await conn.query(
    `SELECT COUNT(*) AS c FROM user_memberships um JOIN users u ON u.id=um.user_id WHERE u.openid LIKE ?`,
    [`${OPENID_PREFIX}%`],
  );
  if (umCount.c < bulkUsers.length * 0.3) {
    const umRows = bulkUsers.filter((_, i) => i % 3 === 0).map((u) => {
      const start = daysAgo(30);
      const end = daysAgo(-335);
      return [u.id, levelId, cardTypeId, dateStr(start), dateStr(end), 500 + (u.id % 1000), 500, 1, u.tenant_id];
    });
    await batchInsert(
      conn,
      'user_memberships',
      ['user_id', 'level_id', 'card_type_id', 'start_date', 'expire_date', 'balance', 'total_recharged', 'status', 'tenant_id', 'created_at', 'updated_at'],
      umRows.map((r) => [...r, new Date(), new Date()]),
    );
    console.log(`[+] user_memberships × ${umRows.length}`);
  }

  // ── 订单 + 时间线 ──
  const [[orderBulkCount]] = await conn.query(`SELECT COUNT(*) AS c FROM orders WHERE order_number LIKE 'BULK%'`);
  const ordersNeeded = Math.max(0, Math.floor(bulkUsers.length * 1.2) - orderBulkCount.c);
  const newOrderIds = [];
  if (ordersNeeded > 0) {
    const orderRows = [];
    for (let o = 0; o < ordersNeeded; o++) {
      const u = bulkUsers[o % bulkUsers.length];
      const t = targetByUser.get(u.id);
      if (!t) continue;
      const idx = orderBulkCount.c + o + 1;
      const status = pick(ORDER_STATUSES, o);
      const att = attendantByUser.get(bulkUsers[(o + 5) % bulkUsers.length]?.id);
      orderRows.push([
        `BULK${String(idx).padStart(6, '0')}`,
        u.id,
        t.id,
        att?.id ?? null,
        status,
        pick(SERVICE_TYPES, o),
        daysAgo(o % 60),
        `${pick(CITIES, o)}市${pick(HOSPITALS, o)}`,
        pick(DEPTS, o),
        299 + (o % 5) * 100,
        299 + (o % 5) * 100,
        1,
        o % 3 === 0 ? 'paid' : 'unpaid',
        'pending',
        u.tenant_id,
        proServices[o % proServices.length]?.id ?? null,
      ]);
    }
    for (const row of orderRows) {
      const [r] = await conn.query(
        `INSERT INTO orders (order_number,user_id,service_target_id,attendant_id,status,service_type,service_time,hospital,department,base_fee,total_fee,need_attendant,payment_status,settlement_status,tenant_id,professional_service_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
        row,
      );
      newOrderIds.push(r.insertId);
    }
    console.log(`[+] orders × ${orderRows.length}`);

    const tlRows = newOrderIds.flatMap((oid, i) => {
      const types = ['node', 'text', 'service_start'];
      return types.map((type, ti) => [
        oid,
        null,
        type,
        type === 'text' ? `演示时间线节点 ${i}-${ti}` : null,
        null,
        bulkUsers[i % bulkUsers.length].tenant_id,
      ]);
    });
    await batchInsert(
      conn,
      'service_timelines',
      ['order_id', 'operator_id', 'type', 'content', 'metadata', 'tenant_id', 'created_at'],
      tlRows.map((r) => [...r, new Date()]),
    );
    console.log(`[+] service_timelines × ${tlRows.length}`);
  }

  const [completedOrders] = await conn.query(
    `SELECT id, user_id, attendant_id, tenant_id FROM orders WHERE order_number LIKE 'BULK%' AND status='completed' LIMIT 100`,
  );

  // ── 评价 ──
  const [[revCount]] = await conn.query(`SELECT COUNT(*) AS c FROM reviews r JOIN orders o ON o.id=r.order_id WHERE o.order_number LIKE 'BULK%'`);
  if (revCount.c < completedOrders.length * 0.8 && completedOrders.length) {
    const revRows = completedOrders.map((o, i) => [o.id, o.user_id, o.attendant_id, 4 + (i % 2), '服务专业，态度很好，演示评价。', o.tenant_id]);
    await batchInsert(conn, 'reviews', ['order_id', 'user_id', 'attendant_id', 'rating', 'comment', 'tenant_id', 'created_at'], revRows.map((r) => [...r, new Date()]));
    console.log(`[+] reviews × ${revRows.length}`);
  }

  // ── 排班 ──
  const [[schCount]] = await conn.query(`SELECT COUNT(*) AS c FROM schedules s JOIN attendants a ON a.id=s.attendant_id WHERE a.username LIKE 'demo_att_%'`);
  if (schCount.c < allAttendants.length * 5) {
    const schRows = [];
    for (const a of allAttendants) {
      for (let d = 0; d < 14; d++) {
        schRows.push([a.id, dateStr(daysAgo(d)), pick(['morning', 'afternoon', 'full_day'], d), d % 4 === 0 ? 'booked' : 'available', a.tenant_id]);
      }
    }
    await batchInsert(conn, 'schedules', ['attendant_id', 'date', 'period', 'status', 'tenant_id', 'created_at'], schRows.map((r) => [...r, new Date()]));
    console.log(`[+] schedules × ${schRows.length}`);
  }

  // ── 设备 ──
  const [[devCount]] = await conn.query(`SELECT COUNT(*) AS c FROM devices WHERE tuya_device_id LIKE 'bulk_dev_%'`);
  const devNeeded = Math.max(0, Math.floor(bulkUsers.length * 0.3) - devCount.c);
  const newDeviceIds = [];
  if (devNeeded > 0) {
    for (let d = 0; d < devNeeded; d++) {
      const u = bulkUsers[d % bulkUsers.length];
      const t = targetByUser.get(u.id);
      const type = d % 3 === 0 ? 'radar' : d % 3 === 1 ? 'wearable' : 'robot';
      const [r] = await conn.query(
        `INSERT INTO devices (tuya_device_id,product_id,type,status,name,firmware_version,online,last_online_at,last_heartbeat_at,battery_percent,metadata,tenant_id,created_at,updated_at)
         VALUES (?,?,?,?,?,?,1,NOW(),NOW(),?,?,?,NOW(),NOW())`,
        [`bulk_dev_${String(devCount.c + d + 1).padStart(5, '0')}`, 'hdmfmu2akvw4egia', type, 'active', `${t?.name ?? '老人'}的${type === 'robot' ? '陪伴机' : type === 'radar' ? '雷达' : '手环'}`, '1.2.0', 50 + (d % 50), JSON.stringify({ demo: true }), u.tenant_id],
      );
      newDeviceIds.push({ id: r.insertId, userId: u.id, targetId: t?.id, tenantId: u.tenant_id });
    }
    console.log(`[+] devices × ${devNeeded}`);

    const bindRows = newDeviceIds.map((d) => [d.id, d.userId, d.targetId, 'owner', d.tenantId]);
    await batchInsert(conn, 'device_bindings', ['device_id', 'user_id', 'service_target_id', 'role', 'tenant_id', 'bound_at', 'created_at', 'updated_at'], bindRows.map((r) => [...r, new Date(), new Date(), new Date()]));

    const evtRows = newDeviceIds.flatMap((d, i) => [
      [d.tenantId, d.id, 'online', 'info', JSON.stringify({ demo: true }), `bulk_evt_on_${d.id}`, new Date()],
      ...(i % 7 === 0 ? [[d.tenantId, d.id, 'fall', 'critical', JSON.stringify({ confidence: 0.88, demo: true }), `bulk_evt_fall_${d.id}`, new Date()]] : []),
    ]);
    await batchInsert(conn, 'device_event_logs', ['tenant_id', 'device_id', 'type', 'level', 'payload', 'dedup_key', 'received_at', 'forwarded_to_alert', 'forwarded_to_realtime', 'created_at', 'updated_at'], evtRows.map((r) => [...r, 0, 0, new Date(), new Date()]));
    console.log(`[+] device_bindings/events`);
  }

  // ── 用药提醒 ──
  const [[medCount]] = await conn.query(`SELECT COUNT(*) AS c FROM medication_reminders mr JOIN users u ON u.id=mr.user_id WHERE u.openid LIKE ?`, [`${OPENID_PREFIX}%`]);
  if (medCount.c < bulkUsers.length * 0.4) {
    const medRows = bulkUsers.filter((_, i) => i % 2 === 0).map((u, i) => {
      const t = targetByUser.get(u.id);
      return [u.id, t?.id ?? null, pick(MEDICINES, i), '1片', 'daily', '08:00,20:00', dateStr(daysAgo(10)), dateStr(daysAgo(-80)), 'active', 'all', 'medication', pick(['high', 'medium', 'low'], i), u.tenant_id];
    });
    await batchInsert(conn, 'medication_reminders', ['user_id', 'service_target_id', 'medicine_name', 'dosage', 'frequency', 'reminder_times', 'start_date', 'end_date', 'status', 'channel', 'reminder_type', 'severity', 'tenant_id', 'created_at', 'updated_at'], medRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] medication_reminders × ${medRows.length}`);
  }

  // ── 咨询 / 投诉 / 分诊 / AI问诊 ──
  const [[conCount]] = await conn.query(`SELECT COUNT(*) AS c FROM consultations c JOIN users u ON u.id=c.user_id WHERE u.openid LIKE ?`, [`${OPENID_PREFIX}%`]);
  if (conCount.c < bulkUsers.length * 0.3) {
    const conRows = bulkUsers.filter((_, i) => i % 3 === 0).map((u, i) => [u.id, 'online', u.nickname, u.phone, dateStr(daysAgo(i % 14)), '10:00', '想了解陪诊服务', pick(['pending', 'contacted', 'completed'], i), 'escort', u.tenant_id]);
    await batchInsert(conn, 'consultations', ['user_id', 'consult_type', 'name', 'phone', 'appointment_date', 'appointment_time', 'detail', 'status', 'service_interest', 'tenant_id', 'created_at', 'updated_at'], conRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] consultations × ${conRows.length}`);
  }

  const [[compCount]] = await conn.query(`SELECT COUNT(*) AS c FROM complaints c JOIN users u ON u.id=c.user_id WHERE u.openid LIKE ?`, [`${OPENID_PREFIX}%`]);
  if (compCount.c < 30) {
    const compRows = bulkUsers.slice(0, 35).map((u, i) => [u.id, null, null, pick(['service', 'attitude', 'fee'], i), '演示投诉主题', '演示投诉内容，仅供后台展示。', u.phone, pick(['low', 'medium', 'high'], i), pick(['open', 'processing', 'resolved'], i), u.tenant_id]);
    await batchInsert(conn, 'complaints', ['user_id', 'order_id', 'attendant_id', 'category', 'subject', 'description', 'contact_phone', 'priority', 'status', 'tenant_id', 'created_at', 'updated_at'], compRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] complaints × ${compRows.length}`);
  }

  const [[triCount]] = await conn.query(`SELECT COUNT(*) AS c FROM triage_sessions t JOIN users u ON u.id=t.user_id WHERE u.openid LIKE ?`, [`${OPENID_PREFIX}%`]);
  if (triCount.c < bulkUsers.length * 0.25) {
    const triRows = bulkUsers.filter((_, i) => i % 4 === 0).map((u, i) => {
      const t = targetByUser.get(u.id);
      return [u.id, t?.id ?? null, 'general', t?.name ? 70 : 65, '女', '头晕乏力三天', '3天', 'medium', JSON.stringify(['高血压']), pick(['low', 'medium', 'high'], i), 'escort', JSON.stringify({ demo: true }), '建议心内科就诊', '请先测量血压并休息', 'completed', u.tenant_id];
    });
    await batchInsert(conn, 'triage_sessions', ['user_id', 'patient_id', 'consultant_role', 'patient_age', 'patient_gender', 'main_symptom', 'symptom_duration', 'severity_self', 'medical_history', 'risk_level', 'visit_goal', 'final_json', 'structured_summary', 'safe_reply_text', 'status', 'tenant_id', 'created_at', 'updated_at'], triRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] triage_sessions × ${triRows.length}`);
  }

  const [[aiCount]] = await conn.query(`SELECT COUNT(*) AS c FROM ai_consultations a JOIN users u ON u.id=a.user_id WHERE u.openid LIKE ?`, [`${OPENID_PREFIX}%`]);
  if (aiCount.c < bulkUsers.length * 0.5) {
    const aiRows = bulkUsers.filter((_, i) => i % 2 === 1).flatMap((u, i) => {
      const t = targetByUser.get(u.id);
      const sid = `bulk_ai_${u.id}_${i}`;
      return [
        [u.id, sid, t?.id ?? null, 'user', '最近血压有点高，需要注意什么？', null, u.tenant_id],
        [u.id, sid, t?.id ?? null, 'assistant', '建议低盐饮食、规律服药，并每日监测血压。', JSON.stringify({ demo: true }), u.tenant_id],
      ];
    });
    await batchInsert(conn, 'ai_consultations', ['user_id', 'session_id', 'service_target_id', 'role', 'content', 'parsed_result', 'tenant_id', 'created_at', 'updated_at'], aiRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] ai_consultations × ${aiRows.length}`);
  }

  // ── 健康告警 / 周报 ──
  const [[haCount]] = await conn.query(`SELECT COUNT(*) AS c FROM health_alerts h JOIN users u ON u.id=h.user_id WHERE u.openid LIKE ?`, [`${OPENID_PREFIX}%`]);
  if (haCount.c < bulkUsers.length * 0.2) {
    const haRows = bulkUsers.filter((_, i) => i % 5 === 0).map((u, i) => {
      const t = targetByUser.get(u.id);
      return [u.id, t?.id ?? null, pick(['medication_miss', 'follow_up_overdue', 'manual'], i), `DEMO_RULE_${i}`, '演示规则', pick(['low', 'medium', 'high'], i), '演示健康预警', '批量种子生成的演示告警', JSON.stringify({ demo: true }), 'new', daysAgo(i % 10), `bulk_ha_${u.id}_${i}`, u.tenant_id];
    });
    await batchInsert(conn, 'health_alerts', ['user_id', 'service_target_id', 'category', 'rule_code', 'rule_name', 'severity', 'title', 'summary', 'payload', 'status', 'triggered_at', 'dedup_key', 'tenant_id', 'created_at', 'updated_at'], haRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] health_alerts × ${haRows.length}`);
  }

  const [[wrCount]] = await conn.query(`SELECT COUNT(*) AS c FROM health_weekly_reports h JOIN users u ON u.id=h.user_id WHERE u.openid LIKE ?`, [`${OPENID_PREFIX}%`]);
  if (wrCount.c < bulkUsers.length * 0.25) {
    const ws = dateStr(daysAgo(6));
    const we = dateStr(new Date());
    const wrRows = bulkUsers.filter((_, i) => i % 4 === 0).map((u, i) => {
      const t = targetByUser.get(u.id);
      return [u.id, t?.id ?? null, ws, we, JSON.stringify({ total: 14, taken: 12, missed: 2, adherenceRate: 0.86 }), '本周整体平稳，演示周报。', JSON.stringify({ demo: true }), u.tenant_id];
    });
    await batchInsert(conn, 'health_weekly_reports', ['user_id', 'service_target_id', 'week_start', 'week_end', 'medication_stats', 'health_summary', 'ai_analysis', 'tenant_id', 'created_at', 'updated_at'], wrRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] health_weekly_reports × ${wrRows.length}`);
  }

  // ── 医院医生 ──
  const [[docCount]] = await conn.query(`SELECT COUNT(*) AS c FROM hospital_doctors WHERE source='bulk_demo'`);
  if (docCount.c < 150 && hospitals.length) {
    const docRows = [];
    for (let i = 0; i < 180; i++) {
      const h = hospitals[i % hospitals.length];
      docRows.push([h.id, `${pick(SURNAMES, i)}医生`, pick(DEPTS, i), pick(['主任医师', '副主任医师', '主治医师'], i), '擅长老年慢病与康复管理', '演示医生简介', 100 - i, 1, 'bulk_demo']);
    }
    await batchInsert(conn, 'hospital_doctors', ['hospital_id', 'name', 'department', 'title_level', 'expertise', 'introduction', 'sort_weight', 'is_active', 'source', 'created_at', 'updated_at'], docRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] hospital_doctors × ${docRows.length}`);
  }

  // ── 社区内容 / 服务商 / 内容库 ──
  const [[ccCount]] = await conn.query(`SELECT COUNT(*) AS c FROM community_contents WHERE title LIKE '【演示】%'`);
  if (ccCount.c < 15) {
    const ccRows = Array.from({ length: 15 }, (_, i) => [pick(tenantIds, i), `【演示】健康科普${i + 1}`, `这是第 ${i + 1} 条社区广播演示内容。`, `各位长辈，请注意按时服药。`, pick(['health', 'activity', 'policy'], i), pick(['normal', 'high'], i), 'published', JSON.stringify({ all: true }), JSON.stringify({}), daysAgo(i), null]);
    await batchInsert(conn, 'community_contents', ['tenant_id', 'title', 'body', 'voice_script', 'category', 'priority', 'status', 'target', 'schedule', 'published_at', 'revoked_at', 'created_at', 'updated_at'], ccRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] community_contents × ${ccRows.length}`);
  }

  const [[spCount]] = await conn.query(`SELECT COUNT(*) AS c FROM service_providers WHERE name LIKE '演示服务商%'`);
  if (spCount.c < 8) {
    const spRows = Array.from({ length: 8 }, (_, i) => [pick(tenantIds, i), `演示服务商${i + 1}`, pick(['escort', 'nutrition', 'rehab'], i), 'active', JSON.stringify([pick(CITIES, i)]), JSON.stringify([{ name: '半日陪诊', price: 399 }]), JSON.stringify({ license: 'demo' }), JSON.stringify({ cycle: 'monthly' })]);
    await batchInsert(conn, 'service_providers', ['tenant_id', 'name', 'type', 'status', 'service_area', 'catalog', 'credentials', 'settlement', 'created_at', 'updated_at'], spRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] service_providers × ${spRows.length}`);
  }

  const [[ciCount]] = await conn.query(`SELECT COUNT(*) AS c FROM content_items WHERE title LIKE '演示音频%'`);
  if (ciCount.c < 20) {
    const ciRows = Array.from({ length: 20 }, (_, i) => [pick(tenantIds, i), pick(['music', 'story', 'health'], i), `演示音频${i + 1}`, '批量演示内容库条目', '03:30', null, null, 1, 100 - i]);
    await batchInsert(conn, 'content_items', ['tenant_id', 'category', 'title', 'description', 'duration', 'audio_url', 'cover_url', 'active', 'sort_weight', 'created_at', 'updated_at'], ciRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] content_items × ${ciRows.length}`);
  }

  // ── 家庭留言 / 任务 ──
  const [demoGroups] = await conn.query(`SELECT id, tenant_id FROM family_groups WHERE invite_code LIKE 'BLK%' LIMIT 50`);
  const [[msgCount]] = await conn.query(`SELECT COUNT(*) AS c FROM family_messages`);
  if (msgCount.c < 40 && demoGroups.length) {
    const msgRows = demoGroups.flatMap((g, i) => {
      const u = bulkUsers[i % bulkUsers.length];
      const t = targetByUser.get(u.id);
      return [[g.tenant_id, g.id, t?.id ?? null, u.id, `家人留言演示 ${i + 1}：记得测血压`, 'family', daysAgo(i)]];
    });
    await batchInsert(conn, 'family_messages', ['tenant_id', 'family_id', 'elder_id', 'created_by', 'message', 'broadcast_mode', 'broadcasted_at', 'created_at', 'updated_at'], msgRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] family_messages × ${msgRows.length}`);
  }

  const [[taskCount]] = await conn.query(`SELECT COUNT(*) AS c FROM family_tasks`);
  if (taskCount.c < 40 && demoGroups.length) {
    const taskRows = demoGroups.flatMap((g, i) => {
      const u = bulkUsers[i % bulkUsers.length];
      const t = targetByUser.get(u.id);
      return [[g.tenant_id, g.id, t?.id ?? null, u.id, `演示任务：提醒服药`, 'medication', '请按时服用降压药', 'once', daysAgo(-1), pick(['pending', 'sent', 'responded'], i)]];
    });
    await batchInsert(conn, 'family_tasks', ['tenant_id', 'family_id', 'elder_id', 'created_by', 'title', 'type', 'message', 'schedule_mode', 'remind_at', 'status', 'created_at', 'updated_at'], taskRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] family_tasks × ${taskRows.length}`);
  }

  // ── 单据 / 财务 ──
  const [bulkOrders] = await conn.query(`SELECT id, user_id, tenant_id FROM orders WHERE order_number LIKE 'BULK%' LIMIT 80`);
  const [[doc2Count]] = await conn.query(`SELECT COUNT(*) AS c FROM documents d JOIN orders o ON o.id=d.order_id WHERE o.order_number LIKE 'BULK%'`);
  if (doc2Count.c < bulkOrders.length * 0.5 && bulkOrders.length) {
    const docRows = bulkOrders.map((o, i) => [o.id, pick(['service_report', 'health_profile', 'dispatch_confirmation'], i), `/uploads/demo/report_${o.id}.pdf`, `演示报告_${o.id}.pdf`, o.user_id, o.tenant_id]);
    await batchInsert(conn, 'documents', ['order_id', 'type', 'url', 'file_name', 'user_id', 'tenant_id', 'created_at'], docRows.map((r) => [...r, new Date()]));
    console.log(`[+] documents × ${docRows.length}`);
  }

  const [[finCount]] = await conn.query(`SELECT COUNT(*) AS c FROM finance_records f JOIN orders o ON o.id=f.order_id WHERE o.order_number LIKE 'BULK%'`);
  if (finCount.c < 50 && bulkOrders.length) {
    const finRows = bulkOrders.slice(0, 60).map((o, i) => {
      const att = allAttendants[i % allAttendants.length];
      return [o.id, att?.id ?? null, pick(['transport', 'medical', 'other'], i), 20 + (i % 8) * 10, '演示报销', null, pick(['pending', 'approved'], i), o.tenant_id];
    });
    await batchInsert(conn, 'finance_records', ['order_id', 'attendant_id', 'type', 'amount', 'description', 'proof_url', 'status', 'tenant_id', 'created_at', 'updated_at'], finRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] finance_records × ${finRows.length}`);
  }

  // ── 订阅 ──
  const [[subCount]] = await conn.query(`SELECT COUNT(*) AS c FROM subscriptions s JOIN users u ON u.id=s.user_id WHERE u.openid LIKE ?`, [`${OPENID_PREFIX}%`]);
  if (subCount.c < 80 && plans.length) {
    const subRows = bulkUsers.filter((_, i) => i % 5 === 0).map((u, i) => [u.tenant_id, pick(plans, i).id, u.id, null, pick(['active', 'trialing', 'paused'], i), daysAgo(15), daysAgo(-15), daysAgo(-15), 1, null, null, 99]);
    await batchInsert(conn, 'subscriptions', ['tenant_id', 'plan_id', 'user_id', 'device_id', 'status', 'started_at', 'current_period_end', 'next_charge_at', 'auto_renew', 'canceled_at', 'cancel_reason', 'unit_price_snapshot', 'created_at', 'updated_at'], subRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] subscriptions × ${subRows.length}`);
  }

  // ── 处方 ──
  const [[rxCount]] = await conn.query(`SELECT COUNT(*) AS c FROM medication_prescriptions p JOIN users u ON u.id=p.user_id WHERE u.openid LIKE ?`, [`${OPENID_PREFIX}%`]);
  if (rxCount.c < 100) {
    const rxRows = bulkUsers.filter((_, i) => i % 4 === 0).map((u, i) => {
      const t = targetByUser.get(u.id);
      return [u.id, t?.id ?? null, null, null, pick(HOSPITALS, i), `${pick(SURNAMES, i)}医生`, pick(DEPTS, i), dateStr(daysAgo(20)), '演示处方备注'];
    });
    await batchInsert(conn, 'medication_prescriptions', ['user_id', 'service_target_id', 'order_id', 'source_image', 'hospital', 'doctor_name', 'department', 'issued_date', 'note', 'created_at', 'updated_at'], rxRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] medication_prescriptions × ${rxRows.length}`);
  }

  // ── AI 对话会话 / 用量 / 发票 / 声纹 / 记忆 ──
  const [demoDevices] = await conn.query(`SELECT id, tenant_id FROM devices WHERE tuya_device_id LIKE 'bulk_dev_%' LIMIT 60`);
  const [[adsCount]] = await conn.query(`SELECT COUNT(*) AS c FROM ai_dialog_sessions WHERE agent_id='bulk_demo'`);
  if (adsCount.c < 80 && demoDevices.length) {
    const adsRows = demoDevices.map((d, i) => {
      const u = bulkUsers[i % bulkUsers.length];
      const t = targetByUser.get(u.id);
      return [d.tenant_id, d.id, u.id, t?.id ?? null, 'bulk_demo', daysAgo(i % 5), i % 3 === 0 ? daysAgo(i % 5 - 1) : null, 5 + (i % 10), 200 + i * 3];
    });
    await batchInsert(conn, 'ai_dialog_sessions', ['tenant_id', 'device_id', 'user_id', 'service_target_id', 'agent_id', 'started_at', 'ended_at', 'total_turns', 'total_tokens', 'created_at', 'updated_at'], adsRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] ai_dialog_sessions × ${adsRows.length}`);
  }

  const [[invCount]] = await conn.query(`SELECT COUNT(*) AS c FROM invoices WHERE title LIKE '演示发票%'`);
  if (invCount.c < 60) {
    const invRows = bulkUsers.filter((_, i) => i % 7 === 0).map((u, i) => [u.tenant_id, u.id, 'personal', pick(['requested', 'issued', 'voided'], i), 99 + i * 10, `演示发票${i + 1}`, null, `demo@mail.com`, i % 3 === 0 ? `INV${10000 + i}` : null]);
    await batchInsert(conn, 'invoices', ['tenant_id', 'user_id', 'type', 'status', 'amount', 'title', 'tax_number', 'email_to', 'invoice_no', 'created_at', 'updated_at'], invRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] invoices × ${invRows.length}`);
  }

  const [subs] = await conn.query(`SELECT id, user_id, tenant_id FROM subscriptions LIMIT 80`);
  const [[urCount]] = await conn.query(`SELECT COUNT(*) AS c FROM usage_records ur JOIN subscriptions s ON s.id=ur.subscription_id JOIN users u ON u.id=s.user_id WHERE u.openid LIKE ?`, [`${OPENID_PREFIX}%`]);
  if (urCount.c < 100 && subs.length) {
    const urRows = subs.flatMap((s, i) => [
      [s.tenant_id, s.user_id, s.id, null, 'ai_token', 500 + i * 20, 0.01, daysAgo(i % 10), null],
      [s.tenant_id, s.user_id, s.id, null, 'ai_dialog_call', 10 + (i % 5), 0.5, daysAgo(i % 10), null],
    ]);
    await batchInsert(conn, 'usage_records', ['tenant_id', 'user_id', 'subscription_id', 'device_id', 'metric', 'quantity', 'unit_price', 'occurred_at', 'session_id', 'created_at', 'updated_at'], urRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] usage_records × ${urRows.length}`);
  }

  const [demoMembers] = await conn.query(
    `SELECT fm.id, fm.family_group_id AS family_id, fm.tenant_id FROM family_members fm JOIN family_groups fg ON fg.id=fm.family_group_id WHERE fg.invite_code LIKE 'BLK%' AND fm.is_elder=1 LIMIT 40`,
  );
  const [[vpCount]] = await conn.query(`SELECT COUNT(*) AS c FROM voiceprint_profiles vp JOIN family_groups fg ON fg.id=vp.family_id WHERE fg.invite_code LIKE 'BLK%'`);
  if (vpCount.c < 40 && demoMembers.length) {
    const vpRows = demoMembers.map((m, i) => [m.tenant_id, m.family_id, m.id, 'active', 0.85 + (i % 10) * 0.01, daysAgo(i), null, 0]);
    await batchInsert(conn, 'voiceprint_profiles', ['tenant_id', 'family_id', 'member_id', 'status', 'confidence', 'enrolled_at', 'revoked_at', 'misrecognition_count', 'created_at', 'updated_at'], vpRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] voiceprint_profiles × ${vpRows.length}`);
  }

  const [[cmCount]] = await conn.query(`SELECT COUNT(*) AS c FROM companion_memories WHERE source='bulk_demo'`);
  if (cmCount.c < 60 && demoMembers.length) {
    const cmRows = demoMembers.slice(0, 60).map((m, i) => [m.tenant_id, m.family_id, m.id, 'family_shared', `pref_${i}`, `老人喜欢听京剧，每日下午三点提醒。`, 'bulk_demo', 'active', daysAgo(i)]);
    await batchInsert(conn, 'companion_memories', ['tenant_id', 'family_id', 'member_id', 'scope', 'memory_key', 'content', 'source', 'status', 'confirmed_at', 'created_at', 'updated_at'], cmRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] companion_memories × ${cmRows.length}`);
  }

  const [[melCount]] = await conn.query(`SELECT COUNT(*) AS c FROM medication_execution_logs WHERE note LIKE 'bulk_demo%'`);
  if (melCount.c < 150) {
    const [rems] = await conn.query(`SELECT mr.id, mr.user_id, mr.service_target_id, mr.tenant_id FROM medication_reminders mr JOIN users u ON u.id=mr.user_id WHERE u.openid LIKE ? LIMIT 80`, [`${OPENID_PREFIX}%`]);
    const melRows = rems.flatMap((r, i) => [
      [r.id, r.service_target_id, dateStr(daysAgo(i % 7)), '08:00', 'taken', daysAgo(i % 7), null, 'bulk_demo', r.tenant_id],
      ...(i % 3 === 0 ? [[r.id, r.service_target_id, dateStr(daysAgo(i % 5)), '20:00', 'missed', daysAgo(i % 5), null, 'bulk_demo', r.tenant_id]] : []),
    ]);
    await batchInsert(conn, 'medication_execution_logs', ['reminder_id', 'service_target_id', 'scheduled_date', 'scheduled_time', 'status', 'executed_at', 'executed_by', 'note', 'tenant_id', 'created_at', 'updated_at'], melRows.map((r) => [...r, new Date(), new Date()]));
    console.log(`[+] medication_execution_logs × ${melRows.length}`);
  }

  // ── 统计快照 ──
  await conn.query(
    `INSERT INTO stat_daily (tenant_id, stat_date, order_count, user_count, device_count, alert_count, created_at, updated_at)
     VALUES (1, CURDATE(), (SELECT COUNT(*) FROM orders), (SELECT COUNT(*) FROM users), (SELECT COUNT(*) FROM devices), (SELECT COUNT(*) FROM health_alerts), NOW(), NOW())
     ON DUPLICATE KEY UPDATE order_count=VALUES(order_count), user_count=VALUES(user_count), device_count=VALUES(device_count), alert_count=VALUES(alert_count), updated_at=NOW()`,
  ).catch(() => {});
  await conn.query(
    `UPDATE stat_realtime SET payload=JSON_OBJECT('users',(SELECT COUNT(*) FROM users),'orders',(SELECT COUNT(*) FROM orders),'devices',(SELECT COUNT(*) FROM devices)), updated_at=NOW() WHERE id=1`,
  ).catch(() => {});
  console.log('[+] stat 快照已更新');

  // ── 汇总 ──
  const summary = {};
  for (const t of ['users', 'service_targets', 'attendants', 'family_groups', 'family_members', 'orders', 'devices', 'medication_reminders', 'consultations', 'complaints', 'reviews', 'triage_sessions', 'ai_consultations', 'health_alerts', 'health_weekly_reports', 'hospital_doctors', 'community_contents', 'subscriptions']) {
    const [[r]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${t}\``);
    summary[t] = r.c;
  }
  const [[demoUserCount]] = await conn.query(`SELECT COUNT(*) AS c FROM users WHERE openid LIKE ?`, [`${OPENID_PREFIX}%`]);

  console.log('\n=== 完成 ===');
  console.log(`demo_bulk 用户: ${demoUserCount.c} / 目标 ${TARGET_USERS}`);
  console.log('全库总量:');
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: ${v}`);
  console.log('\n护工登录: demo_att_XXXX / 123456');
  console.log('管理后台: http://localhost:5173 (admin)');

  await conn.end();
}

main().catch((e) => {
  console.error('批量种子失败:', e.message);
  if (e.sql) console.error('SQL:', e.sql.slice(0, 200));
  process.exit(1);
});

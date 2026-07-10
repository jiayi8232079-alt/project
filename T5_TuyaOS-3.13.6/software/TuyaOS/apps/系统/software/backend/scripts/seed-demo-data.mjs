#!/usr/bin/env node
/**
 * 本地演示数据种子 —— 可重复执行，已存在则跳过。
 *
 * 用法:
 *   node scripts/seed-demo-data.mjs
 *
 * 前置: MySQL 已启动，.env 数据库配置正确；建议先开启 AUTO_BOOTSTRAP_DEFAULT_DATA 导入医院名录。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

function now() {
  return new Date();
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function weekRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

async function findOne(conn, sql, params) {
  const [rows] = await conn.query(sql, params);
  return rows[0] ?? null;
}

async function main() {
  const env = loadEnv();
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  });

  const TENANT_ID = 1;
  const DEMO_USER_ID = 22; // 演示用户
  const DEMO_USER_NAME = '演示用户';

  console.log('=== 陪了个伴 · 演示数据种子 ===\n');

  // ── 1. 演示老人档案 ──
  console.log('[1/6] 服务对象（老人档案）');
  let elderTargetId = (
    await findOne(conn, 'SELECT id FROM service_targets WHERE name=? AND tenant_id=? LIMIT 1', [
      '王奶奶',
      TENANT_ID,
    ])
  )?.id;

  if (!elderTargetId) {
    const [r] = await conn.query(
      `INSERT INTO service_targets
        (user_id, name, gender, age, phone, emergency_contact, emergency_phone, home_address,
         health_profile, main_appeal, is_trust, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        DEMO_USER_ID,
        '王奶奶',
        '女',
        78,
        '13800138001',
        '演示用户',
        '13700137022',
        '浙江省丽水市莲都区中山街168号阳光小区3幢502',
        JSON.stringify({
          chronicDiseases: ['高血压', '2型糖尿病'],
          allergies: ['青霉素'],
          mobility: '需辅助行走',
        }),
        '定期复查、日常陪诊',
        true,
        TENANT_ID,
      ],
    );
    elderTargetId = r.insertId;
    console.log(`  + 王奶奶 (id=${elderTargetId})`);
  } else {
    console.log(`  · 王奶奶 (id=${elderTargetId})`);
  }

  let elderTarget2Id = (
    await findOne(conn, 'SELECT id FROM service_targets WHERE name=? AND tenant_id=? LIMIT 1', [
      '张大爷',
      TENANT_ID,
    ])
  )?.id;

  if (!elderTarget2Id) {
    const [r] = await conn.query(
      `INSERT INTO service_targets
        (user_id, name, gender, age, home_address, health_profile, main_appeal, is_trust, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        DEMO_USER_ID,
        '张大爷',
        '男',
        72,
        '浙江省丽水市莲都区括苍路88号',
        JSON.stringify({ chronicDiseases: ['冠心病'], mobility: '可自理' }),
        '术后康复陪护',
        true,
        TENANT_ID,
      ],
    );
    elderTarget2Id = r.insertId;
    console.log(`  + 张大爷 (id=${elderTarget2Id})`);
  } else {
    console.log(`  · 张大爷 (id=${elderTarget2Id})`);
  }

  // ── 2. 家庭组 ──
  console.log('\n[2/6] 家庭组与成员');
  let familyGroupId = (
    await findOne(conn, 'SELECT id FROM family_groups WHERE name=? LIMIT 1', ['演示家庭'])
  )?.id;

  if (!familyGroupId) {
    const [r] = await conn.query(
      `INSERT INTO family_groups (name, invite_code, created_by, avatar_url, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      ['演示家庭', 'DEMO2026', DEMO_USER_ID, 'preset:home', TENANT_ID],
    );
    familyGroupId = r.insertId;
    console.log(`  + 家庭组「演示家庭」(id=${familyGroupId})`);
  } else {
    console.log(`  · 家庭组「演示家庭」(id=${familyGroupId})`);
  }

  const memberSpecs = [
    {
      key: 'guardian',
      userId: DEMO_USER_ID,
      role: 'guardian',
      relation: 'child',
      nickname: DEMO_USER_NAME,
      isElder: false,
      linkedTarget: null,
    },
    {
      key: 'elder_wang',
      userId: null,
      role: 'member',
      relation: 'mother',
      nickname: '王奶奶',
      isElder: true,
      linkedTarget: elderTargetId,
    },
    {
      key: 'elder_zhang',
      userId: null,
      role: 'member',
      relation: 'father',
      nickname: '张大爷',
      isElder: true,
      linkedTarget: elderTarget2Id,
    },
  ];

  for (const m of memberSpecs) {
    const exists = await findOne(
      conn,
      `SELECT id FROM family_members WHERE family_group_id=? AND nickname=? LIMIT 1`,
      [familyGroupId, m.nickname],
    );
    if (exists) {
      console.log(`  · 成员 ${m.nickname}`);
      continue;
    }
    await conn.query(
      `INSERT INTO family_members
        (family_group_id, user_id, role, relation, nickname, permissions, joined_at,
         linked_service_target_id, is_elder, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        familyGroupId,
        m.userId,
        m.role,
        m.relation,
        m.nickname,
        JSON.stringify({
          viewHealth: true,
          viewMedication: true,
          manageOrders: m.role === 'guardian',
          receiveAlerts: true,
        }),
        now(),
        m.linkedTarget,
        m.isElder ? 1 : 0,
        TENANT_ID,
      ],
    );
    console.log(`  + 成员 ${m.nickname} (${m.role})`);
  }

  // ── 3. 设备 ──
  console.log('\n[3/6] 智能设备与绑定');
  const deviceSpecs = [
    {
      tuyaId: 'demo_robot_001',
      type: 'robot',
      name: '王奶奶的陪伴机',
      productId: 'hdmfmu2akvw4egia',
      battery: 86,
      targetId: elderTargetId,
    },
    {
      tuyaId: 'demo_radar_001',
      type: 'radar',
      name: '客厅跌倒雷达',
      productId: 'radar_demo_pid',
      battery: null,
      targetId: elderTargetId,
    },
  ];

  const deviceIds = {};
  for (const d of deviceSpecs) {
    let row = await findOne(conn, 'SELECT id FROM devices WHERE tuya_device_id=? LIMIT 1', [
      d.tuyaId,
    ]);
    if (!row) {
      const [r] = await conn.query(
        `INSERT INTO devices
          (tuya_device_id, product_id, type, status, name, firmware_version, online,
           last_online_at, last_heartbeat_at, battery_percent, metadata, tenant_id, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, '1.2.0', 1, NOW(), NOW(), ?, ?, ?, NOW(), NOW())`,
        [
          d.tuyaId,
          d.productId,
          d.type,
          d.name,
          d.battery,
          JSON.stringify({ demo: true, location: d.type === 'radar' ? '客厅' : '卧室' }),
          TENANT_ID,
        ],
      );
      deviceIds[d.tuyaId] = r.insertId;
      console.log(`  + 设备 ${d.name} (id=${r.insertId})`);
    } else {
      deviceIds[d.tuyaId] = row.id;
      console.log(`  · 设备 ${d.name} (id=${row.id})`);
    }

    const bindExists = await findOne(
      conn,
      'SELECT id FROM device_bindings WHERE device_id=? AND user_id=? LIMIT 1',
      [deviceIds[d.tuyaId], DEMO_USER_ID],
    );
    if (!bindExists) {
      await conn.query(
        `INSERT INTO device_bindings
          (device_id, user_id, service_target_id, family_group_id, role, bound_at, tenant_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'owner', NOW(), ?, NOW(), NOW())`,
        [deviceIds[d.tuyaId], DEMO_USER_ID, d.targetId, familyGroupId, TENANT_ID],
      );
      console.log(`  + 绑定 ${d.name} → ${DEMO_USER_NAME}`);
    }
  }

  // ── 4. 设备事件 ──
  console.log('\n[4/6] 设备事件流水');
  const robotId = deviceIds['demo_robot_001'];
  const radarId = deviceIds['demo_radar_001'];
  const eventSpecs = [
    { deviceId: robotId, type: 'online', level: 'info', dedup: 'demo_evt_robot_online' },
    {
      deviceId: robotId,
      type: 'ai_dialog',
      level: 'info',
      dedup: 'demo_evt_robot_dialog',
      payload: { text: '奶奶，该吃药啦', response: '好的，我知道了' },
    },
    {
      deviceId: radarId,
      type: 'online',
      level: 'info',
      dedup: 'demo_evt_radar_online',
    },
    {
      deviceId: radarId,
      type: 'fall',
      level: 'critical',
      dedup: 'demo_evt_radar_fall',
      payload: { confidence: 0.91, zone: '客厅', demo: true },
    },
  ];

  for (const e of eventSpecs) {
    const exists = await findOne(conn, 'SELECT id FROM device_event_logs WHERE dedup_key=? LIMIT 1', [
      e.dedup,
    ]);
    if (exists) {
      console.log(`  · 事件 ${e.type} (${e.dedup})`);
      continue;
    }
    await conn.query(
      `INSERT INTO device_event_logs
        (tenant_id, device_id, type, level, payload, received_at, dedup_key,
         forwarded_to_alert, forwarded_to_realtime, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), ?, 0, 0, NOW(), NOW())`,
      [TENANT_ID, e.deviceId, e.type, e.level, e.payload ? JSON.stringify(e.payload) : null, e.dedup],
    );
    console.log(`  + 事件 ${e.type}`);
  }

  // ── 5. 健康周报 ──
  console.log('\n[5/6] 健康周报');
  const { start: weekStart, end: weekEnd } = weekRange();
  const reportExists = await findOne(
    conn,
    'SELECT id FROM health_weekly_reports WHERE user_id=? AND service_target_id=? AND week_start=? LIMIT 1',
    [DEMO_USER_ID, elderTargetId, weekStart],
  );
  if (!reportExists) {
    await conn.query(
      `INSERT INTO health_weekly_reports
        (user_id, service_target_id, week_start, week_end, medication_stats, health_summary, ai_analysis, raw_data, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        DEMO_USER_ID,
        elderTargetId,
        weekStart,
        weekEnd,
        JSON.stringify({ total: 21, taken: 19, missed: 2, adherenceRate: 0.9 }),
        '本周血压整体平稳，周二略偏高；按时服药率 90%，建议加强晚间监测。',
        JSON.stringify({
          riskLevel: 'low',
          suggestions: ['继续保持低盐饮食', '每日散步 30 分钟', '关注晚间血压'],
        }),
        JSON.stringify({ demo: true }),
        TENANT_ID,
      ],
    );
    console.log(`  + 健康周报 ${weekStart} ~ ${weekEnd}`);
  } else {
    console.log(`  · 健康周报 ${weekStart} ~ ${weekEnd}`);
  }

  // ── 6. 演示订单 ──
  console.log('\n[6/6] 演示订单');
  const orderSpecs = [
    {
      no: 'DEMO20260627001',
      status: 'in_progress',
      type: '陪诊服务',
      daysFromNow: 0,
      hospital: '丽水市中心医院',
      dept: '心内科',
      fee: 699,
    },
    {
      no: 'DEMO20260627002',
      status: 'pending_dispatch',
      type: '体检陪同',
      daysFromNow: 3,
      hospital: '丽水市人民医院',
      dept: '体检中心',
      fee: 499,
    },
    {
      no: 'DEMO20260627003',
      status: 'completed',
      type: '半日陪诊',
      daysFromNow: -7,
      hospital: '莲都区中医院',
      dept: '老年病科',
      fee: 399,
    },
  ];

  for (const o of orderSpecs) {
    const exists = await findOne(conn, 'SELECT id FROM orders WHERE order_number=? LIMIT 1', [o.no]);
    if (exists) {
      console.log(`  · 订单 ${o.no}`);
      continue;
    }
    const svcTime = daysAgo(-o.daysFromNow);
    await conn.query(
      `INSERT INTO orders
        (order_number, user_id, service_target_id, status, service_type, service_time,
         service_address, hospital, department, base_fee, total_fee, need_attendant,
         payment_status, settlement_status, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'paid', 'pending', ?, NOW(), NOW())`,
      [
        o.no,
        DEMO_USER_ID,
        elderTargetId,
        o.status,
        o.type,
        svcTime,
        '浙江省丽水市莲都区',
        o.hospital,
        o.dept,
        o.fee,
        o.fee,
        TENANT_ID,
      ],
    );
    console.log(`  + 订单 ${o.no} (${o.status})`);
  }

  // ── 汇总 ──
  const [[hospitals]] = await conn.query('SELECT COUNT(*) AS c FROM hospitals');
  console.log('\n=== 完成 ===');
  console.log(`医院名录: ${hospitals.c} 条（若为 0，请设 AUTO_BOOTSTRAP_DEFAULT_DATA=true 并重启后端）`);
  console.log('管理后台: http://localhost:5173  账号 admin');
  console.log(`演示用户: ${DEMO_USER_NAME} (user_id=${DEMO_USER_ID})`);
  console.log(`老人档案: 王奶奶(id=${elderTargetId})、张大爷(id=${elderTarget2Id})`);
  console.log('设备: 陪伴机 + 跌倒雷达（含模拟跌倒事件）');

  await conn.end();
}

main().catch((err) => {
  console.error('种子失败:', err.message);
  process.exit(1);
});

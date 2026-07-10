#!/usr/bin/env node
/**
 * 医院医生抓取脚本
 *
 * 用法：
 *   node scripts/scrape-hospital-doctors.mjs --hospitalId 28
 *   node scripts/scrape-hospital-doctors.mjs --hospitalId 28 --dryRun
 *
 * 环境变量：
 *   FIRECRAWL_API_KEY  — Firecrawl API Key
 *   API_BASE           — 后端地址（默认 http://localhost:3000）
 *   ADMIN_TOKEN        — 管理员 JWT token（或通过 --token 传入）
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
const PLACEHOLDER_URLS = new Set([
  'https://www.zy91.com/public/cn/images/t5-img3.jpg',
  'https://www.zy91.com/upload/202102/JaIrhYxNlmqyPpjg3LdmC2MwBMf5NPCNk4bQUdVT.jpg',
]);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--hospitalId') opts.hospitalId = Number(args[++i]);
    if (args[i] === '--token') opts.token = args[++i];
    if (args[i] === '--dryRun') opts.dryRun = true;
    if (args[i] === '--firecrawlKey') opts.firecrawlKey = args[++i];
  }
  opts.token = opts.token || process.env.ADMIN_TOKEN;
  opts.firecrawlKey = opts.firecrawlKey || FIRECRAWL_KEY;
  return opts;
}

async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data?.data ?? data;
}

async function apiPatch(path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiPost(path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function firecrawlScrape(url, jsonOptions, apiKey) {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['json'],
      jsonOptions,
      waitFor: 5000,
    }),
  });
  const data = await res.json();
  return data?.data?.json ?? data?.json ?? null;
}

async function firecrawlMap(url, search, apiKey) {
  const res = await fetch('https://api.firecrawl.dev/v1/map', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, search }),
  });
  const data = await res.json();
  return data?.data?.links ?? data?.links ?? [];
}

async function firecrawlSearch(query, apiKey) {
  const res = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, limit: 5 }),
  });
  const data = await res.json();
  return data?.data ?? [];
}

function isValidAvatarUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (PLACEHOLDER_URLS.has(url)) return false;
  if (url.includes('department/doctor')) return false;
  if (!url.startsWith('http')) return false;
  return true;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const opts = parseArgs();

  if (!opts.hospitalId) {
    console.error('用法: node scripts/scrape-hospital-doctors.mjs --hospitalId <id> [--token <jwt>] [--firecrawlKey <key>] [--dryRun]');
    process.exit(1);
  }
  if (!opts.token) {
    console.error('请提供管理员 token：--token <jwt> 或设置 ADMIN_TOKEN 环境变量');
    process.exit(1);
  }
  if (!opts.firecrawlKey) {
    console.error('请提供 Firecrawl API Key：--firecrawlKey <key> 或设置 FIRECRAWL_API_KEY 环境变量');
    process.exit(1);
  }

  console.log(`\n🏥 正在获取医院信息 (id=${opts.hospitalId})...`);
  const hospital = await apiGet(`/hospitals/lookup/${opts.hospitalId}`, opts.token);
  if (!hospital?.name) {
    console.error('未找到该医院');
    process.exit(1);
  }
  console.log(`  医院: ${hospital.name}`);
  console.log(`  城市: ${hospital.city || '未知'}`);

  let websiteUrl = hospital.websiteUrl || hospital.website_url;

  if (!websiteUrl) {
    console.log('\n🔍 医院没有官网 URL，正在搜索...');
    const results = await firecrawlSearch(`${hospital.name} 专家介绍 官网`, opts.firecrawlKey);
    if (results.length > 0) {
      const first = results[0];
      const url = first.url || first.metadata?.sourceURL;
      if (url) {
        const base = new URL(url);
        websiteUrl = `${base.protocol}//${base.hostname}`;
        console.log(`  找到官网: ${websiteUrl}`);
      }
    }
    if (!websiteUrl) {
      console.error('  无法找到医院官网，请手动提供 websiteUrl 后重试');
      process.exit(1);
    }
  }

  console.log(`\n🗺️  正在搜索专家/医生页面...`);
  const links = await firecrawlMap(websiteUrl, '专家 医生 团队', opts.firecrawlKey);
  const doctorLinks = links.filter(
    (l) =>
      typeof l === 'object'
        ? (l.url || '').includes('doctor') || (l.title || '').includes('专家') || (l.title || '').includes('医生')
        : typeof l === 'string' && (l.includes('doctor') || l.includes('expert')),
  );
  console.log(`  找到 ${links.length} 个页面，其中 ${doctorLinks.length} 个疑似医生页面`);

  let deptPageUrl = '';
  for (const link of links) {
    const url = typeof link === 'object' ? link.url : link;
    if (url && (url.includes('department') || url.includes('dept') || url.includes('keshi'))) {
      if (url.includes('doctor_index') || url.includes('expert') || url.includes('zjjs')) {
        deptPageUrl = url;
        break;
      }
    }
  }
  if (!deptPageUrl) {
    for (const link of links) {
      const url = typeof link === 'object' ? link.url : link;
      const title = typeof link === 'object' ? (link.title || '') : '';
      if (title.includes('专家') || title.includes('医生') || (url && url.includes('doctor'))) {
        deptPageUrl = url;
        break;
      }
    }
  }

  if (!deptPageUrl) {
    console.log('  未找到专家介绍入口页，尝试直接用首页...');
    deptPageUrl = websiteUrl;
  } else {
    console.log(`  专家页面入口: ${deptPageUrl}`);
  }

  console.log(`\n📋 正在抓取科室列表...`);
  const deptData = await firecrawlScrape(deptPageUrl, {
    prompt: '提取所有临床科室的名称和页面链接',
    schema: {
      type: 'object',
      properties: {
        departments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              url: { type: 'string' },
            },
          },
        },
      },
    },
  }, opts.firecrawlKey);

  const departments = deptData?.departments || [];
  console.log(`  找到 ${departments.length} 个科室`);

  const allDoctors = [];

  for (const dept of departments.slice(0, 30)) {
    if (!dept.url) continue;
    console.log(`\n  📌 抓取科室: ${dept.name}...`);
    await sleep(1500);

    try {
      const deptResult = await firecrawlScrape(dept.url, {
        prompt: '提取科室页面中列出的所有医生，包括姓名、职称、详情页URL',
        schema: {
          type: 'object',
          properties: {
            departmentName: { type: 'string' },
            doctors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  titleLevel: { type: 'string' },
                  detailUrl: { type: 'string' },
                },
              },
            },
          },
        },
      }, opts.firecrawlKey);

      const doctors = deptResult?.doctors || [];
      for (const d of doctors) {
        if (!d.name) continue;
        allDoctors.push({
          name: d.name,
          department: dept.name || deptResult?.departmentName || '',
          titleLevel: d.titleLevel || '',
          detailUrl: d.detailUrl || '',
        });
      }
      console.log(`    → ${doctors.length} 位医生`);
    } catch (e) {
      console.warn(`    ⚠️ 抓取失败: ${e.message}`);
    }
  }

  console.log(`\n✅ 共获取 ${allDoctors.length} 位医生`);

  if (allDoctors.length === 0) {
    console.log('没有抓取到医生数据，退出');
    process.exit(0);
  }

  if (opts.dryRun) {
    console.log('\n[DRY RUN] 以下医生将被导入:');
    for (const d of allDoctors) {
      console.log(`  - ${d.name} | ${d.department} | ${d.titleLevel}`);
    }
    process.exit(0);
  }

  console.log(`\n💾 正在批量导入到医院 (id=${opts.hospitalId})...`);
  const batchResult = await apiPost('/hospitals/admin/doctors/batch', {
    hospitalId: opts.hospitalId,
    replace: false,
    items: allDoctors.map((d) => ({
      name: d.name,
      department: d.department,
      titleLevel: d.titleLevel,
    })),
  }, opts.token);

  console.log(`  结果: ${JSON.stringify(batchResult?.data || batchResult)}`);

  const doctorsWithDetailUrl = allDoctors.filter((d) => d.detailUrl);
  if (doctorsWithDetailUrl.length > 0) {
    console.log(`\n🖼️  正在抓取 ${doctorsWithDetailUrl.length} 位医生的头像...`);

    const existingDoctors = await apiGet(
      `/hospitals/admin/all-doctors?hospitalId=${opts.hospitalId}&pageSize=500`,
      opts.token,
    );
    const doctorMap = new Map();
    for (const d of existingDoctors?.items || []) {
      doctorMap.set(d.name, d);
    }

    let avatarCount = 0;
    for (const d of doctorsWithDetailUrl) {
      const existing = doctorMap.get(d.name);
      if (!existing || existing.avatarUrl) continue;

      await sleep(2000);
      try {
        const detail = await firecrawlScrape(d.detailUrl, {
          prompt: '提取医生姓名和头像照片URL',
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              avatarUrl: { type: 'string' },
            },
          },
        }, opts.firecrawlKey);

        if (detail?.avatarUrl && isValidAvatarUrl(detail.avatarUrl)) {
          await apiPatch(`/hospitals/admin/doctors/${existing.id}`, {
            avatarUrl: detail.avatarUrl,
          }, opts.token);
          avatarCount++;
          console.log(`    ✅ ${d.name}: ${detail.avatarUrl}`);
        } else {
          console.log(`    ⏭️  ${d.name}: 无有效头像`);
        }
      } catch (e) {
        console.warn(`    ⚠️ ${d.name}: ${e.message}`);
      }
    }
    console.log(`\n  共更新 ${avatarCount} 个头像`);
  }

  console.log('\n🎉 完成！');
}

main().catch((e) => {
  console.error('脚本执行失败:', e);
  process.exit(1);
});

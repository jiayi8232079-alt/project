#!/usr/bin/env node
/**
 * 批量抓取医生头像脚本
 *
 * 用法：
 *   node scripts/batch-avatar-scrape.mjs --hospitalId 63 --token <jwt> --firecrawlKey <key>
 *   node scripts/batch-avatar-scrape.mjs --hospitalId 63 --token <jwt> --firecrawlKey <key> --batchSize 10 --dryRun
 *
 * 原理：
 *   1. 从后端 API 获取该医院所有尚无头像的医生
 *   2. 从本地 detail URL 映射文件读取医生详情页 URL
 *   3. 使用 Firecrawl Extract API 批量提取头像 URL
 *   4. 通过 PATCH API 更新每位医生的 avatarUrl
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { batchSize: 10, dryRun: false, startFrom: 0 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--hospitalId') opts.hospitalId = Number(args[++i]);
    if (args[i] === '--token') opts.token = args[++i];
    if (args[i] === '--firecrawlKey') opts.firecrawlKey = args[++i];
    if (args[i] === '--batchSize') opts.batchSize = Number(args[++i]);
    if (args[i] === '--dryRun') opts.dryRun = true;
    if (args[i] === '--startFrom') opts.startFrom = Number(args[++i]);
    if (args[i] === '--detailFile') opts.detailFile = args[++i];
  }
  opts.token = opts.token || process.env.ADMIN_TOKEN;
  opts.firecrawlKey = opts.firecrawlKey || process.env.FIRECRAWL_API_KEY;
  return opts;
}

async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await res.json())?.data ?? null;
}

async function apiPatch(path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function firecrawlExtract(urls, prompt, schema, apiKey) {
  const res = await fetch('https://api.firecrawl.dev/v1/extract', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, prompt, schema }),
  });
  const data = await res.json();
  if (!data.success && data.error) throw new Error(data.error);
  return data?.data ?? null;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const opts = parseArgs();
  if (!opts.hospitalId || !opts.token || !opts.firecrawlKey) {
    console.error('用法: node scripts/batch-avatar-scrape.mjs --hospitalId <id> --token <jwt> --firecrawlKey <key> [--batchSize 10] [--detailFile <path>] [--startFrom 0] [--dryRun]');
    process.exit(1);
  }

  const { readFileSync } = await import('fs');

  const detailFile = opts.detailFile || `/tmp/z2hospital_detail_urls.json`;
  let detailDocs;
  try {
    detailDocs = JSON.parse(readFileSync(detailFile, 'utf-8'));
  } catch {
    console.error(`无法读取详情URL文件: ${detailFile}`);
    process.exit(1);
  }

  const detailMap = new Map();
  for (const d of detailDocs) {
    detailMap.set(d.name, d.detailUrl);
  }

  console.log(`\n🏥 加载医生列表 (hospitalId=${opts.hospitalId})...`);
  const allDoctors = [];
  let page = 1;
  while (true) {
    const data = await apiGet(
      `/hospitals/admin/all-doctors?hospitalId=${opts.hospitalId}&pageSize=100&page=${page}`,
      opts.token,
    );
    if (!data?.items?.length) break;
    allDoctors.push(...data.items);
    page++;
  }

  const needAvatar = allDoctors.filter((d) => !d.avatarUrl && detailMap.has(d.name));
  console.log(`  总医生: ${allDoctors.length}, 需要头像: ${needAvatar.length}`);

  const toProcess = needAvatar.slice(opts.startFrom);
  console.log(`  从第 ${opts.startFrom} 位开始处理，共 ${toProcess.length} 位\n`);

  let updated = 0;
  for (let i = 0; i < toProcess.length; i += opts.batchSize) {
    const batch = toProcess.slice(i, i + opts.batchSize);
    const urls = batch.map((d) => detailMap.get(d.name));
    const batchNum = Math.floor(i / opts.batchSize) + 1;
    const totalBatches = Math.ceil(toProcess.length / opts.batchSize);

    console.log(`📦 批次 ${batchNum}/${totalBatches} (${batch.length} 位医生)...`);

    try {
      const result = await firecrawlExtract(
        urls,
        '提取每个页面中医生的姓名和头像照片URL（img src）',
        {
          type: 'object',
          properties: {
            doctors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  avatarUrl: { type: 'string' },
                  pageUrl: { type: 'string' },
                },
              },
            },
          },
        },
        opts.firecrawlKey,
      );

      const extracted = result?.doctors || [];
      const avatarByName = new Map();
      for (const e of extracted) {
        if (e.name && e.avatarUrl && e.avatarUrl.startsWith('http')) {
          avatarByName.set(e.name, e.avatarUrl);
        }
      }

      for (const doc of batch) {
        const avatarUrl = avatarByName.get(doc.name);
        if (avatarUrl) {
          if (opts.dryRun) {
            console.log(`  [DRY] ${doc.name}: ${avatarUrl}`);
          } else {
            await apiPatch(`/hospitals/admin/doctors/${doc.id}`, { avatarUrl }, opts.token);
            console.log(`  ✅ ${doc.name}: ${avatarUrl}`);
          }
          updated++;
        } else {
          console.log(`  ⏭️  ${doc.name}: 未提取到头像`);
        }
      }
    } catch (e) {
      console.warn(`  ⚠️ 批次 ${batchNum} 失败: ${e.message}`);
    }

    if (i + opts.batchSize < toProcess.length) {
      await sleep(3000);
    }
  }

  console.log(`\n🎉 完成！共更新 ${updated} 个头像`);
}

main().catch((e) => {
  console.error('脚本执行失败:', e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * 浙大二院医生详情抓取脚本（不依赖 Firecrawl，直接 HTTP + HTML 解析）
 *
 * 用法：
 *   node scripts/scrape-z2-avatars.mjs --token <jwt>
 *   node scripts/scrape-z2-avatars.mjs --token <jwt> --dryRun --limit 20
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const HOSPITAL_ID = 63;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, limit: 0, delay: 300, concurrency: 5, skip: 0 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--token') opts.token = args[++i];
    if (args[i] === '--dryRun') opts.dryRun = true;
    if (args[i] === '--limit') opts.limit = Number(args[++i]);
    if (args[i] === '--delay') opts.delay = Number(args[++i]);
    if (args[i] === '--concurrency') opts.concurrency = Number(args[++i]);
    if (args[i] === '--skip') opts.skip = Number(args[++i]);
  }
  opts.token = opts.token || process.env.ADMIN_TOKEN;
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

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractFromHtml(html) {
  const result = { avatarUrl: null, titleLevel: null, expertise: null };

  const imgMatch = html.match(/<img[^>]*class="[^"]*doctor[^"]*"[^>]*src="([^"]+)"/i)
    || html.match(/<div[^>]*class="[^"]*photo[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i)
    || html.match(/<img[^>]*src="(https?:\/\/www\.z2hospital\.com\/upload[^"]+)"/i)
    || html.match(/<img[^>]*src="(https?:\/\/www\.z2hospital\.com\/upfile[^"]+)"/i);

  if (imgMatch) {
    let url = imgMatch[1];
    if (url.startsWith('/')) url = `https://www.z2hospital.com${url}`;
    if (!url.includes('logo') && !url.includes('banner') && !url.includes('qrcode')
        && !url.includes('icon') && !url.includes('wechat') && !url.includes('t5-img')) {
      result.avatarUrl = url;
    }
  }

  const titlePatterns = [
    /(?:职\s*称|职务)[\s：:]*([^\n<]{2,20})/,
    /(主任医师|副主任医师|主治医师|住院医师|教授|副教授)/,
  ];
  for (const pat of titlePatterns) {
    const m = html.match(pat);
    if (m) {
      result.titleLevel = m[1].trim().replace(/\s+/g, ' ');
      break;
    }
  }

  const expertisePatterns = [
    /(?:擅\s*长|专\s*长|专业特长|业务专长)[\s：:]*([^\n]{5,500}?)(?:<\/|。{2}|\n)/,
    /(?:临床专长|医疗专长)[\s：:]*([^\n]{5,500}?)(?:<\/|。{2}|\n)/,
  ];
  for (const pat of expertisePatterns) {
    const m = html.match(pat);
    if (m) {
      result.expertise = m[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim();
      if (result.expertise.length > 500) result.expertise = result.expertise.slice(0, 500);
      break;
    }
  }

  return result;
}

async function main() {
  const opts = parseArgs();
  if (!opts.token) {
    console.error('请提供 --token <jwt>');
    process.exit(1);
  }

  const { readFileSync } = await import('fs');
  let detailDocs;
  try {
    detailDocs = JSON.parse(readFileSync('/tmp/z2hospital_detail_urls.json', 'utf-8'));
  } catch {
    console.error('请先运行医生抓取流程生成 /tmp/z2hospital_detail_urls.json');
    process.exit(1);
  }
  const detailMap = new Map();
  for (const d of detailDocs) detailMap.set(d.name, d.detailUrl);

  console.log(`\n加载医生列表 (hospitalId=${HOSPITAL_ID})...`);
  const allDoctors = [];
  let page = 1;
  while (true) {
    const data = await apiGet(
      `/hospitals/admin/all-doctors?hospitalId=${HOSPITAL_ID}&pageSize=200&page=${page}&includeInactive=true`,
      opts.token,
    );
    if (!data?.items?.length) break;
    allDoctors.push(...data.items);
    page++;
  }

  const needUpdate = allDoctors.filter(
    (d) => detailMap.has(d.name) && (!d.avatarUrl || !d.titleLevel || !d.expertise),
  );

  const afterSkip = opts.skip > 0 ? needUpdate.slice(opts.skip) : needUpdate;
  const toProcess = opts.limit > 0 ? afterSkip.slice(0, opts.limit) : afterSkip;
  console.log(`总 ${allDoctors.length} 人，需更新 ${needUpdate.length}，跳过 ${opts.skip}，本次处理 ${toProcess.length}，并发 ${opts.concurrency}\n`);

  let updated = 0;
  let errors = 0;
  const concurrency = opts.concurrency || 5;

  async function processOne(doc, idx) {
    const url = detailMap.get(doc.name);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) { console.log(`[${idx}] ${doc.name} HTTP ${res.status}`); errors++; return; }
      const html = await res.text();
      const info = extractFromHtml(html);

      const patch = {};
      if (info.avatarUrl && !doc.avatarUrl) patch.avatarUrl = info.avatarUrl;
      if (info.titleLevel && !doc.titleLevel) patch.titleLevel = info.titleLevel;
      if (info.expertise && !doc.expertise) patch.expertise = info.expertise;

      if (Object.keys(patch).length === 0) return;

      if (opts.dryRun) {
        console.log(`[${idx}] ${doc.name} [DRY] ${Object.keys(patch).join('+')}`);
      } else {
        await apiPatch(`/hospitals/admin/doctors/${doc.id}`, patch, opts.token);
        console.log(`[${idx}] ${doc.name} ${Object.keys(patch).join('+')}`);
      }
      updated++;
    } catch (e) {
      console.log(`[${idx}] ${doc.name} ERR: ${e.message}`);
      errors++;
    }
  }

  for (let i = 0; i < toProcess.length; i += concurrency) {
    const batch = toProcess.slice(i, i + concurrency);
    const tasks = batch.map((doc, j) => processOne(doc, i + j + 1));
    await Promise.all(tasks);
    if (i + concurrency < toProcess.length) await sleep(opts.delay);
  }

  console.log(`\n完成！更新 ${updated} 人，失败 ${errors} 人`);
}

main().catch((e) => {
  console.error('脚本执行失败:', e);
  process.exit(1);
});

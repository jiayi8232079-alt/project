#!/usr/bin/env node
/**
 * 基于 Puppeteer 的医院医生批量抓取脚本（免费，无需 API key）
 *
 * 用法：
 *   node scripts/scrape-doctors-puppeteer.mjs --hospitalId 28 --websiteUrl https://www.zy91.com
 *   node scripts/scrape-doctors-puppeteer.mjs --hospitalId 71 --websiteUrl https://www.srrsh.com --dryRun
 *   node scripts/scrape-doctors-puppeteer.mjs --all   # 抓取所有有 websiteUrl 的医院
 *
 * 环境变量：
 *   API_BASE    — 后端地址（默认 http://localhost:3000）
 *   ADMIN_TOKEN — 管理员 JWT token（或 --token）
 */

import puppeteer from 'puppeteer';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, all: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--hospitalId') opts.hospitalId = Number(args[++i]);
    if (args[i] === '--websiteUrl') opts.websiteUrl = args[++i];
    if (args[i] === '--token') opts.token = args[++i];
    if (args[i] === '--dryRun') opts.dryRun = true;
    if (args[i] === '--all') opts.all = true;
    if (args[i] === '--maxDepts') opts.maxDepts = Number(args[++i]);
  }
  opts.token = opts.token || process.env.ADMIN_TOKEN;
  opts.maxDepts = opts.maxDepts || 30;
  return opts;
}

async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data?.data ?? data;
}

async function apiPost(path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function scrapeDepartmentPage(browser, url) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(20000);
  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.waitForSelector('body', { timeout: 5000 });

    const data = await page.evaluate(() => {
      const doctors = [];
      const cards = document.querySelectorAll(
        '[class*="doctor"], [class*="expert"], [class*="team-member"], .member-item, .doctor-item, .expert-item, li[class*="doc"]'
      );

      for (const card of cards) {
        const nameEl = card.querySelector('h3, h4, .name, [class*="name"], strong, .title a');
        const name = nameEl?.textContent?.trim();
        if (!name || name.length > 20) continue;

        const titleEl = card.querySelector('.desc, [class*="title"], [class*="level"], .sub, p');
        const titleLevel = titleEl?.textContent?.trim()?.slice(0, 64) || '';

        const imgEl = card.querySelector('img');
        let avatarUrl = imgEl?.src || imgEl?.getAttribute('data-src') || '';
        if (avatarUrl && !avatarUrl.startsWith('http')) {
          avatarUrl = new URL(avatarUrl, window.location.origin).href;
        }

        const linkEl = card.querySelector('a[href]');
        let detailUrl = linkEl?.href || '';

        doctors.push({ name, titleLevel, avatarUrl, detailUrl });
      }

      if (doctors.length === 0) {
        const links = document.querySelectorAll('a');
        for (const a of links) {
          const href = a.href || '';
          const text = a.textContent?.trim() || '';
          if (
            text.length >= 2 &&
            text.length <= 10 &&
            (href.includes('doctor') || href.includes('expert')) &&
            !text.includes('更多') &&
            !text.includes('科室')
          ) {
            doctors.push({ name: text, titleLevel: '', avatarUrl: '', detailUrl: href });
          }
        }
      }

      return doctors;
    });

    return data;
  } catch (e) {
    console.warn(`    ⚠️ 页面抓取失败: ${e.message}`);
    return [];
  } finally {
    await page.close();
  }
}

async function scrapeDeptList(browser, websiteUrl) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(20000);

  const deptUrls = [
    `${websiteUrl}/department`,
    `${websiteUrl}/keshi`,
    `${websiteUrl}/departments`,
  ];

  let departments = [];

  for (const url of deptUrls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 2000));

      departments = await page.evaluate(() => {
        const results = [];
        const links = document.querySelectorAll('a[href]');
        for (const a of links) {
          const text = a.textContent?.trim();
          if (!text || text.length < 2 || text.length > 30) continue;
          const href = a.href;
          if (
            (href.includes('department') || href.includes('dept') || href.includes('keshi')) &&
            !href.includes('javascript') &&
            !text.includes('首页') &&
            !text.includes('更多')
          ) {
            results.push({ name: text, url: href });
          }
        }
        const seen = new Set();
        return results.filter((d) => {
          if (seen.has(d.url)) return false;
          seen.add(d.url);
          return true;
        });
      });

      if (departments.length > 0) {
        console.log(`  ✅ 从 ${url} 找到 ${departments.length} 个科室`);
        break;
      }
    } catch {
      continue;
    }
  }

  await page.close();
  return departments;
}

async function processHospital(browser, hospital, opts) {
  const websiteUrl = opts.websiteUrl || hospital.websiteUrl || hospital.website_url;
  if (!websiteUrl) {
    console.log(`  ⏭️ ${hospital.name} 无官网 URL，跳过`);
    return 0;
  }

  console.log(`\n🏥 ${hospital.name} (id=${hospital.id})`);
  console.log(`   官网: ${websiteUrl}`);

  const departments = await scrapeDeptList(browser, websiteUrl);
  if (departments.length === 0) {
    console.log('  ⚠️ 未找到科室列表');
    return 0;
  }

  const allDoctors = [];
  const deptSlice = departments.slice(0, opts.maxDepts);

  for (const dept of deptSlice) {
    console.log(`  📌 ${dept.name}...`);
    const doctors = await scrapeDepartmentPage(browser, dept.url);
    for (const d of doctors) {
      if (d.name) {
        allDoctors.push({ ...d, department: dept.name });
      }
    }
    console.log(`     → ${doctors.length} 位`);
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n  共 ${allDoctors.length} 位医生`);

  if (allDoctors.length === 0) return 0;

  if (opts.dryRun) {
    console.log('  [DRY RUN] 以下医生将被导入:');
    for (const d of allDoctors.slice(0, 20)) {
      console.log(`    - ${d.name} | ${d.department} | ${d.titleLevel}`);
    }
    if (allDoctors.length > 20) console.log(`    ... 还有 ${allDoctors.length - 20} 位`);
    return allDoctors.length;
  }

  const result = await apiPost(
    '/hospitals/admin/doctors/batch',
    {
      hospitalId: hospital.id,
      replace: false,
      items: allDoctors.map((d) => ({
        name: d.name,
        department: d.department,
        titleLevel: d.titleLevel || null,
        avatarUrl: d.avatarUrl || null,
      })),
    },
    opts.token,
  );

  const inserted = result?.data?.inserted ?? 0;
  console.log(`  💾 导入结果: ${inserted} 条`);
  return inserted;
}

async function main() {
  const opts = parseArgs();
  if (!opts.token) {
    console.error('请提供管理员 token: --token <jwt> 或设置 ADMIN_TOKEN');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    if (opts.all) {
      console.log('🔍 获取所有有官网的医院...');
      const list = await apiGet('/hospitals/admin/list?pageSize=999', opts.token);
      const hospitals = (list?.items || []).filter(
        (h) => h.websiteUrl || h.website_url,
      );
      console.log(`找到 ${hospitals.length} 家有官网的医院\n`);

      let total = 0;
      for (const h of hospitals) {
        total += await processHospital(browser, h, opts);
      }
      console.log(`\n🎉 全部完成！共导入 ${total} 位医生`);
    } else if (opts.hospitalId) {
      const hospital = await apiGet(`/hospitals/lookup/${opts.hospitalId}`, opts.token);
      if (!hospital?.name) {
        console.error('未找到该医院');
        process.exit(1);
      }
      await processHospital(browser, { ...hospital, id: opts.hospitalId }, opts);
    } else {
      console.error('用法: --hospitalId <id> --websiteUrl <url> 或 --all');
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('脚本失败:', e);
  process.exit(1);
});

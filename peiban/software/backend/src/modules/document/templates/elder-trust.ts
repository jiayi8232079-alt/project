/**
 * 《老人托管服务委托书》HTML 包装器。
 *
 * 使用场景：子女代老人在陪了个伴小程序创建健康档案 + 接入家庭托管时，
 * 必须由子女电子签署本委托书，作为后续代行管理（预约服务、查看档案、
 * 接收预警、处理账单等）的书面授权凭证。
 *
 * 正文直接复用《家属（亲属）远程授权书》模板 `buildFamilyAuthorizationPage`，
 * 因其条款已覆盖「代为签署、委托范围、责任承担、留痕」四要素；此处只需
 * 额外包一层独立 HTML 外壳（含样式 + 打印工具栏），不绑定订单场景。
 */

import { HEALTH_ARCHIVE_PRINT_CSS } from './health-profile.js';
import { toolbar, editScript } from './shared-styles.js';
import { buildFamilyAuthorizationPage } from './family-authorization.js';

export function generateElderTrustHtml(data: {
  customerName: string;
  customerIdCard?: string;
  customerPhone?: string;
  signerName: string;
  signerRelation?: string;
  signerPhone?: string;
  signerIdCard?: string;
  signatureUrl?: string;
  signedAt?: string | Date;
}): string {
  const authorizationPage = buildFamilyAuthorizationPage({
    customerName: data.customerName,
    customerIdCard: data.customerIdCard,
    customerPhone: data.customerPhone,
    signerName: data.signerName,
    signerRelation: data.signerRelation,
    signerPhone: data.signerPhone,
    signerIdCard: data.signerIdCard,
    signatureUrl: data.signatureUrl,
    signedAt: data.signedAt,
  });

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>老人托管服务委托书 - ${data.customerName}</title>
<style>${HEALTH_ARCHIVE_PRINT_CSS}</style>
<style>
/* 非订单场景的页面专属微调：移除 page-break-before */
body.escort-confirm-print .notice-doc{page-break-before:auto!important}
body{background:#f5f6f8;margin:0;padding:0;font-family:-apple-system,'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif}
.wrap{max-width:900px;margin:0 auto;padding:24px 12px}
</style>
</head>
<body class="escort-confirm-print">
${toolbar()}
<div class="wrap">
${authorizationPage}
</div>
${editScript(`老人托管服务委托书_${data.customerName}.html`)}
</body></html>`;
}

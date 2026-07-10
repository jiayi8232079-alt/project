export const SHARED_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif;color:#333;max-width:800px;margin:0 auto;padding:40px;font-size:14px;line-height:1.8}
.header{text-align:center;border-bottom:3px solid #2B9F7C;padding-bottom:16px;margin-bottom:24px}
.header .logo{font-size:28px;font-weight:bold;color:#2B9F7C;margin-bottom:4px}
.header h1{font-size:22px;color:#333;margin-bottom:8px}
.header .sub{font-size:13px;color:#999}
.id-bar{display:flex;justify-content:space-between;font-size:13px;color:#666;margin-bottom:20px;padding:8px 16px;background:#f8f8f8;border-radius:6px}
.section{margin-bottom:20px}
.section h2{font-size:15px;color:#2B9F7C;border-left:4px solid #2B9F7C;padding-left:10px;margin-bottom:12px;font-weight:600}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
td,th{padding:8px 12px;border:1px solid #d0d0d0;font-size:13px;vertical-align:top}
td.label,th{background:#f5f9f7;font-weight:600;color:#555;width:130px;white-space:nowrap}
.checkbox{display:inline-block;width:14px;height:14px;border:2px solid #999;border-radius:3px;margin-right:4px;vertical-align:middle;text-align:center;line-height:14px;font-size:11px}
.checkbox.checked{background:#2B9F7C;border-color:#2B9F7C;color:#fff}
.check-item{display:inline-block;margin-right:16px;margin-bottom:4px;white-space:nowrap}
.signature-area{margin-top:32px;display:flex;justify-content:space-between;gap:40px}
.signature-box{flex:1}
.signature-box .line{border-bottom:1px solid #333;height:44px;margin-bottom:6px}
.signature-box .hint{font-size:12px;color:#999}
.signature-box .signed-name,.signature-box .signed-date{font-size:13px;color:#333;margin-top:4px}
.signature-img{width:260px;max-width:100%;height:96px;object-fit:contain;object-position:left center;margin-top:8px;display:block}
.footer{text-align:center;margin-top:40px;font-size:12px;color:#bbb;border-top:1px solid #e0e0e0;padding-top:16px}
.terms{font-size:12px;color:#666;line-height:1.8}
.terms h3{font-size:13px;color:#333;margin:12px 0 6px}
.terms p,.terms li{margin-bottom:4px}
.terms ol,.terms ul{padding-left:20px}
.toolbar{position:fixed;top:0;left:0;right:0;background:#2B9F7C;color:#fff;padding:8px 20px;display:flex;justify-content:center;gap:12px;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,0.15)}
.toolbar button{background:#fff;color:#2B9F7C;border:none;padding:6px 20px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600}
.toolbar button:hover{background:#f0faf6}
.spacer{height:50px}
.editable{background:#fffff8}
.notice-box{background:#fffde7;border:1px solid #ffe082;border-radius:8px;padding:16px;margin:16px 0;font-size:13px}
.notice-box h3{color:#f57f17;margin-bottom:8px}
@media print{
  .toolbar,.spacer{display:none!important}
  body{padding:15px;font-size:12px}
  @page{margin:1.2cm}
  td,th{padding:4px 8px;font-size:11px}
  .editable{background:#fff!important}
}
`;

export function checkbox(checked: boolean): string {
  return `<span class="checkbox${checked ? ' checked' : ''}">${checked ? '✓' : ''}</span>`;
}

export function toolbar(): string {
  return `<div class="toolbar">
    <button onclick="window.print()">🖨️ 打印</button>
    <button onclick="toggleEdit()">✏️ 编辑模式</button>
    <button onclick="saveDoc()">💾 保存</button>
  </div><div class="spacer"></div>`;
}

export function editScript(fileName: string): string {
  return `<script>
let editMode=false;
function toggleEdit(){editMode=!editMode;document.querySelectorAll('.editable').forEach(td=>{td.contentEditable=editMode?'true':'false'});alert(editMode?'编辑模式已开启，直接点击内容修改':'编辑模式已关闭');}
function saveDoc(){const blob=new Blob([document.documentElement.outerHTML],{type:'text/html'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='${fileName}';a.click();alert('已下载保存');}
<\/script>`;
}

export function dateStr(d?: Date | string | null): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
}

export function maskIdCard(id?: string): string {
  if (!id) return '—';
  return id.replace(/^(.{6}).+(.{4})$/, '$1********$2');
}

export function maskPhone(p?: string): string {
  if (!p) return '—';
  return p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

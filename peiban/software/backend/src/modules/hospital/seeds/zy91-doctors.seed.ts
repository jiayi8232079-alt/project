/**
 * 浙大一院（浙江大学医学院附属第一医院）医生种子数据
 * 来源：医院官网 https://www.zy91.com 公开信息（仅展示用名录）
 */

export interface DoctorSeedItem {
  name: string;
  department: string;
  titleLevel: string;
  expertise?: string;
  introduction?: string;
  avatarUrl?: string;
}

export const ZY91_DOCTORS: DoctorSeedItem[] = [
  // ─── 肝胆胰外科 ───
  { name: '郑树森', department: '肝胆胰外科', titleLevel: '中国工程院院士、教授、主任医师、博士生导师' },
  { name: '梁廷波', department: '肝胆胰外科', titleLevel: '教授、主任医师、博士生导师' },
  { name: '沈岩', department: '肝胆胰外科', titleLevel: '主任医师' },
  { name: '张珉', department: '肝胆胰外科', titleLevel: '主任医师' },
  { name: '白雪莉', department: '肝胆胰外科', titleLevel: '教授、主任医师、博士生导师' },
  { name: '吴健', department: '肝胆胰外科', titleLevel: '主任医师' },
  { name: '高顺良', department: '肝胆胰外科', titleLevel: '主任医师' },
  { name: '俞军', department: '肝胆胰外科', titleLevel: '主任医师' },
  { name: '吴李鸣', department: '肝胆胰外科', titleLevel: '主任医师' },
  { name: '阙日升', department: '肝胆胰外科', titleLevel: '主任医师' },
  { name: '张微', department: '肝胆胰外科', titleLevel: '主任医师' },
  { name: '章云涛', department: '肝胆胰外科', titleLevel: '主任医师' },
  { name: '王卫利', department: '肝胆胰外科', titleLevel: '副主任医师' },
  { name: '张匀', department: '肝胆胰外科', titleLevel: '主任医师' },
  { name: '耿磊', department: '肝胆胰外科', titleLevel: '主任医师' },

  // ─── 胃肠外科 ───
  { name: '覃吉超', department: '胃肠外科', titleLevel: '主任医师' },
  { name: '于吉人', department: '胃肠外科', titleLevel: '主任医师' },
  { name: '高原', department: '胃肠外科', titleLevel: '主任医师' },
  { name: '刘小孙', department: '胃肠外科', titleLevel: '主任医师' },
  { name: '张正筠', department: '胃肠外科', titleLevel: '主治医师' },
  { name: '沈倩云', department: '胃肠外科', titleLevel: '主任医师' },

  // ─── 甲状腺外科 ───
  { name: '邬一军', department: '甲状腺外科', titleLevel: '主任医师' },
  { name: '董帅', department: '甲状腺外科', titleLevel: '副主任医师' },
  { name: '黄钟英', department: '甲状腺外科', titleLevel: '副主任医师' },
  { name: '李甫强', department: '甲状腺外科', titleLevel: '副主任医师' },
  { name: '谢小军', department: '甲状腺外科', titleLevel: '副主任医师' },
  { name: '杨自力', department: '甲状腺外科', titleLevel: '副主任医师' },

  // ─── 乳腺外科 ───
  { name: '傅佩芬', department: '乳腺外科', titleLevel: '主任医师' },
  { name: '代志军', department: '乳腺外科', titleLevel: '副主任医师' },
  { name: '刘彧', department: '乳腺外科', titleLevel: '副主任医师' },
  { name: '魏海燕', department: '乳腺外科', titleLevel: '副主任医师' },
  { name: '吕可真', department: '乳腺外科', titleLevel: '副主任医师' },
  { name: '王淑倩', department: '乳腺外科', titleLevel: '副主任医师' },

  // ─── 结直肠外科 ───
  { name: '吴国生', department: '结直肠外科', titleLevel: '教授、主任医师' },
  { name: '陈文斌', department: '结直肠外科', titleLevel: '主任医师' },
  { name: '刘凡隆', department: '结直肠外科', titleLevel: '主任医师' },
  { name: '叶锋', department: '结直肠外科', titleLevel: '主任医师' },
  { name: '徐加鹤', department: '结直肠外科', titleLevel: '副主任医师' },
  { name: '田洪裕', department: '结直肠外科', titleLevel: '副主任医师' },

  // ─── 心血管内科 ───
  { name: '郭晓纲', department: '心血管内科', titleLevel: '教授、主任医师、博士生导师' },
  { name: '高丹忱', department: '心血管内科', titleLevel: '主任医师' },
  { name: '胡晓晟', department: '心血管内科', titleLevel: '主任医师' },
  { name: '尚云鹏', department: '心血管内科', titleLevel: '主任医师' },
  { name: '王兴祥', department: '心血管内科', titleLevel: '主任医师' },
  { name: '郑良荣', department: '心血管内科', titleLevel: '主任医师' },
  { name: '黄朝阳', department: '心血管内科', titleLevel: '主任医师' },
  { name: '韩阳', department: '心血管内科', titleLevel: '主任医师' },
  { name: '金争鸣', department: '心血管内科', titleLevel: '主任医师' },
  { name: '谢旭东', department: '心血管内科', titleLevel: '主任医师' },
  { name: '严卉', department: '心血管内科', titleLevel: '主任医师' },
  { name: '张磊', department: '心血管内科', titleLevel: '主任医师' },
  { name: '陈婷', department: '心血管内科', titleLevel: '主任医师' },
  { name: '聂文成', department: '心血管内科', titleLevel: '副主任医师' },
  { name: '蒲祥元', department: '心血管内科', titleLevel: '副主任医师' },

  // ─── 普胸外科 ───
  {
    name: '胡坚',
    department: '普胸外科',
    titleLevel: '主任医师、教授、博士生导师',
    expertise: '肺癌、食管癌及纵膈肿瘤等胸外科疾病诊治、胸腔镜微创手术、达芬奇机器人胸部手术、肺移植',
    avatarUrl: 'https://www.zy91.com/upload/202202/JaIrhYxNlmqyPpjg3LdmC2MwBMf5NPCNk4bQUdVT.jpg',
  },

  // ─── 感染病科 ───
  { name: '李兰娟', department: '感染病科', titleLevel: '中国工程院院士、教授、主任医师' },

  // ─── 血液科 ───
  { name: '黄河', department: '血液科骨髓移植中心', titleLevel: '教授、主任医师、博士生导师' },

  // ─── 呼吸内科 ───
  { name: '周建英', department: '呼吸内科', titleLevel: '教授、主任医师、博士生导师' },

  // ─── 重症医学科 ───
  { name: '蔡洪流', department: '重症医学科', titleLevel: '主任医师' },

  // ─── 放疗科 ───
  { name: '严森祥', department: '放疗科', titleLevel: '主任医师、博士生导师' },

  // ─── 神经外科 ───
  { name: '陈峰', department: '神经外科', titleLevel: '主任医师、博士生导师' },

  // ─── 老年医学科 ───
  { name: '王兰', department: '老年医学科', titleLevel: '主任医师' },

  // ─── 骨科 ───
  { name: '沈淼达', department: '骨科', titleLevel: '副主任医师' },

  // ─── 麻醉科 ───
  { name: '方向明', department: '麻醉科', titleLevel: '教授、主任医师、博士生导师' },
  { name: '姚永兴', department: '麻醉科', titleLevel: '副主任医师' },

  // ─── 肿瘤内科 ───
  { name: '徐农', department: '肿瘤内科', titleLevel: '教授、主任医师' },
];

---
name: disk-filesystem-reverse-engineering
description: 磁盘与文件系统逆向。MBR / GPT；NTFS / ext4 / APFS / HFS+ / Btrfs / FAT32；LVM / RAID / LUKS / BitLocker / FileVault；数据恢复 / carving；磁盘取证；SSD TRIM 影响；虚拟磁盘格式。配合 memrev / malrev / fmtrev 用。
---

# 磁盘 / 文件系统 / 存储逆向

## 适用场景
- 分析磁盘镜像的分区与文件系统。
- 数据恢复 / file carving。
- 分析加密卷 (BitLocker / LUKS / FileVault)。
- 磁盘级取证 (证据采集 + 分析)。

## 不适用
- 常规文件管理。
- 内存取证 → `memrev`。
- 文件格式分析 → `fmtrev`。

---

## 分区表

```text
MBR (Master Boot Record):
  偏移 0x000: Bootstrap code (446 bytes)
  偏移 0x1BE: 分区表 (4 entries × 16 bytes)
  偏移 0x1FE: 0x55 0xAA (签名)

  分区 entry:
    状态 (1B) | CHS 起始 (3B) | 类型 (1B) | CHS 结束 (3B) | LBA (4B) | 扇区数 (4B)
    类型: 0x07=NTFS  0x0C=FAT32  0x83=Linux  0x82=swap  0xEE=GPT protective

GPT (GUID Partition Table):
  LBA 0: Protective MBR
  LBA 1: GPT Header (签名 "EFI PART")
  LBA 2-33: Partition entries (128 entries × 128 bytes)
  每个 entry: Type GUID + Unique GUID + LBA start/end + Attributes + Name

工具:
  fdisk -l / gdisk -l / parted print
  mmls image.dd                            # Sleuth Kit
```

## 文件系统

```text
NTFS:
  $MFT: 主文件表 (每个文件一条记录, 1KB)
  $MFT entry: 属性列表 ($STANDARD_INFORMATION / $FILE_NAME / $DATA / $INDEX)
  $DATA: 文件内容 (resident < 700B / non-resident → cluster runs)
  $BITMAP: 分配位图
  $LogFile: 事务日志 (USN Journal)
  时间戳: $SI (4个) + $FN (4个) = 8 个时间戳 (timestomping 检测)

  工具: ntfsinfo / ntfsls / ntfscat / analyzeMFT / MFTECmd

ext4:
  Superblock (1024偏移) → 文件系统元数据
  Block Group → inode table + data blocks
  inode: 权限 / 大小 / 时间戳 / block pointers
  Extents: 连续块映射
  Journal: jbd2 事务日志
  删除恢复: inode 不立即清零 → extundelete / ext4magic

APFS:
  Container (NX superblock) → Volumes
  Copy-on-Write: 快照 / 克隆 零开销
  加密: per-file / per-volume
  时间戳: nanosecond 精度
  工具: diskutil apfs list / apfs-fuse / ipsw

HFS+:
  Catalog B-tree / Extents B-tree / Attributes B-tree
  Resource Fork + Data Fork
  工具: hfsutils / The Sleuth Kit (TSK)

FAT32 / exFAT:
  FAT (File Allocation Table): 链式分配
  Directory entry: 8.3 name + LFN + 属性 + cluster
  简单结构 → 取证恢复容易
```

## 磁盘取证

```bash
# 采集 (写保护!)
dc3dd if=/dev/sda hof=evidence.dd hash=sha256 log=evidence.log
ewfacquire /dev/sda                       # E01 (Expert Witness) 格式
# FTK Imager (Windows GUI)

# 验证
sha256sum evidence.dd
ewfverify evidence.E01

# Sleuth Kit (TSK)
mmls evidence.dd                           # 分区表
fsstat -o <offset> evidence.dd             # 文件系统信息
fls -r -o <offset> evidence.dd             # 文件列表 (含已删除)
icat -o <offset> evidence.dd <inode>       # 提取文件
tsk_recover -o <offset> evidence.dd output/ # 恢复已删除

# Autopsy (GUI, 基于 TSK)
autopsy                                    # 启动 Web UI
# 功能: 时间线 / 关键词搜索 / 哈希集 / 文件恢复

# file carving (无文件系统依赖)
photorec evidence.dd                       # 自动恢复
scalpel evidence.dd                        # 基于 magic header
foremost evidence.dd                       # 经典
binwalk evidence.dd                        # 嵌入文件

# bulk_extractor
bulk_extractor -o output/ evidence.dd
# 提取: 邮箱 / URL / 信用卡号 / EXIF / 网络地址
```

## 加密卷

```text
BitLocker (Windows):
  加密: AES-128/256-XTS
  密钥存储: TPM / 密码 / 恢复密钥 / USB
  取证:
    - 恢复密钥: 48位数字 (AD / Microsoft Account)
    - 内存取证: FVEK (Full Volume Encryption Key) 在内存中
    - Volatility: bitlocker plugin
    - Dislocker: Linux 下挂载 BitLocker
  dislocker -V /dev/sda2 -p<password> -- /mnt/bitlocker

LUKS (Linux):
  加密: AES-256-XTS (默认)
  Header: 第一个 sector
  Key slots: 最多 8 个
  取证:
    - 密码字典: hashcat -m 14600
    - 内存: master key 在内存中
    - cryptsetup luksDump /dev/sda2
  cryptsetup luksOpen /dev/sda2 decrypted

FileVault 2 (macOS):
  加密: AES-128-XTS
  密钥: 用户密码 + 恢复密钥
  取证:
    - 恢复密钥 (24字符)
    - 内存取证: Volume Master Key
    - fvde2john → hashcat
```

## SSD 取证注意

```text
TRIM:
  SSD 删除文件后 → OS 发 TRIM 命令 → SSD 擦除物理块
  → 传统 file carving 对 TRIM 后数据无效
  → 需要在 TRIM 执行前取证

Wear Leveling:
  SSD 控制器重新映射逻辑块
  → 物理块位置与逻辑不对应
  → 可能有残余数据在 over-provisioning 区域

建议:
  - 尽快断电保存
  - 不要挂载 (避免触发 TRIM / journal replay)
  - 使用写保护器
  - chip-off 可读取原始 NAND (但需要 FTL 重建)
```

## 实战入口
- **The Sleuth Kit (TSK)** — 命令行取证。
- **Autopsy** — GUI 取证平台。
- **photorec / scalpel** — file carving。
- **bulk_extractor** — 批量数据提取。
- **Volatility** — 内存中磁盘密钥。
- **File System Forensic Analysis (Brian Carrier)**。

## 自检
1. 目标？(磁盘镜像 / 分区 / 加密卷)
2. 文件系统？(NTFS / ext4 / APFS / FAT)
3. 加密？(BitLocker / LUKS / FileVault)
4. SSD 还是 HDD？
5. 取证目标？(恢复 / 时间线 / 隐藏数据)
6. 写保护？

## 相邻技能
- `memrev` — 内存取证 (磁盘密钥)。
- `malrev` — 恶意软件持久化。
- `fmtrev` — 文件格式分析。
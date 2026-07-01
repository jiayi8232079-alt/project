---
name: smart-contract-reverse-engineering
description: 智能合约与区块链逆向工程。Solidity / Vyper 源码审计；EVM bytecode 反编译（Panoramix / Heimdall / ethervm / dedaub）；ABI 还原 + 4byte selector 识别；Foundry / Hardhat / Slither / Mythril / Echidna 安全分析；DeFi 攻击模式（重入 / 闪电贷 / 价格操纵 / 前端运行 / 三明治攻击 / 治理攻击）；链上交易 trace（Tenderly / Phalcon / samczsun.io）；Move / Rust(Solana) / CosmWasm / TON FunC 多链合约审计。配合 cryptrev / webrev / vulnrev 用。
---

# 智能合约 / 区块链逆向

## 适用场景

- 对智能合约做安全审计：Solidity / Vyper 源码级 + EVM 字节码级。
- 反编译链上未验证合约字节码，还原业务逻辑与 ABI。
- 分析 DeFi 攻击事件：重入 / 闪电贷 / 价格操纵 / MEV / 三明治攻击。
- 用 Slither / Mythril / Echidna / Foundry fuzz 做自动化漏洞检测。
- 链上交易 trace + 资金流向追踪。
- 多链合约审计：Move (Aptos/Sui) / Rust (Solana) / CosmWasm / TON FunC。

## 不适用

- 合约开发 / DApp 前端构建。
- 加密货币量化交易策略。
- 密码学原语分析 → `cryptrev`。
- 传统 Web 应用审计 → `webrev` / `code-audit`。

---

## EVM 基础

### EVM 架构

```text
EVM (Ethereum Virtual Machine):
  - 栈式虚拟机, 256-bit word size
  - 栈深度上限 1024
  - 内存: 字节寻址, 按需扩展 (gas 随大小平方增长)
  - Storage: 256-bit key → 256-bit value (持久化, gas 昂贵)
  - Calldata: 只读输入数据
  - Returndata: 上一次 call 的返回值

Gas:
  SLOAD:  2100 (cold) / 100 (warm)
  SSTORE: 20000 (zero→non-zero) / 2900 (non-zero→non-zero)
  CALL:   2600 (cold) + value_transfer_cost
  LOG:    375 + 375*topics + 8*data_bytes

ABI 编码:
  函数选择器: keccak256("functionName(type1,type2)")[:4]
  参数编码: 每个参数 32 bytes, ABI-encoded
  示例:
    transfer(address,uint256) → 0xa9059cbb
    approve(address,uint256) → 0x095ea7b3
    balanceOf(address)       → 0x70a08231
```

### 关键 opcode

```text
栈操作:
  PUSH1-PUSH32    压入 1-32 字节常量
  DUP1-DUP16      复制栈第 N 个元素
  SWAP1-SWAP16    交换栈顶与第 N 个元素
  POP             弹出栈顶

算术:
  ADD SUB MUL DIV MOD EXP
  ADDMOD MULMOD
  SIGNEXTEND
  LT GT SLT SGT EQ ISZERO

内存:
  MLOAD MSTORE MSTORE8 MSIZE

Storage:
  SLOAD SSTORE

控制流:
  JUMP JUMPI JUMPDEST
  PC               当前 PC
  STOP RETURN REVERT INVALID SELFDESTRUCT

环境:
  ADDRESS BALANCE ORIGIN CALLER CALLVALUE
  CALLDATALOAD CALLDATASIZE CALLDATACOPY
  CODESIZE CODECOPY EXTCODESIZE EXTCODECOPY
  RETURNDATASIZE RETURNDATACOPY
  BLOCKHASH COINBASE TIMESTAMP NUMBER PREVRANDAO GASLIMIT CHAINID BASEFEE

调用:
  CALL CALLCODE DELEGATECALL STATICCALL CREATE CREATE2

日志:
  LOG0 LOG1 LOG2 LOG3 LOG4
```

---

## EVM 字节码反编译

### 工具链

```bash
# 1. Panoramix (eveem.org 的开源版)
pip install panoramix-decompiler
panoramix <contract_bytecode_hex>

# 2. Heimdall
cargo install heimdall-rs
heimdall decompile -t <address> --rpc-url https://eth.llamarpc.com
heimdall decode <tx_hash> --rpc-url https://eth.llamarpc.com
heimdall cfg -t <address>                  # 控制流图

# 3. ethervm.io (在线)
# https://ethervm.io/decompile/<address>

# 4. Dedaub (在线, 质量最高)
# https://app.dedaub.com/

# 5. EVM 反汇编
pip install pyevmasm
python3 -c "
from pyevmasm import disassemble_hex
code = '6080604052...'  # hex bytecode
for inst in disassemble_hex(code):
    print(inst)
"

# 6. Foundry: cast
cast disassemble $(cast code <address> --rpc-url <url>)

# 7. 获取链上字节码
cast code <address> --rpc-url https://eth.llamarpc.com
curl -s -X POST https://eth.llamarpc.com \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["<address>","latest"],"id":1}' \
    | jq -r '.result'
```

### ABI 还原

```bash
# 从字节码提取函数选择器
# 手动: 在反汇编中找 PUSH4 + EQ + JUMPI 模式
# 自动:
heimdall decompile -t <address> --rpc-url <url>
# 输出会包含还原的函数签名

# 4byte.directory 查选择器
# https://www.4byte.directory/signatures/?bytes4_signature=0xa9059cbb
curl 'https://www.4byte.directory/api/v1/signatures/?hex_signature=0xa9059cbb'

# openchain.xyz (更全)
# https://openchain.xyz/signatures?query=0xa9059cbb

# Foundry
cast 4byte 0xa9059cbb
# → transfer(address,uint256)

cast 4byte-decode 0xa9059cbb000000000000000000000000...
```

### Storage 布局还原

```bash
# Solidity storage layout
# slot 0: 第一个状态变量
# slot 1: 第二个状态变量
# mapping(key => value): keccak256(abi.encode(key, slot))
# dynamic array: keccak256(slot) + index
# string/bytes: 短 (<32B) 存 slot 本身; 长存 keccak256(slot) 起

# 读取 storage slot
cast storage <address> <slot> --rpc-url <url>
# 例: 读 slot 0 (常见: owner / totalSupply)
cast storage 0xdAC17F958D2ee523a2206206994597C13D831ec7 0 --rpc-url https://eth.llamarpc.com

# 批量读取
for i in $(seq 0 20); do
    echo "slot $i: $(cast storage <address> $i --rpc-url <url>)"
done

# Foundry forge 导出 storage layout
forge inspect src/MyContract.sol:MyContract storage-layout

# Slither storage layout
slither <contract> --print variable-order
```

---

## Solidity 源码审计

### 自动化工具

```bash
# Slither (最强静态分析)
pip install slither-analyzer
slither .                                  # 项目根目录
slither . --print human-summary            # 概要
slither . --detect reentrancy-eth          # 特定检测器
slither . --detect all                     # 全部
slither . --print cfg                      # 控制流图
slither . --print call-graph               # 调用图
slither . --print contract-summary         # 合约摘要

# 常用检测器:
# reentrancy-eth           重入 (ETH 转账)
# reentrancy-no-eth        重入 (无 ETH)
# arbitrary-send-erc20     任意 ERC20 转账
# arbitrary-send-eth       任意 ETH 转账
# suicidal                 自毁
# controlled-delegatecall  可控 delegatecall
# tx-origin                tx.origin 鉴权
# unchecked-transfer       未检查返回值
# locked-ether             ETH 锁死
# shadowing-state          状态变量覆盖
# uninitialized-state      未初始化状态变量

# Mythril (符号执行)
pip install mythril
myth analyze src/MyContract.sol
myth analyze --codefile <bytecode_hex_file>
myth analyze -a <address> --rpc <url>      # 链上

# Echidna (Fuzzer)
# 安装: https://github.com/crytic/echidna
# 写 property test:
# function echidna_test_balance() public returns (bool) {
#     return address(this).balance >= 0;
# }
echidna . --contract MyContractTest --test-mode assertion

# Foundry fuzz
forge test --match-test testFuzz -vvvv

# Manticore (符号执行)
pip install manticore
manticore <contract.sol>

# Securify2 (ETH Zurich)
# Certora Prover (形式化验证, 商业)
# MythX (SaaS: mythx.io)
# Code4rena / Sherlock (审计竞赛平台)
```

### 漏洞模式速查

```text
| 漏洞类型 | 模式 | 严重度 |
|---------|------|--------|
| 重入 (Reentrancy) | 先转账后改状态 / callback 回调 | Critical |
| 闪电贷攻击 | 单 tx 内借→操纵→还 | Critical |
| 价格操纵 | 依赖链上 AMM 现价做业务逻辑 | Critical |
| 未检查返回值 | transfer/send 返回 false 未处理 | High |
| 整数溢出 | Solidity <0.8 无内置检查 | High |
| tx.origin 鉴权 | 用 tx.origin 替代 msg.sender | High |
| delegatecall 注入 | delegatecall 目标可控 | Critical |
| selfdestruct | 强制发 ETH 到合约 | Medium |
| 前端运行 (Frontrun) | mempool 可见 → MEV 提取 | Medium |
| 三明治攻击 | 夹在用户 swap tx 前后 | Medium |
| 治理攻击 | 闪电贷借票 → 通过恶意提案 | Critical |
| 存储碰撞 | 代理合约 storage slot 冲突 | Critical |
| 权限缺失 | 关键函数无 onlyOwner / access control | Critical |
| 拒绝服务 | 循环中外部调用 / gas limit | Medium |
| 签名重放 | 缺 nonce / chainId / deadline | High |
| 精度损失 | 除法截断 → 微量损失累积 | Medium |
```

### 重入攻击详解

```solidity
// 漏洞合约
contract Vulnerable {
    mapping(address => uint) public balances;

    function withdraw() external {
        uint bal = balances[msg.sender];
        require(bal > 0);

        // 危险: 先转账
        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent, "Failed");

        // 后改状态 → 攻击者在 receive() 中重入
        balances[msg.sender] = 0;
    }
}

// 攻击合约
contract Attacker {
    Vulnerable target;

    function attack() external payable {
        target.deposit{value: 1 ether}();
        target.withdraw();
    }

    receive() external payable {
        if (address(target).balance >= 1 ether) {
            target.withdraw();  // 重入!
        }
    }
}

// 修复: Checks-Effects-Interactions 模式
contract Fixed {
    mapping(address => uint) public balances;
    bool private locked;

    modifier noReentrant() {
        require(!locked, "No re-entrancy");
        locked = true;
        _;
        locked = false;
    }

    function withdraw() external noReentrant {
        uint bal = balances[msg.sender];
        require(bal > 0);

        // 先改状态
        balances[msg.sender] = 0;

        // 后转账
        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent, "Failed");
    }
}
```

---

## DeFi 攻击分析

### 闪电贷攻击

```text
闪电贷 (Flash Loan): 同一 tx 内借还, 零抵押

攻击流程:
  1. 从 Aave/dYdX 闪电贷 N ETH
  2. 用贷款操纵价格 (dump 到 AMM / inflate collateral)
  3. 利用被操纵的价格执行目标操作 (清算 / mint / swap)
  4. 获利
  5. 还贷 + 利息
  全部在一个 transaction 内完成

防御:
  - 使用 TWAP (Time-Weighted Average Price) 而非即时价格
  - Chainlink 预言机 (链下喂价, 难操纵)
  - 延迟执行 (跨 block)
  - 借贷协议: 检查 collateral factor 变化幅度
```

### 交易 Trace 分析

```bash
# Tenderly (最易用)
# https://dashboard.tenderly.co/tx/<chain>/<tx_hash>
# 可视化 call trace + storage diff + event log

# Phalcon (BlockSec)
# https://explorer.phalcon.xyz/tx/<chain>/<tx_hash>
# 资金流 + 调用树

# samczsun Tx Decoder
# https://tx.eth.samczsun.com/ethereum/<tx_hash>

# Foundry cast
cast run <tx_hash> --rpc-url <url>         # 重放交易
cast run <tx_hash> --rpc-url <url> --debug  # 逐步 debug (terminal UI)

# Foundry trace
cast call --trace <address> "func(args)" --rpc-url <url>

# 事件日志
cast logs --from-block <n> --to-block <m> \
    --address <contract> \
    --topic0 <event_selector> \
    --rpc-url <url>

# Etherscan API
curl "https://api.etherscan.io/api?module=account&action=txlistinternal&txhash=<hash>&apikey=<key>"
```

### Foundry 复现攻击

```solidity
// test/AttackReplay.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";

interface ITarget {
    function deposit() external payable;
    function withdraw(uint256) external;
}

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
}

contract AttackReplayTest is Test {
    // Fork 主网状态
    function setUp() public {
        // 在攻击 block 之前 fork
        vm.createSelectFork("https://eth.llamarpc.com", 18_000_000);
    }

    function testReplayAttack() public {
        // 模拟攻击者
        address attacker = makeAddr("attacker");
        vm.startPrank(attacker);

        // ... 复现攻击步骤 ...
        // deal(address(token), attacker, 1000e18);
        // ITarget(target).deposit{value: 1 ether}();
        // ...

        vm.stopPrank();

        // 验证攻击结果
        // assertGt(token.balanceOf(attacker), 0);
    }
}
```

```bash
# 运行
forge test --match-test testReplayAttack -vvvv --fork-url https://eth.llamarpc.com
```

---

## 代理合约与升级模式

```text
Transparent Proxy (OpenZeppelin):
  Proxy → implementation
  admin 调用 → proxy 自身逻辑 (upgrade)
  非 admin → delegatecall implementation

  Storage 碰撞风险:
    Proxy slot 0 = implementation address
    Implementation slot 0 = 业务变量
    解法: EIP-1967 标准 slot (keccak256("eip1967.proxy.implementation") - 1)

UUPS (Universal Upgradeable Proxy Standard):
  升级逻辑在 implementation 中 (不在 proxy)
  更省 gas
  风险: 升级函数被移除 → 合约永久锁定

Beacon Proxy:
  多个 proxy → 一个 beacon → 一个 implementation
  适合批量升级

Diamond (EIP-2535):
  多 facet (多个 implementation)
  按函数选择器路由到不同 facet

审计要点:
  □ storage layout 向后兼容
  □ 初始化函数是否可重复调用 (initializer modifier)
  □ 升级权限是否足够严格
  □ 是否有 selfdestruct 在 implementation 中
  □ delegatecall context: msg.sender / msg.value / storage 都是 proxy 的
```

```bash
# 查看代理关系
# EIP-1967 slots:
# Implementation: 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
# Admin:          0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103
# Beacon:         0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50

cast storage <proxy_addr> 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc --rpc-url <url>
# → implementation address

# Foundry: 查看代理 + implementation 的 storage 差异
cast storage <addr> --rpc-url <url>
```

---

## 多链合约审计

### Solana (Rust / Anchor)

```text
架构差异:
  - 账户模型 (不是 EVM 的合约存储)
  - Program (合约) 是无状态的; 数据存在 Account 中
  - 指令 (Instruction) 而非函数调用
  - CPI (Cross-Program Invocation) 而非 CALL/DELEGATECALL

常见漏洞:
  - 账户未验证 (Missing Account Validation)
  - 签名者检查缺失 (Missing Signer Check)
  - Owner 检查缺失
  - 类型混淆 (Account Confusion)
  - 整数溢出 (Rust 默认 release 模式不检查)
  - 重入 (CPI 回调)
  - PDA (Program Derived Address) 碰撞

工具:
  anchor test                              # Anchor 框架测试
  cargo clippy                             # Rust lint
  xray (Sec3)                              # Solana 专用审计工具
  soteria                                  # Solana 静态分析
```

### Move (Aptos / Sui)

```text
Move 安全特性:
  - 线性类型系统 (资源不能复制/丢弃 除非显式声明)
  - 形式化验证内置 (Move Prover)
  - 无动态 dispatch → 无重入

仍需审计:
  - 业务逻辑错误
  - 权限控制不当
  - 数值溢出 (Move 会 abort)
  - 模块升级权限

工具:
  move prove                               # 形式化验证
  aptos move test                          # 单元测试
  sui move test
```

### TON (FunC / Tact)

```text
TON 特点:
  - 异步消息传递 (不是同步调用)
  - Actor 模型
  - 合约间通信通过内部消息
  - Gas 模型不同 (TVM)

漏洞:
  - 消息处理顺序假设错误
  - bounce 消息未处理
  - 合约余额耗尽 (storage fee)
  - 不正确的消息序列化
```

---

## 链上监控与告警

```text
实时监控:
  Forta Network:     去中心化安全监控
  OpenZeppelin Defender: 自动化安全运维
  Tenderly Alerts:   条件触发
  Chainlink Automation: 自动执行

事后分析:
  Etherscan / BscScan / Polygonscan
  Dune Analytics:    SQL 查询链上数据
  Nansen:            链上标签 + 资金流
  Arkham:            实体识别

告警规则示例:
  - 大额转账 (> threshold)
  - 闪电贷调用
  - 合约升级事件
  - 异常 gas 消耗
  - 新合约部署 (watch factory)
  - 价格偏离 (oracle vs AMM)
```

---

## 工具速查

```text
开发/测试:
  Foundry (forge/cast/anvil)  — 最强 Solidity 开发框架
  Hardhat                     — JavaScript 生态
  Brownie                     — Python 生态 (已停维)
  Anchor                      — Solana 开发框架

静态分析:
  Slither                     — Trail of Bits, 最强 Solidity 分析
  Mythril                     — ConsenSys, 符号执行
  Securify2                   — ETH Zurich
  Semgrep (Solidity rules)    — 自定义规则

Fuzzing:
  Echidna                     — 基于 property 的 Solidity fuzzer
  Medusa                      — 并行 fuzzer (Trail of Bits 新品)
  Foundry fuzz                — 内置

形式化验证:
  Certora Prover              — 商业, 最强
  KEVM                        — K Framework EVM 语义
  Move Prover                 — Move 内置

反编译:
  Panoramix / eveem           — EVM 反编译
  Heimdall                    — Rust, 多功能
  Dedaub                      — 在线, 高质量
  ethervm.io                  — 在线

链上分析:
  Tenderly                    — Tx trace + debug
  Phalcon (BlockSec)          — 攻击分析
  cast (Foundry)              — CLI 万能工具
  Dune Analytics              — SQL on-chain
```

---

## 实战入口

- **Damn Vulnerable DeFi** — DeFi 安全 CTF 练习 (damnvulnerabledefi.xyz)。
- **Ethernaut (OpenZeppelin)** — Solidity 安全入门 CTF。
- **Capture the Ether** — EVM 安全挑战。
- **Paradigm CTF** — 顶级区块链 CTF。
- **Rekt.news** — DeFi 攻击事件报道 + 分析。
- **samczsun.com** — 顶级白帽博客。
- **Trail of Bits blog** — Slither / Echidna / Medusa。
- **OpenZeppelin Security Audits** — 公开审计报告。
- **Code4rena / Sherlock / Immunefi** — 审计竞赛 + Bug Bounty。
- **Secureum bootcamp** — 系统化 Solidity 安全教程。
- **EVM Codes** — evm.codes 交互式 opcode 参考。
- **SWC Registry** — 智能合约弱点分类 (类似 CWE)。

## 自检（接到目标 30 分钟内回答）

1. 目标链？（Ethereum / BSC / Polygon / Solana / Aptos / TON / L2）
2. 有源码还是只有字节码？已验证合约？
3. 合约类型？（Token / DeFi / NFT / DAO / Bridge / Oracle）
4. 代理模式？（Transparent / UUPS / Diamond / Beacon）
5. 依赖？（OpenZeppelin / Solmate / 自定义）
6. 自动化工具跑了？（Slither / Mythril / Echidna / Foundry fuzz）
7. DeFi 攻击面？（闪电贷 / 价格操纵 / 重入 / MEV）
8. 权限模型？（Ownable / AccessControl / Timelock / Multisig）
9. 升级机制安全？（storage layout / initializer / 权限）
10. 相邻技能联动？（cryptrev / webrev / vulnrev / code-audit）

## 相邻技能

- `cryptrev` — 密码学原语 / 签名方案 / 零知识证明。
- `webrev` — DApp 前端安全 / Web3 钱包交互。
- `vulnrev` — 传统漏洞研究方法论（与合约审计互补）。
- `code-audit` — 通用代码审计方法论。
- `protrev` — 协议层分析（P2P / RPC / 共识）。
- `diffrev` — 合约升级前后差分审计。
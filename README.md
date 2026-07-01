# Bindata Tools

Steam 成就 .bin 文件的查看和编辑工具。

## 文件

| 文件 | 说明 |
|------|------|
| `edit_bin.js` | 命令行工具 — 解析、查询、修改、保存 .bin 文件 |
| `binviewer.html` | 网页 UI — 可视化浏览和编辑成就数据 |

## .bin 格式要点

Steam 成就 .bin 是多语言格式，每条记录中包含不同语言字段：

```
display → english → 英文名
       → token → 成就 Token
       → schinese → 中文名          ← 可选，Steam 检测到系统为中文时读取此字段
desc → english → 英文描述
     → token → 描述 Token
     → schinese → 中文描述           ← 可选
```

如果文件缺少 `schinese` 字段，即使内容包含中文，Steam 也不会显示。需要用工具将中文填入 `schinese` 字段（而非 `english` 字段）才能正常显示。

## edit_bin.js — 命令行

```bash
# 列出成就
node edit_bin.js <文件.bin> list

# 查看单个成就详情（含中文）
node edit_bin.js <文件.bin> get <序号>

# 搜索（同时搜索英文和中文）
node edit_bin.js <文件.bin> search <关键词>

# 统计
node edit_bin.js <文件.bin> stats

# 导出为 JSON（可编辑后导回）
node edit_bin.js <文件.bin> export data.json

# 从 JSON 导入修改并保存
node edit_bin.js <文件.bin> import data.json output.bin

# 直接修改字段（支持 displayName / displayNameCN / token / description / descriptionCN / descToken / hidden / icon / iconGray）
node edit_bin.js <文件.bin> set <序号> <字段> <值>

# 将中文填入 schinese 字段的示例：
node edit_bin.js stats.bin set 1 displayNameCN "抹大拉"
node edit_bin.js stats.bin set 1 descriptionCN "你解锁了抹大拉"
```

修改文件自动生成 `原文件名_modified.bin`，不覆盖原文件。

## binviewer.html — 网页 UI

浏览器直接打开，拖拽或选择 .bin 文件即可加载。

### 功能

- **解析/保存** — 读取和重新生成完整 .bin 文件
- **表格浏览** — 显示所有成就，支持多列排序
- **筛选** — 搜索关键字（同时匹配中英文）、显示/隐藏已修改条目
- **分组** — 按每 10 条分组显示
- **编辑面板** — 点击任意行打开，支持双语言编辑：
  - 显示名称 / 中文名称
  - Token
  - 描述 / 中文描述
  - 隐藏标记、图标路径
- **修改追踪** — 已修改的行有橙色标记，可一键重置
- **导出 CSV** — 含中英文双列

### 多语言编辑说明

表格默认显示中英文双列。编辑面板中：
- **英文名 / 英文描述** → 写入 `english` 字段（Steam 英文客户端读取）
- **中文名 / 中文描述** → 写入 `schinese` 字段（Steam 简体中文客户端读取）

两个语言各自独立。填写中文后保存生成的 `.bin` 文件，Steam 中文客户端即可显示对应内容。

成就文件在steam的安装目录的~\appcache\stats中。

本项目以“以撒的结合”为例。在steamdb查询到游戏id为250900，于是在stats文件夹找到UserGameStatsSchema_250900.bin
复制出来，让ai读取本项目文件和成就文件，让它自己汉化即可，将得到的文件重命名为UserGameStatsSchema_250900.bin并替换回原文件夹，将其属性改为“只读”，重启steam即可。

理论上steam所有成就没有中文的都可以这样操作，但我没试过。
如果不行就反复鞭笞ai吧(_´ω｀_)

# Achievement Localization

Steam 成就 .bin 文件的查看和编辑工具。

## 文件

| 文件 | 说明 |
|------|------|
| `edit_bin.js` | 命令行工具 — 解析、查询、修改、保存 .bin 文件 |
| `binviewer.html` | 网页 UI — 可视化浏览和编辑成就数据 |
| `patch_bin.js` | 命令行工具 — 从已汉化的 .bin 文件中提取中文并注入原始文件 |
| `patch_from_csv.js` | 命令行工具 — 从 CSV 批量导入中文到原始 .bin 文件 |

## .bin 格式要点

Steam 成就 .bin 是多段结构，每条记录中包含不同语言字段。

**段结构（ACHIEVEMENTS）：** 例如以撒的结合包含 21 个段标记（Section 0-19 为内容段，Section 20 为尾部）。前 32 条记录位于第一个段标记之前（前段区），其余记录分布在 20 个内容段中。保存时必须保留此结构，否则 Steam 无法正确解析。

**记录结构：**

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

成就文件在 Steam 安装目录的 `~/appcache/stats/` 中。

## patch_bin.js — 合并中文

从已汉化的 .bin 文件中提取中文字段，手术式注入原始 .bin 文件（不改变原始结构）。（写这个是因为测试的时候发现汉化后的bin无法使用，又懒得提取文本了，就从失败的bin文件提取算了）

```bash
node patch_bin.js <原始.bin> <已汉化.bin> <输出.bin>
```

参数说明：

| 参数 | 说明 |
|------|------|
| 第 1 个参数 | 原始无中文的 .bin 文件（默认 `原始UserGameStatsSchema_250900.bin`） |
| 第 2 个参数 | 已包含中文的 .bin 文件（默认 `成功UserGameStatsSchema_250900_chinese.bin`） |
| 第 3 个参数 | 输出文件（默认 `UserGameStatsSchema_250900.bin`） |

示例：

```bash
node patch_bin.js 原始UserGameStatsSchema_250900.bin 成功UserGameStatsSchema_250900_chinese.bin UserGameStatsSchema_250900.bin
```

工作原理：
1. 扫描原始文件找到每条记录的 `schinese` 插入位置（`display` 和 `desc` 段的 `token` 之后）
2. 从已汉化文件中提取中文字段（`displayNameCN` / `descriptionCN`）
3. 在原始文件中插入 `\x01schinese\x00<值>\x00`，完成修补

## patch_from_csv.js — 从 CSV 批量导入

将 CSV 文件中的中文翻译批量注入原始 .bin 文件（手术式修补，不改变原始结构）。

```bash
node patch_from_csv.js <csv文件> <原始.bin> <输出.bin>
```

参数说明：

| 参数 | 说明 |
|------|------|
| 第 1 个参数 | CSV 文件（默认 `achievements.csv`） |
| 第 2 个参数 | 原始 .bin 文件（默认 `原始UserGameStatsSchema_250900.bin`） |
| 第 3 个参数 | 输出文件（默认 `UserGameStatsSchema_250900.bin`） |

CSV 格式（首行为表头）：

```csv
ordinal,displayNameCN,descriptionCN
1,抹大拉,你解锁了"抹大拉"
2,该隐,你解锁了"该隐"
```

示例：

```bash
node patch_from_csv.js achievements.csv 原始UserGameStatsSchema_250900.bin UserGameStatsSchema_250900.bin
```

工作原理：
1. 扫描原始文件找到每条记录的 `schinese` 插入位置（`display` 和 `desc` 段的 `token` 之后）
2. 从 CSV 读取中文翻译（序号 + 中文名 + 中文描述）
3. 在原始文件中插入 `\x01schinese\x00<值>\x00`，完成修补

搭配 `binviewer.html` 的导出 CSV 功能使用效果最佳。

## 使用示例

本项目以”以撒的结合”为例：

1. 在 [SteamDB](https://steamdb.info/) 查询到游戏 ID 为 `250900`
2. 在 `stats` 文件夹中找到 `UserGameStatsSchema_250900.bin`
3. 复制出来，让 AI 读取本项目文件和成就文件，自行汉化，也可找到合适的汉化文本如wiki等让ai进行替换
4. 如果想自行汉化文本，可以用 `binviewer.html` 打开 .bin 文件导出为 CSV，汉化后导入即可。要将 `#` 列也导出，否则无法对应导入。CSV 中名称列为”简体中文_名称”，描述列为”简体中文_描述”，才可正确导入到相应字段
5. 将得到的文件重命名为 `UserGameStatsSchema_250900.bin` 并替换回原文件夹
6. 将文件属性改为”只读”
7. 重启 Steam

> 理论上所有 Steam 成就没有中文的游戏都可以这样操作（未验证）。

> 但是他们的字段数据格式好像不一样，你可以扔给ai重写部分代码

> 如果不行就反复鞭笞 AI 吧 相信它应该能解决问题的_(´ω｀)_

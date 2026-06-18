/**
 * 从 model_category_nodes 导出模特分类树文档到 doc/模特分类树.md
 * 须在 xinglian-server 目录执行：npm run export:model-category-tree-doc
 */
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: path.join(process.cwd(), ".env") });

type CategoryRow = {
  id: number;
  parent_id: number | null;
  type: "main" | "style" | "scene";
  name: string;
  level: number;
  is_leaf: number;
  sort_order: number;
};

const TYPE_META: Record<
  CategoryRow["type"],
  { title: string; tab: string; desc: string }
> = {
  main: { title: "模特类型", tab: "模特类型", desc: "主分类，入驻时必选至少 1 项" },
  style: { title: "风格", tab: "风格", desc: "辅助标签，可多选" },
  scene: { title: "服务场景", tab: "场景", desc: "服务场景，可多选" }
};

const HOME_MAPPING: Array<[string, string, string, string]> = [
  ["时装模特", "fashion", "[54]", "T台模特"],
  ["广告产品模特", "product", "[100, 68]", "广告模特 + 电商模特"],
  ["影视镜头模特", "film", "[101, 215]", "广告模特→影视广告 + 视频/直播模特"],
  ["活动礼仪模特", "event", "[229, 308]", "线下活动模特 + 场景→线下活动"],
  ["演员类模特", "actor", "[225]", "视频/直播模特→影视配角"],
  ["外籍模特", "foreign", "keyword「外籍」", "按分类名称关键词搜索，无固定 rootId"]
];

function walkTree(
  id: number,
  byId: Map<number, CategoryRow>,
  children: Map<number | null, number[]>,
  prefix: string,
  isLast: boolean,
  lines: string[]
): void {
  const row = byId.get(id);
  if (!row) return;
  const branch = isLast ? "└── " : "├── ";
  const suffix = row.is_leaf ? ` [叶子 id:${row.id}]` : ` (id:${row.id})`;
  lines.push(`${prefix}${branch}${row.name}${suffix}`);
  const childIds = children.get(id) || [];
  const ext = isLast ? "    " : "│   ";
  childIds.forEach((cid, i) =>
    walkTree(cid, byId, children, prefix + ext, i === childIds.length - 1, lines)
  );
}

function buildMarkdown(rows: CategoryRow[]): string {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const children = new Map<number | null, number[]>();
  for (const row of rows) {
    const pid = row.parent_id;
    if (!children.has(pid)) children.set(pid, []);
    children.get(pid)!.push(row.id);
  }

  const leafCount = rows.filter((r) => r.is_leaf).length;
  const today = new Date().toISOString().slice(0, 10);

  let md = `# 模特分类树

> 数据来源：数据库表 \`model_category_nodes\`（启用节点）  
> 生成日期：${today}  
> 统计：共 ${rows.length} 个节点，${leafCount} 个叶子节点（模特实际勾选项）

## 概述

模特分类采用**三维树形结构**，存储于 \`model_category_nodes\`，用户勾选结果存于 \`model_profile_categories\`（仅存叶子节点 ID）。

| 维度 | type 值 | 小程序 Tab | 说明 |
|------|---------|------------|------|
| 模特类型 | \`main\` | 模特类型 | 主分类，至少选 1 项 |
| 风格 | \`style\` | 风格 | 辅助标签，可多选 |
| 服务场景 | \`scene\` | 场景 | 服务场景，可多选 |

### 相关接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | \`/api/models/category-tree\` | 获取完整分类树 |
| GET | \`/api/models/categories\` | 获取当前用户已选分类 |
| PUT | \`/api/models/categories\` | 保存分类（body: \`{ categoryIds: number[] }\`） |

保存时后端校验：每个 ID 必须存在且 \`is_leaf = 1\`。

### 表结构要点

\`model_category_nodes\` 主要字段：

- \`parent_id\`：父节点 ID，根节点为 NULL
- \`type\`：\`main\` / \`style\` / \`scene\`
- \`is_leaf\`：是否叶子节点（仅叶子可被选中和保存）
- \`sort_order\`：同层排序

---

## 首页入口映射

首页 6 个卡片为**展示层聚合**，定义于 \`xinglian-miniapp/utils/home-model-categories.js\`，点击后展开对应 root 下全部叶子 ID 用于列表筛选。

| 首页名称 | key | rootIds / 规则 | 实际对应 DB 节点 |
|----------|-----|----------------|------------------|
`;

  for (const [name, key, rootIds, dbNode] of HOME_MAPPING) {
    md += `| ${name} | \`${key}\` | ${rootIds} | ${dbNode} |\n`;
  }

  md += "\n---\n\n";

  for (const type of ["main", "style", "scene"] as const) {
    const meta = TYPE_META[type];
    const lines: string[] = [];
    const roots = (children.get(null) || []).filter((id) => byId.get(id)?.type === type);
    roots.forEach((id, i) => walkTree(id, byId, children, "", i === roots.length - 1, lines));
    md += `## ${meta.title}（\`${type}\`）

${meta.desc}。共 ${roots.length} 个一级大类。

\`\`\`
${lines.join("\n")}
\`\`\`

`;
  }

  md += `---

## 附录：叶子节点 ID 速查

按 type 分列全部叶子节点，便于开发对照。

`;

  for (const type of ["main", "style", "scene"] as const) {
    const meta = TYPE_META[type];
    const leaves = rows.filter((r) => r.type === type && r.is_leaf);
    md += `### ${meta.title}（${leaves.length} 项）

`;
    for (const leaf of leaves) {
      const parent = leaf.parent_id != null ? byId.get(leaf.parent_id) : null;
      md += `- **${leaf.name}** (id:${leaf.id}) — 上级：${parent?.name ?? "-"}\n`;
    }
    md += "\n";
  }

  md += `---

## 变更说明

- 分类词条按需求文档 2.2 全量入库（见 \`需求文档.txt\`）
- 重新生成本文档：\`cd xinglian-server && npm run export:model-category-tree-doc\`
- 当前无后台分类管理界面；调整分类需直接操作 \`model_category_nodes\` 表
- 首页「时装模特」映射 rootId 54，DB 中对应节点名为「T台模特」，命名不一致需注意
`;

  return md;
}

async function main(): Promise<void> {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "xinglian",
    charset: "utf8mb4"
  });

  try {
    const [rows] = await conn.query<CategoryRow[]>(
      `SELECT id, parent_id, type, name, level, is_leaf, sort_order
       FROM model_category_nodes
       WHERE is_enabled = 1
       ORDER BY type ASC, parent_id ASC, sort_order ASC, id ASC`
    );

    const outPath = path.join(process.cwd(), "..", "doc", "模特分类树.md");
    const md = buildMarkdown(rows);
    fs.writeFileSync(outPath, md, "utf8");
    console.log(`[export-model-category-tree-doc] written: ${outPath}`);
    console.log(`[export-model-category-tree-doc] nodes=${rows.length}, leaves=${rows.filter((r) => r.is_leaf).length}`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error("[export-model-category-tree-doc] failed:", error);
  process.exit(1);
});

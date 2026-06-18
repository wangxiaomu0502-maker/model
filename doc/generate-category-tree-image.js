/**
 * 从 doc/模特分类树.txt 生成可视化分类图（HTML + SVG + PNG）
 * 用法：node doc/generate-category-tree-image.js
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname);
const TXT_PATH = path.join(ROOT, "模特分类树.txt");
const HTML_PATH = path.join(ROOT, "模特分类树.html");
const SVG_PATH = path.join(ROOT, "模特分类树.svg");
const PNG_PATH = path.join(ROOT, "模特分类树.png");

const THEMES = {
  main: {
    label: "模特类型",
    hint: "主分类 · 至少选 1 项",
    primary: "#1d4ed8",
    light: "#dbeafe",
    border: "#93c5fd",
    bg: "#f8fbff"
  },
  style: {
    label: "风格",
    hint: "辅助标签 · 可多选",
    primary: "#7c3aed",
    light: "#ede9fe",
    border: "#c4b5fd",
    bg: "#faf8ff"
  },
  scene: {
    label: "服务场景",
    hint: "服务场景 · 可多选",
    primary: "#059669",
    light: "#d1fae5",
    border: "#6ee7b7",
    bg: "#f6fffb"
  }
};

function parseTreeTxt(content) {
  const lines = content.split("\n");
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (!line.trim() || line.startsWith("模特分类树") || line.startsWith("（")) continue;
    if (/^[一二三]、/.test(line)) {
      current = { title: line.trim(), nodes: [] };
      sections.push(current);
      continue;
    }
    const match = line.match(/^((?:│   )*)(?:├── |└── )(.+)$/);
    if (!match || !current) continue;
    const depth = match[1].length / 4;
    const name = match[2].trim();
    const node = { name, depth, children: [] };

    if (depth === 0) {
      current.nodes.push(node);
      node._stackIndex = current.nodes.length - 1;
    } else {
      let parent = current.nodes[current.nodes.length - 1];
      const stack = [parent];
      for (let d = 1; d < depth; d += 1) {
        parent = parent.children[parent.children.length - 1];
        stack.push(parent);
      }
      parent.children.push(node);
    }
  }
  return sections;
}

function countLeaves(node) {
  if (!node.children.length) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderNodeBlock(node, theme, level = 0) {
  const isLeaf = node.children.length === 0;
  if (isLeaf) {
    return `<span class="leaf">${escapeHtml(node.name)}</span>`;
  }
  if (level === 0) {
    const groups = node.children
      .map(
        (child) => `<div class="group">
          <div class="group-title">${escapeHtml(child.name)}</div>
          <div class="leaf-row">${child.children.map((leaf) => renderNodeBlock(leaf, theme, 2)).join("")}</div>
        </div>`
      )
      .join("");
    return `<article class="card card--l1">
      <header class="card-head" style="background:${theme.primary}">${escapeHtml(node.name)}</header>
      <div class="card-body">${groups}</div>
    </article>`;
  }
  return `<span class="leaf">${escapeHtml(node.name)}</span>`;
}

function renderStyleSceneCard(node, theme) {
  const leaves = node.children.length
    ? node.children.map((c) => `<span class="leaf">${escapeHtml(c.name)}</span>`).join("")
    : `<span class="leaf">${escapeHtml(node.name)}</span>`;
  return `<article class="card card--compact" style="border-color:${theme.border};background:${theme.bg}">
    <header class="card-head card-head--sm" style="background:${theme.primary}">${escapeHtml(node.name)}</header>
    <div class="leaf-row">${leaves}</div>
  </article>`;
}

function buildHtml(sections) {
  const sectionHtml = sections
    .map((section, index) => {
      const themeKey = index === 0 ? "main" : index === 1 ? "style" : "scene";
      const theme = THEMES[themeKey];
      const totalLeaves = section.nodes.reduce((sum, n) => sum + countLeaves(n), 0);
      const cards =
        themeKey === "main"
          ? `<div class="grid grid--main">${section.nodes.map((n) => renderNodeBlock(n, theme)).join("")}</div>`
          : `<div class="grid grid--compact">${section.nodes.map((n) => renderStyleSceneCard(n, theme)).join("")}</div>`;

      return `<section class="section" style="--primary:${theme.primary};--light:${theme.light};--border:${theme.border};--bg:${theme.bg}">
        <div class="section-head">
          <div>
            <h2>${escapeHtml(section.title)}</h2>
            <p>${theme.hint}</p>
          </div>
          <span class="badge">${totalLeaves} 个可选项</span>
        </div>
        ${cards}
      </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>星联模特分类树</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px;
      font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
      background: #eef2f7;
      color: #0f172a;
    }
    .page {
      max-width: 1600px;
      margin: 0 auto;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);
      overflow: hidden;
    }
    .hero {
      padding: 36px 40px 28px;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
      color: #fff;
    }
    .hero h1 { margin: 0 0 8px; font-size: 34px; letter-spacing: 1px; }
    .hero p { margin: 0; opacity: 0.88; font-size: 16px; }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 18px;
      margin-top: 18px;
      font-size: 14px;
    }
    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.12);
    }
    .dot { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
    .dot--l1 { background: #1d4ed8; }
    .dot--group { background: #60a5fa; }
    .dot--leaf { background: #fef3c7; border: 1px solid #f59e0b; }
    .content { padding: 28px 32px 40px; }
    .section + .section { margin-top: 36px; }
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 18px;
      padding-bottom: 12px;
      border-bottom: 3px solid var(--primary);
    }
    .section-head h2 { margin: 0; font-size: 26px; color: var(--primary); }
    .section-head p { margin: 6px 0 0; color: #64748b; font-size: 14px; }
    .badge {
      background: var(--light);
      color: var(--primary);
      border: 1px solid var(--border);
      padding: 8px 14px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
    }
    .grid { display: grid; gap: 16px; }
    .grid--main { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid--compact { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
      background: #fff;
    }
    .card--compact { border-width: 1px; border-style: solid; }
    .card-head {
      padding: 12px 16px;
      color: #fff;
      font-size: 18px;
      font-weight: 700;
    }
    .card-head--sm { font-size: 16px; padding: 10px 14px; }
    .card-body { padding: 12px 14px 14px; display: grid; gap: 10px; }
    .group {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 12px;
    }
    .group-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 8px;
    }
    .leaf-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .leaf {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      background: #fffbeb;
      border: 1px solid #fcd34d;
      color: #92400e;
      font-size: 12px;
      line-height: 1.4;
      white-space: nowrap;
    }
    .footer {
      padding: 16px 40px 24px;
      text-align: center;
      color: #64748b;
      font-size: 13px;
      border-top: 1px solid #e2e8f0;
    }
    @media (max-width: 1200px) {
      .grid--main, .grid--compact { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="page" id="capture">
    <div class="hero">
      <h1>星联 · 模特分类树</h1>
      <p>三维分类体系 · 黄色标签为可勾选的最末级分类</p>
      <div class="legend">
        <span><i class="dot dot--l1"></i>一级大类</span>
        <span><i class="dot dot--group"></i>二级分组</span>
        <span><i class="dot dot--leaf"></i>可勾选叶子项</span>
      </div>
    </div>
    <div class="content">${sectionHtml}</div>
    <div class="footer">共 220 个可勾选分类 · 数据来源 model_category_nodes</div>
  </div>
</body>
</html>`;
}

async function htmlToPng(htmlPath, pngPath) {
  try {
    const playwright = require("playwright");
    const browser = await playwright.chromium.launch();
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
    const el = page.locator("#capture");
    await el.screenshot({ path: pngPath, type: "png" });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const content = fs.readFileSync(TXT_PATH, "utf8");
  const sections = parseTreeTxt(content);
  const html = buildHtml(sections);
  fs.writeFileSync(HTML_PATH, html, "utf8");
  console.log("HTML:", HTML_PATH);

  const pngOk = await htmlToPng(HTML_PATH, PNG_PATH);
  if (pngOk) {
    console.log("PNG:", PNG_PATH);
  } else {
    console.log("PNG: skipped (install playwright for auto PNG, or open HTML and screenshot)");
    console.log("  open", HTML_PATH);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/** 将 合同/*.txt 纯文本转为小程序 rich-text 可渲染的简易 HTML */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SECTION_LINE =
  /^(第[一二三四五六七八九十百]+条|签约方式：|鉴于：|附件[一二三四五六七八九十\d]*：|协议说明：)/;

export function contractTextToHtml(text: string): string {
  const lines = text.replace(/^\uFEFF/, "").trimEnd().split(/\n/);
  const parts: string[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed === "---") {
      parts.push("<hr/>");
      continue;
    }
    if (trimmed === "") {
      continue;
    }

    if (SECTION_LINE.test(trimmed)) {
      parts.push(`<h3>${escapeHtml(trimmed)}</h3>`);
      continue;
    }

    parts.push(`<p>${escapeHtml(trimmed)}</p>`);
  }

  return parts.join("\n");
}

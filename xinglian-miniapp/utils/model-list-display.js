function formatPriceText(value) {
  if (value == null || value === "") return "-";
  return `¥${value}`;
}

function fmtMeasure(n) {
  if (n == null || n === "") return "—";
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  const r = Math.round(x * 100) / 100;
  return Number.isInteger(r) ? String(Math.trunc(r)) : String(r);
}

function resolveMediaUrl(stored, apiBase) {
  if (!stored || !String(stored).trim()) return "";
  const s = String(stored).trim();
  if (/^https?:\/\//i.test(s)) return s;
  const b = String(apiBase || "").replace(/\/$/, "");
  const p = s.startsWith("/") ? s : `/${s}`;
  return `${b}${p}`;
}

function buildCardMeasureChips(card) {
  const m = (card && card.measurements) || {};
  const chips = [];
  const h = fmtMeasure(m.height);
  const wgt = fmtMeasure(m.weight);
  const b = fmtMeasure(m.bust);
  const waist = fmtMeasure(m.waist);
  const hip = fmtMeasure(m.hip);
  const shoulder = fmtMeasure(m.shoulder);
  const armSpan = fmtMeasure(m.armSpan);
  const leg = fmtMeasure(m.legLength);
  const shoeRaw = m.shoeSize;
  const shoeNum = fmtMeasure(shoeRaw);
  if (h !== "—") chips.push({ key: "h", text: `身高 ${h}cm` });
  if (wgt !== "—") chips.push({ key: "w", text: `体重 ${wgt}kg` });
  const trio = [];
  if (b !== "—") trio.push(b);
  if (waist !== "—") trio.push(waist);
  if (hip !== "—") trio.push(hip);
  if (trio.length) chips.push({ key: "bwh", text: `三围 ${trio.join("/")}` });
  if (shoulder !== "—") chips.push({ key: "sh", text: `肩宽 ${shoulder}` });
  if (armSpan !== "—") chips.push({ key: "arm", text: `臂展 ${armSpan}` });
  if (leg !== "—") chips.push({ key: "leg", text: `腿长 ${leg}` });
  if (shoeNum !== "—") chips.push({ key: "shoe", text: `鞋码 ${shoeNum}` });
  else if (shoeRaw != null && String(shoeRaw).trim()) {
    chips.push({ key: "shoe", text: `鞋码 ${String(shoeRaw).trim()}` });
  }
  return chips;
}

/** 模特列表展示字段归一（model-list / model-intro 共用） */
function normalizeModelList(list) {
  const app = getApp();
  const apiBase = app.globalData.apiBaseUrl || "";
  const pending = app.COS_AVATAR_PLACEHOLDER;
  const arr = Array.isArray(list) ? list : [];
  return arr.map((item) => {
    const nickname = item && item.nickname ? String(item.nickname) : "";
    const avatarText = nickname ? nickname.slice(0, 1) : "模";
    const rawAvatar =
      item && item.avatarUrl != null && String(item.avatarUrl).trim()
        ? String(item.avatarUrl).trim()
        : "";
    const showAvatarImg = Boolean(rawAvatar && rawAvatar !== pending);
    const avatarDisplayUrl = app.resolveAvatarUrl(rawAvatar || null, apiBase);
    const card = item && item.card ? item.card : {};
    const angles = Array.isArray(card.photoAngles) ? card.photoAngles : [];
    const cardThumbUrls = angles.map((a) => resolveMediaUrl(a && a.url, apiBase)).filter(Boolean);
    const cardMeasureChips = buildCardMeasureChips(card);
    const hasCardSection = cardThumbUrls.length > 0 || cardMeasureChips.length > 0;
    const coverImageUrl = cardThumbUrls[0] || (showAvatarImg ? avatarDisplayUrl : "");
    return {
      ...item,
      avatarText,
      showAvatarImg,
      avatarDisplayUrl,
      hourlyText: formatPriceText(item?.price?.hourly),
      halfDayText: formatPriceText(item?.price?.halfDay),
      fullDayText: formatPriceText(item?.price?.fullDay),
      cardThumbUrls,
      cardMeasureChips,
      hasCardSection,
      coverImageUrl,
      showCoverImage: Boolean(coverImageUrl)
    };
  });
}

module.exports = { normalizeModelList };

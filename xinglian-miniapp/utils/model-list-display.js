function formatPriceText(value) {
  if (value == null || value === "") return "-";
  return `¥${value}`;
}

function normalizeGenderLabel(value) {
  const s = value == null ? "" : String(value).trim();
  if (s === "男" || /^m(ale)?$/i.test(s) || s === "1") return "男";
  if (s === "女" || /^f(emale)?$/i.test(s) || s === "2") return "女";
  return "";
}

function toFiniteNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeModelLevel(value) {
  const v = value && typeof value === "object" ? value : {};
  const level = Math.max(0, Math.min(5, Number(v.level) || 0));
  return {
    level,
    code: v.code ? String(v.code) : `LV${level}`,
    name: v.name ? String(v.name) : "初星模特",
    temperament: v.temperament ? String(v.temperament) : "刚被看见",
    requirement: v.requirement ? String(v.requirement) : "完成账号注册",
    source: v.source === "admin" ? "admin" : "auto"
  };
}

const PROVINCE_CITY_MAP = {
  北京市: ["北京市"],
  天津市: ["天津市"],
  上海市: ["上海市"],
  重庆市: ["重庆市"],
  河北省: ["石家庄市", "唐山市", "秦皇岛市", "邯郸市", "邢台市", "保定市", "张家口市", "承德市", "沧州市", "廊坊市", "衡水市"],
  山西省: ["太原市", "大同市", "阳泉市", "长治市", "晋城市", "朔州市", "晋中市", "运城市", "忻州市", "临汾市", "吕梁市"],
  辽宁省: ["沈阳市", "大连市", "鞍山市", "抚顺市", "本溪市", "丹东市", "锦州市", "营口市", "阜新市", "辽阳市", "盘锦市", "铁岭市", "朝阳市", "葫芦岛市"],
  吉林省: ["长春市", "吉林市", "四平市", "辽源市", "通化市", "白山市", "松原市", "白城市", "延边朝鲜族自治州"],
  黑龙江省: ["哈尔滨市", "齐齐哈尔市", "鸡西市", "鹤岗市", "双鸭山市", "大庆市", "伊春市", "佳木斯市", "七台河市", "牡丹江市", "黑河市", "绥化市", "大兴安岭地区"],
  江苏省: ["南京市", "无锡市", "徐州市", "常州市", "苏州市", "南通市", "连云港市", "淮安市", "盐城市", "扬州市", "镇江市", "泰州市", "宿迁市"],
  浙江省: ["杭州市", "宁波市", "温州市", "嘉兴市", "湖州市", "绍兴市", "金华市", "衢州市", "舟山市", "台州市", "丽水市"],
  安徽省: ["合肥市", "芜湖市", "蚌埠市", "淮南市", "马鞍山市", "淮北市", "铜陵市", "安庆市", "黄山市", "滁州市", "阜阳市", "宿州市", "六安市", "亳州市", "池州市", "宣城市"],
  福建省: ["福州市", "厦门市", "莆田市", "三明市", "泉州市", "漳州市", "南平市", "龙岩市", "宁德市"],
  江西省: ["南昌市", "景德镇市", "萍乡市", "九江市", "新余市", "鹰潭市", "赣州市", "吉安市", "宜春市", "抚州市", "上饶市"],
  山东省: ["济南市", "青岛市", "淄博市", "枣庄市", "东营市", "烟台市", "潍坊市", "济宁市", "泰安市", "威海市", "日照市", "临沂市", "德州市", "聊城市", "滨州市", "菏泽市"],
  河南省: ["郑州市", "开封市", "洛阳市", "平顶山市", "安阳市", "鹤壁市", "新乡市", "焦作市", "濮阳市", "许昌市", "漯河市", "三门峡市", "南阳市", "商丘市", "信阳市", "周口市", "驻马店市"],
  湖北省: ["武汉市", "黄石市", "十堰市", "宜昌市", "襄阳市", "鄂州市", "荆门市", "孝感市", "荆州市", "黄冈市", "咸宁市", "随州市", "恩施土家族苗族自治州"],
  湖南省: ["长沙市", "株洲市", "湘潭市", "衡阳市", "邵阳市", "岳阳市", "常德市", "张家界市", "益阳市", "郴州市", "永州市", "怀化市", "娄底市", "湘西土家族苗族自治州"],
  广东省: ["广州市", "深圳市", "珠海市", "汕头市", "佛山市", "韶关市", "湛江市", "肇庆市", "江门市", "茂名市", "惠州市", "梅州市", "汕尾市", "河源市", "阳江市", "清远市", "东莞市", "中山市", "潮州市", "揭阳市", "云浮市"],
  海南省: ["海口市", "三亚市", "三沙市", "儋州市"],
  四川省: ["成都市", "自贡市", "攀枝花市", "泸州市", "德阳市", "绵阳市", "广元市", "遂宁市", "内江市", "乐山市", "南充市", "眉山市", "宜宾市", "广安市", "达州市", "雅安市", "巴中市", "资阳市", "阿坝藏族羌族自治州", "甘孜藏族自治州", "凉山彝族自治州"],
  贵州省: ["贵阳市", "六盘水市", "遵义市", "安顺市", "毕节市", "铜仁市", "黔西南布依族苗族自治州", "黔东南苗族侗族自治州", "黔南布依族苗族自治州"],
  云南省: ["昆明市", "曲靖市", "玉溪市", "保山市", "昭通市", "丽江市", "普洱市", "临沧市", "楚雄彝族自治州", "红河哈尼族彝族自治州", "文山壮族苗族自治州", "西双版纳傣族自治州", "大理白族自治州", "德宏傣族景颇族自治州", "怒江傈僳族自治州", "迪庆藏族自治州"],
  陕西省: ["西安市", "铜川市", "宝鸡市", "咸阳市", "渭南市", "延安市", "汉中市", "榆林市", "安康市", "商洛市"],
  甘肃省: ["兰州市", "嘉峪关市", "金昌市", "白银市", "天水市", "武威市", "张掖市", "平凉市", "酒泉市", "庆阳市", "定西市", "陇南市", "临夏回族自治州", "甘南藏族自治州"],
  青海省: ["西宁市", "海东市", "海北藏族自治州", "黄南藏族自治州", "海南藏族自治州", "果洛藏族自治州", "玉树藏族自治州", "海西蒙古族藏族自治州"],
  内蒙古自治区: ["呼和浩特市", "包头市", "乌海市", "赤峰市", "通辽市", "鄂尔多斯市", "呼伦贝尔市", "巴彦淖尔市", "乌兰察布市", "兴安盟", "锡林郭勒盟", "阿拉善盟"],
  广西壮族自治区: ["南宁市", "柳州市", "桂林市", "梧州市", "北海市", "防城港市", "钦州市", "贵港市", "玉林市", "百色市", "贺州市", "河池市", "来宾市", "崇左市"],
  西藏自治区: ["拉萨市", "日喀则市", "昌都市", "林芝市", "山南市", "那曲市", "阿里地区"],
  宁夏回族自治区: ["银川市", "石嘴山市", "吴忠市", "固原市", "中卫市"],
  新疆维吾尔自治区: ["乌鲁木齐市", "克拉玛依市", "吐鲁番市", "哈密市", "昌吉回族自治州", "博尔塔拉蒙古自治州", "巴音郭楞蒙古自治州", "阿克苏地区", "克孜勒苏柯尔克孜自治州", "喀什地区", "和田地区", "伊犁哈萨克自治州", "塔城地区", "阿勒泰地区"],
  香港特别行政区: ["香港特别行政区"],
  澳门特别行政区: ["澳门特别行政区"],
  台湾省: ["台北市", "高雄市", "台中市", "台南市", "新北市", "桃园市"]
};

const PROVINCES = ["全部省份", ...Object.keys(PROVINCE_CITY_MAP)];
const ALL_CITY = "全部城市";
const MODEL_LEVEL_FILTERS = ["全部等级", "LV5 天幕", "LV4 皇冠", "LV3 星芒", "LV2 风暴", "LV1 新锐", "LV0 初星"];
const MODEL_LEVEL_VALUES = ["", "5", "4", "3", "2", "1", "0"];

function buildRegionColumns(regionIndex) {
  const provinceIndex = Math.max(0, Number((regionIndex || [])[0]) || 0);
  const province = PROVINCES[provinceIndex] || PROVINCES[0];
  const cities = provinceIndex > 0 ? [ALL_CITY, ...(PROVINCE_CITY_MAP[province] || [])] : [ALL_CITY];
  return [PROVINCES, cities];
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

function sortFeaturedModelsByLevel(list) {
  return [...list]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const al = Number(a.item?.modelLevel?.level) || 0;
      const bl = Number(b.item?.modelLevel?.level) || 0;
      if (bl !== al) return bl - al;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

function pickFeaturedModels(list, limit = 10) {
  return sortFeaturedModelsByLevel(list).slice(0, limit);
}

/** 模特列表展示字段归一（model-list / home 推荐模块共用） */
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
    const categoryNames = Array.isArray(item?.categories) ? item.categories : [];
    const categoryIds = Array.isArray(item?.categoryIds)
      ? item.categoryIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : [];
    const categoryItems = categoryNames.map((name, idx) => ({
      id: categoryIds[idx] || 0,
      name: String(name || "").trim()
    })).filter((category) => category.name);
    const modelLevel = normalizeModelLevel(item?.modelLevel);
    return {
      ...item,
      categoryIds,
      categoryItems,
      modelLevel,
      modelLevelText: `${modelLevel.code} ${modelLevel.name}`,
      isPlatformFeatured: Number(modelLevel.level) === 5,
      genderLabel: normalizeGenderLabel(item?.gender),
      avatarText,
      showAvatarImg,
      avatarDisplayUrl,
      ratingScore: 5,
      ratingText: "5.0",
      hourlyPriceValue: toFiniteNumber(item?.price?.hourly),
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

function uniqueTextValues(values) {
  const set = new Set();
  values.forEach((value) => {
    const text = value == null ? "" : String(value).trim();
    if (text) set.add(text);
  });
  return Array.from(set);
}

function buildModelFilterOptions(list) {
  const arr = Array.isArray(list) ? list : [];
  return {
    cities: ["全部地域", ...uniqueTextValues(arr.map((item) => item.city))],
    regionColumns: buildRegionColumns([0, 0]),
    genders: ["全部性别", "女", "男"],
    prices: ["默认价格", "小时价低到高", "小时价高到低"],
    ratings: ["默认评分", "评分高到低"],
    levels: MODEL_LEVEL_FILTERS
  };
}

function defaultModelFilterState() {
  return {
    cityIndex: 0,
    regionIndex: [0, 0],
    genderIndex: 0,
    priceIndex: 0,
    ratingIndex: 0,
    levelIndex: 0,
    categoryIds: []
  };
}

function normalizeCategoryIds(ids) {
  if (!Array.isArray(ids)) return [];
  return Array.from(
    new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))
  );
}

function getSelectedRegion(state) {
  const regionIndex = state?.regionIndex || [0, 0];
  const provinceIndex = Math.max(0, Number(regionIndex[0]) || 0);
  const cityIndex = Math.max(0, Number(regionIndex[1]) || 0);
  const province = PROVINCES[provinceIndex] || "";
  const cityOptions = provinceIndex > 0 ? [ALL_CITY, ...(PROVINCE_CITY_MAP[province] || [])] : [ALL_CITY];
  const city = cityOptions[cityIndex] || ALL_CITY;
  return {
    province: provinceIndex > 0 ? province : "",
    city: cityIndex > 0 ? city : "",
    text: provinceIndex === 0 ? "全部地域" : cityIndex > 0 ? city : province
  };
}

function updateRegionColumnsByColumnChange(regionIndex, column, value) {
  const next = Array.isArray(regionIndex) ? [...regionIndex] : [0, 0];
  next[column] = Number(value) || 0;
  if (Number(column) === 0) next[1] = 0;
  return {
    regionIndex: next,
    regionColumns: buildRegionColumns(next)
  };
}

function sortByNullableNumber(list, getter, direction) {
  return [...list].sort((a, b) => {
    const av = getter(a);
    const bv = getter(b);
    const aMissing = av == null;
    const bMissing = bv == null;
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    return direction === "desc" ? bv - av : av - bv;
  });
}

function applyModelFilters(list, options, state) {
  const arr = Array.isArray(list) ? list : [];
  const opts = options || buildModelFilterOptions(arr);
  const s = { ...defaultModelFilterState(), ...(state || {}) };
  const region = getSelectedRegion(s);
  const city = opts.cities[s.cityIndex] || "";
  const gender = opts.genders[s.genderIndex] || "";
  const levelValue = MODEL_LEVEL_VALUES[s.levelIndex] || "";
  const categoryIds = normalizeCategoryIds(s.categoryIds);

  let result = arr.filter((item) => {
    if (region.city) {
      const itemCity = String(item.city || "").trim();
      if (itemCity !== `${region.province} ${region.city}` && itemCity !== region.city) return false;
    } else if (region.province && !String(item.city || "").trim().startsWith(region.province)) {
      return false;
    } else if (!region.province && s.cityIndex > 0 && String(item.city || "").trim() !== city) return false;
    if (s.genderIndex > 0 && String(item.gender || "").trim() !== gender) return false;
    if (levelValue && Number(item?.modelLevel?.level) !== Number(levelValue)) return false;
    if (categoryIds.length > 0) {
      const ids = Array.isArray(item.categoryIds) ? item.categoryIds : [];
      if (!categoryIds.some((id) => ids.some((itemId) => Number(itemId) === id))) return false;
    }
    return true;
  });

  if (s.priceIndex === 1) {
    result = sortByNullableNumber(result, (item) => item.hourlyPriceValue, "asc");
  } else if (s.priceIndex === 2) {
    result = sortByNullableNumber(result, (item) => item.hourlyPriceValue, "desc");
  }

  if (s.ratingIndex === 1) {
    result = sortByNullableNumber(result, (item) => item.ratingScore, "desc");
  }

  return result;
}

function countActiveModelFilters(state) {
  const s = { ...defaultModelFilterState(), ...(state || {}) };
  const regionActive = Array.isArray(s.regionIndex) && Number(s.regionIndex[0]) > 0 ? 1 : 0;
  const categoryActive = normalizeCategoryIds(s.categoryIds).length > 0 ? 1 : 0;
  return (
    regionActive +
    [s.genderIndex, s.priceIndex, s.ratingIndex, s.levelIndex].filter((idx) => idx > 0).length +
    categoryActive
  );
}

function buildModelFilterQuery(options, state) {
  const opts = options || buildModelFilterOptions([]);
  const s = { ...defaultModelFilterState(), ...(state || {}) };
  const params = [];
  const region = getSelectedRegion(s);
  const gender = opts.genders && opts.genders[s.genderIndex];
  const levelValue = MODEL_LEVEL_VALUES[s.levelIndex] || "";
  const categoryIds = normalizeCategoryIds(s.categoryIds);
  if (region.province) params.push(["province", region.province]);
  if (region.city) params.push(["city", region.city]);
  if (s.genderIndex > 0 && gender) params.push(["gender", gender]);
  if (categoryIds.length > 0) params.push(["categoryIds", categoryIds.join(",")]);
  if (levelValue) params.push(["modelLevel", levelValue]);
  if (s.priceIndex === 1) params.push(["priceSort", "asc"]);
  if (s.priceIndex === 2) params.push(["priceSort", "desc"]);
  if (s.ratingIndex === 1) params.push(["ratingSort", "desc"]);
  if (!params.length) return "";
  return `?${params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")}`;
}

module.exports = {
  normalizeModelList,
  pickFeaturedModels,
  sortFeaturedModelsByLevel,
  buildModelFilterOptions,
  defaultModelFilterState,
  normalizeCategoryIds,
  buildRegionColumns,
  getSelectedRegion,
  updateRegionColumnsByColumnChange,
  applyModelFilters,
  countActiveModelFilters,
  buildModelFilterQuery
};

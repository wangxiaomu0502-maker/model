<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import type { ElTree } from "element-plus";
import { Plus, UploadFilled } from "@element-plus/icons-vue";
import type { UploadRequestOptions } from "element-plus";

import {
  CITY_CASCADER_OPTIONS,
  cascaderValueToCityText,
  cityTextToCascaderValue
} from "@/constants/province-city";
import {
  DEFAULT_MODEL_MEASUREMENTS,
  MODEL_CARD_MAX_PHOTOS,
  MODEL_HAIR_COLORS,
  MODEL_MEASUREMENT_FIELDS,
  MODEL_PORTFOLIO_MAX_FOLDERS,
  MODEL_PORTFOLIO_MAX_PHOTOS,
  MODEL_SKIN_COLORS,
  MODEL_STYLE_MAX_PHOTOS
} from "@/constants/model-form";
import {
  createAdminModel,
  fetchAdminAgentUsers,
  fetchAdminModelCategoryTree,
  updateAdminModel,
  uploadAdminModelImage,
  type AdminModelBasicInfo,
  type AdminModelCategoryTreeNode,
  type AdminModelCreateBody,
  type AdminUserRow
} from "@/api/admin";

const visible = defineModel<boolean>("visible", { default: false });

const props = defineProps<{
  editingModel?: AdminModelBasicInfo | null;
}>();

const emit = defineEmits<{
  created: [];
  updated: [];
}>();

type TabKey = "basic" | "categories" | "card" | "pricing" | "order" | "style" | "portfolio";

const saving = ref(false);
const tabSaving = ref<TabKey | null>(null);
const activeTab = ref<TabKey>("basic");
const tabSaved = ref<Record<TabKey, boolean>>({
  basic: false,
  categories: false,
  card: false,
  pricing: false,
  order: false,
  style: false,
  portfolio: false
});
type CategoryGroupKey = "main" | "style" | "scene";

type CategoryLeafMeta = {
  id: number;
  group: string;
  leafName: string;
  breadcrumb: string;
};

const CATEGORY_GROUP_ORDER: CategoryGroupKey[] = ["main", "style", "scene"];

const categoryTreeLoading = ref(false);
const categorySections = ref<
  Array<{ key: CategoryGroupKey; label: string; tree: AdminModelCategoryTreeNode[] }>
>([]);
const categoryLeafIndex = ref<Map<number, CategoryLeafMeta>>(new Map());
const categoryCollapseActive = ref<CategoryGroupKey[]>([...CATEGORY_GROUP_ORDER]);
const categoryFilter = ref("");
const categoryTreeRefs = new Map<CategoryGroupKey, InstanceType<typeof ElTree>>();
const agentOptions = ref<AdminUserRow[]>([]);
const isEditMode = computed(() => Boolean(props.editingModel?.userId));

const categoryTreeProps = { label: "name", children: "children" };

const form = reactive({
  avatarUrl: "",
  agentUserId: null as number | null,
  status: 1,
  name: "",
  gender: "女" as "女" | "男",
  birthDate: "",
  cityCascader: [] as string[],
  intro: "",
  phone: "",
  categoryIds: [] as number[],
  cardPhotos: [] as Array<{ id: string; url: string }>,
  measurements: { ...DEFAULT_MODEL_MEASUREMENTS } as Record<string, string>,
  hairColor: MODEL_HAIR_COLORS[0],
  skinColor: MODEL_SKIN_COLORS[0],
  hourly: "",
  halfDay: "",
  fullDay: "",
  orderEnabled: true,
  onlyLocal: false,
  onlyFemale: false,
  stylePhotos: [] as Array<{ id: string; url: string }>,
  portfolioFolders: [] as Array<{ id: string; name: string; coverPhotoId?: string }>,
  portfolioPhotos: [] as Array<{ id: string; folderId: string; url: string }>
});

const cardPhotoCount = computed(() => form.cardPhotos.length);
const stylePhotoCount = computed(() => form.stylePhotos.length);
const portfolioPhotoCount = computed(() => form.portfolioPhotos.length);

const canAddMoreCardPhotos = computed(() => form.cardPhotos.length < MODEL_CARD_MAX_PHOTOS);
const canAddMoreStylePhotos = computed(() => form.stylePhotos.length < MODEL_STYLE_MAX_PHOTOS);
const canAddMorePortfolioPhotos = computed(() => form.portfolioPhotos.length < MODEL_PORTFOLIO_MAX_PHOTOS);
const canAddPortfolioFolder = computed(() => form.portfolioFolders.length < MODEL_PORTFOLIO_MAX_FOLDERS);

const selectedCategories = computed(() => {
  return form.categoryIds
    .map((id) => categoryLeafIndex.value.get(id))
    .filter((c): c is CategoryLeafMeta => Boolean(c))
    .sort((a, b) => {
      const go = a.group.localeCompare(b.group, "zh-CN");
      if (go !== 0) return go;
      return a.breadcrumb.localeCompare(b.breadcrumb, "zh-CN");
    });
});

function countSelectedInGroup(groupLabel: string): number {
  let n = 0;
  for (const id of form.categoryIds) {
    if (categoryLeafIndex.value.get(id)?.group === groupLabel) n += 1;
  }
  return n;
}

function categoryCollapseTitle(sec: { key: CategoryGroupKey; label: string }): string {
  const n = countSelectedInGroup(sec.label);
  return n > 0 ? `${sec.label}（已选 ${n}）` : sec.label;
}

const savedSuffix = (key: TabKey) => (tabSaved.value[key] ? " ✓" : "");

const tabLabels = computed(() => {
  const n = form.categoryIds.length;
  const catBase = n > 0 ? `模特分类（已选 ${n}）` : "模特分类";
  return {
    basic: `基本信息${savedSuffix("basic")}`,
    categories: `${catBase}${savedSuffix("categories")}`,
    card: `模卡（${cardPhotoCount.value} 张）${savedSuffix("card")}`,
    pricing: `服务价格${savedSuffix("pricing")}`,
    order: `接单设置${savedSuffix("order")}`,
    style: `形象定位（${stylePhotoCount.value} 张）${savedSuffix("style")}`,
    portfolio: `作品集（${portfolioPhotoCount.value} 张）${savedSuffix("portfolio")}`
  };
});

function setCategoryTreeRef(key: CategoryGroupKey, el: unknown) {
  if (el) categoryTreeRefs.set(key, el as InstanceType<typeof ElTree>);
  else categoryTreeRefs.delete(key);
}

function categoryTreeRefFn(key: CategoryGroupKey) {
  return (el: unknown) => setCategoryTreeRef(key, el);
}

function indexCategoryLeaves(
  nodes: AdminModelCategoryTreeNode[],
  groupLabel: string,
  parentPath: string,
  map: Map<number, CategoryLeafMeta>
) {
  for (const n of nodes) {
    const path = parentPath ? `${parentPath} › ${n.name}` : n.name;
    if (!n.children?.length) {
      map.set(n.id, { id: n.id, group: groupLabel, leafName: n.name, breadcrumb: path });
    } else {
      indexCategoryLeaves(n.children, groupLabel, path, map);
    }
  }
}

function rebuildCategoryLeafIndex() {
  const map = new Map<number, CategoryLeafMeta>();
  for (const sec of categorySections.value) {
    indexCategoryLeaves(sec.tree, sec.label, "", map);
  }
  categoryLeafIndex.value = map;
}

function syncCategoryIdsFromTrees() {
  const ids: number[] = [];
  for (const key of CATEGORY_GROUP_ORDER) {
    const tree = categoryTreeRefs.get(key);
    if (tree) {
      const keys = tree.getCheckedKeys(true) as Array<number | string>;
      for (const k of keys) {
        const id = Number(k);
        if (Number.isFinite(id) && id > 0) ids.push(id);
      }
    }
  }
  form.categoryIds = [...new Set(ids)];
}

function applyCheckedKeysToTrees() {
  void nextTick(() => {
    for (const key of CATEGORY_GROUP_ORDER) {
      const tree = categoryTreeRefs.get(key);
      if (tree) tree.setCheckedKeys([...form.categoryIds], false);
    }
  });
}

function onCategoryTreeCheck() {
  syncCategoryIdsFromTrees();
}

function filterCategoryNode(value: string, data: AdminModelCategoryTreeNode): boolean {
  const q = String(value || "").trim();
  if (!q) return true;
  const name = String(data.name || "");
  if (name.includes(q)) return true;
  if (data.children?.some((ch) => filterCategoryNode(value, ch))) return true;
  return false;
}

function removeCategory(id: number) {
  form.categoryIds = form.categoryIds.filter((x) => x !== id);
  applyCheckedKeysToTrees();
}

function clearAllCategories() {
  form.categoryIds = [];
  applyCheckedKeysToTrees();
}

function resetForm() {
  form.avatarUrl = "";
  form.agentUserId = null;
  form.status = 1;
  form.name = "";
  form.gender = "女";
  form.birthDate = "";
  form.cityCascader = [];
  form.intro = "";
  form.phone = "";
  form.categoryIds = [];
  form.cardPhotos = [];
  Object.assign(form.measurements, DEFAULT_MODEL_MEASUREMENTS);
  form.hairColor = MODEL_HAIR_COLORS[0];
  form.skinColor = MODEL_SKIN_COLORS[0];
  form.hourly = "";
  form.halfDay = "";
  form.fullDay = "";
  form.orderEnabled = true;
  form.onlyLocal = false;
  form.onlyFemale = false;
  form.stylePhotos = [];
  form.portfolioFolders = [];
  form.portfolioPhotos = [];
  activeTab.value = "basic";
  tabSaved.value = {
    basic: false,
    categories: false,
    card: false,
    pricing: false,
    order: false,
    style: false,
    portfolio: false
  };
}

function applyModelToForm(model: AdminModelBasicInfo) {
  form.avatarUrl = model.avatarUrl || "";
  form.agentUserId = model.agentUserId ?? null;
  form.status = Number(model.status || 1);
  form.name = model.name || model.nickname || "";
  form.gender = model.gender === "男" ? "男" : "女";
  form.birthDate = model.birthDate || "";
  form.cityCascader = cityTextToCascaderValue(model.city || "");
  form.intro = model.intro || "";
  form.phone = model.phone || "";
  form.categoryIds = Array.isArray(model.categories) ? model.categories.map((c) => Number(c.id)) : [];
  form.cardPhotos = (model.card?.photoAngles || [])
    .map((p, index) => {
      const url = String(p.url || "").trim();
      return url ? { id: String(p.key || `card_${index}`), url } : null;
    })
    .filter((p): p is { id: string; url: string } => Boolean(p));
  Object.assign(form.measurements, DEFAULT_MODEL_MEASUREMENTS);
  for (const f of MODEL_MEASUREMENT_FIELDS) {
    const v = model.card?.measurements?.[f.key];
    form.measurements[f.key] = v != null && String(v).trim() !== "" ? String(v) : "";
  }
  form.hairColor = model.card?.hairColor || MODEL_HAIR_COLORS[0];
  form.skinColor = model.card?.skinColor || MODEL_SKIN_COLORS[0];
  form.hourly = model.price?.hourly != null ? String(model.price.hourly) : "";
  form.halfDay = model.price?.halfDay != null ? String(model.price.halfDay) : "";
  form.fullDay = model.price?.fullDay != null ? String(model.price.fullDay) : "";
  form.orderEnabled = Boolean(model.orderSettings?.orderEnabled);
  form.onlyLocal = Boolean(model.orderSettings?.onlyLocal);
  form.onlyFemale = Boolean(model.orderSettings?.onlyFemale);
  form.stylePhotos = (model.stylePosition?.photos || []).map((p, index) => ({
    id: String(p.id || `sp_${index}`),
    url: p.url
  }));
  form.portfolioFolders = (model.portfolio?.folders || []).map((f) => ({
    id: f.id,
    name: f.name,
    coverPhotoId: f.coverPhotoId
  }));
  form.portfolioPhotos = (model.portfolio?.photos || []).map((p, index) => ({
    id: String(p.id || `p_${index}`),
    folderId: p.folderId,
    url: p.url
  }));
  activeTab.value = "basic";
  tabSaved.value = {
    basic: false,
    categories: false,
    card: false,
    pricing: false,
    order: false,
    style: false,
    portfolio: false
  };
  applyCheckedKeysToTrees();
}

function validateBasicRequired(): string | null {
  if (!form.name.trim()) return "请填写艺名/姓名";
  if (!/^1\d{10}$/.test(form.phone.trim())) return "请填写正确的手机号";
  return null;
}

function validateTab(key: TabKey): string | null {
  if (key === "basic") {
    return validateBasicRequired();
  }
  if (key === "categories") {
    return null;
  }
  if (key === "card") {
    return null;
  }
  if (key === "pricing") {
    const hasAny = Boolean(form.hourly || form.halfDay || form.fullDay);
    if (!hasAny) return null;
    if (!Number(form.hourly) || !Number(form.halfDay) || !Number(form.fullDay)) {
      return "填写价格时请补全小时价、半天价、全天价";
    }
    return null;
  }
  if (key === "order") {
    return null;
  }
  if (key === "style") {
    return null;
  }
  if (key === "portfolio") {
    if (form.portfolioFolders.length && !form.portfolioPhotos.length) {
      return "已建文件夹时请至少上传 1 张作品图";
    }
    for (const f of form.portfolioFolders) {
      if (!String(f.name || "").trim()) return "请填写文件夹名称";
    }
    for (const p of form.portfolioPhotos) {
      if (!form.portfolioFolders.some((f) => f.id === p.folderId)) {
        return "存在未关联文件夹的作品图，请重新上传";
      }
    }
    return null;
  }
  return null;
}

async function saveTab(key: TabKey) {
  const err = validateTab(key);
  if (err) {
    ElMessage.warning(err);
    return;
  }
  tabSaving.value = key;
  try {
    await new Promise((r) => setTimeout(r, 120));
    tabSaved.value[key] = true;
    const hints: Record<TabKey, string> = {
      basic: "基本信息已保存",
      categories: "模特分类已保存",
      card: "模卡已保存",
      pricing: "服务价格已保存",
      order: "接单设置已保存",
      style: "风格定位已保存（可为空）",
      portfolio: "作品集已保存（可为空）"
    };
    ElMessage.success(hints[key]);
  } finally {
    tabSaving.value = null;
  }
}

async function loadCategoryTree() {
  categoryTreeLoading.value = true;
  try {
    const tree = await fetchAdminModelCategoryTree();
    categorySections.value = [
      { key: "main", label: "主类型", tree: tree.mainTypeGroups || [] },
      { key: "style", label: "风格", tree: tree.styleGroups || [] },
      { key: "scene", label: "场景", tree: tree.sceneGroups || [] }
    ];
    rebuildCategoryLeafIndex();
    categoryCollapseActive.value = [...CATEGORY_GROUP_ORDER];
    applyCheckedKeysToTrees();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "分类加载失败");
  } finally {
    categoryTreeLoading.value = false;
  }
}

watch(activeTab, (tab) => {
  if (tab === "categories" && !categoryTreeLoading.value && categorySections.value.length) {
    applyCheckedKeysToTrees();
  }
});

watch(categoryFilter, () => {
  if (activeTab.value === "categories") {
    applyCheckedKeysToTrees();
  }
});

async function loadAgents() {
  try {
    const { list } = await fetchAdminAgentUsers();
    agentOptions.value = list;
  } catch {
    agentOptions.value = [];
  }
}

watch(visible, (open) => {
  if (open) {
    resetForm();
    if (props.editingModel) {
      applyModelToForm(props.editingModel);
    }
    void loadCategoryTree();
    void loadAgents();
  }
});

async function doUpload(kind: "avatar" | "card" | "portfolio" | "style", file: File): Promise<string> {
  return uploadAdminModelImage(kind, file);
}

async function handleAvatarUpload(opt: UploadRequestOptions) {
  const raw = opt.file as File;
  try {
    form.avatarUrl = await doUpload("avatar", raw);
    ElMessage.success("头像已上传");
    opt.onSuccess?.({});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "上传失败";
    ElMessage.error(msg);
    opt.onError?.(e as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0]);
  }
}

function handleCardUpload(opt: UploadRequestOptions) {
  const raw = opt.file as File;
  if (form.cardPhotos.length >= MODEL_CARD_MAX_PHOTOS) {
    ElMessage.warning(`模卡最多上传 ${MODEL_CARD_MAX_PHOTOS} 张`);
    opt.onError?.(new Error("limit") as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0]);
    return;
  }
  addCardPhoto(raw)
    .then(() => {
      ElMessage.success("已上传");
      opt.onSuccess?.({});
    })
    .catch((e: unknown) => {
      ElMessage.error(e instanceof Error ? e.message : "上传失败");
      opt.onError?.(e as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0]);
    });
}

function handleStyleUpload(opt: UploadRequestOptions) {
  const raw = opt.file as File;
  if (form.stylePhotos.length >= MODEL_STYLE_MAX_PHOTOS) {
    ElMessage.warning(`形象定位最多上传 ${MODEL_STYLE_MAX_PHOTOS} 张`);
    opt.onError?.(new Error("limit") as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0]);
    return;
  }
  addStylePhoto(raw)
    .then(() => {
      ElMessage.success("已上传");
      opt.onSuccess?.({});
    })
    .catch((e: unknown) => {
      ElMessage.error(e instanceof Error ? e.message : "上传失败");
      opt.onError?.(e as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0]);
    });
}

function makePortfolioUploadHandler(folderId: string) {
  return (opt: UploadRequestOptions) => handlePortfolioUpload(folderId, opt);
}

function handlePortfolioUpload(folderId: string, opt: UploadRequestOptions) {
  const raw = opt.file as File;
  if (form.portfolioPhotos.length >= MODEL_PORTFOLIO_MAX_PHOTOS) {
    ElMessage.warning(`作品集最多上传 ${MODEL_PORTFOLIO_MAX_PHOTOS} 张`);
    opt.onError?.(new Error("limit") as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0]);
    return;
  }
  addPortfolioPhoto(folderId, raw)
    .then(() => {
      ElMessage.success("已上传");
      opt.onSuccess?.({});
    })
    .catch((e: unknown) => {
      ElMessage.error(e instanceof Error ? e.message : "上传失败");
      opt.onError?.(e as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0]);
    });
}

async function addCardPhoto(file: File) {
  const url = await doUpload("card", file);
  form.cardPhotos.push({ id: `card_${Date.now()}_${form.cardPhotos.length}`, url });
}

function removeCardPhoto(id: string) {
  form.cardPhotos = form.cardPhotos.filter((p) => p.id !== id);
}

function buildCardPhotoAnglesPayload() {
  return form.cardPhotos.map((p, i) => ({
    key: `photo_${i + 1}`,
    url: p.url,
    width: 0,
    height: 0
  }));
}

async function addStylePhoto(file: File) {
  const url = await doUpload("style", file);
  form.stylePhotos.push({ id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, url });
}

function removeStylePhoto(id: string) {
  form.stylePhotos = form.stylePhotos.filter((p) => p.id !== id);
}

function portfolioPhotosInFolder(folderId: string) {
  return form.portfolioPhotos.filter((p) => p.folderId === folderId);
}

function portfolioFolderCoverUrl(folder: { id: string; coverPhotoId?: string }): string {
  const photos = portfolioPhotosInFolder(folder.id);
  if (folder.coverPhotoId) {
    const found = photos.find((p) => p.id === folder.coverPhotoId);
    if (found) return found.url;
  }
  return photos[0]?.url || "";
}

function isPortfolioFolderCover(folderId: string, photoId: string): boolean {
  const folder = form.portfolioFolders.find((f) => f.id === folderId);
  return Boolean(folder?.coverPhotoId && folder.coverPhotoId === photoId);
}

function setPortfolioFolderCover(folderId: string, photoId: string) {
  const folder = form.portfolioFolders.find((f) => f.id === folderId);
  if (!folder) return;
  if (!form.portfolioPhotos.some((p) => p.id === photoId && p.folderId === folderId)) return;
  folder.coverPhotoId = photoId;
  ElMessage.success("已设为文件夹封面");
}

function removePortfolioPhoto(id: string) {
  form.portfolioPhotos = form.portfolioPhotos.filter((p) => p.id !== id);
  for (const f of form.portfolioFolders) {
    if (f.coverPhotoId === id) f.coverPhotoId = undefined;
  }
}

function addPortfolioFolder() {
  if (form.portfolioFolders.length >= MODEL_PORTFOLIO_MAX_FOLDERS) {
    ElMessage.warning(`最多创建 ${MODEL_PORTFOLIO_MAX_FOLDERS} 个文件夹`);
    return;
  }
  const id = `f_${Date.now()}`;
  form.portfolioFolders.push({ id, name: `文件夹${form.portfolioFolders.length + 1}` });
}

async function addPortfolioPhoto(folderId: string, file: File) {
  const url = await doUpload("portfolio", file);
  form.portfolioPhotos.push({
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    folderId,
    url
  });
}

function buildPayload(): AdminModelCreateBody {
  const city = cascaderValueToCityText(form.cityCascader);
  const body: AdminModelCreateBody = {
    avatarUrl: form.avatarUrl.trim() || null,
    agentUserId: form.agentUserId,
    status: form.status,
    basicInfo: {
      name: form.name.trim(),
      gender: form.gender,
      birthDate: form.birthDate,
      city,
      intro: form.intro.trim(),
      phone: form.phone.trim()
    },
    orderSettings: {
      settings: {
        orderEnabled: form.orderEnabled,
        onlyLocal: form.onlyLocal,
        onlyFemale: form.onlyFemale
      }
    }
  };
  if (form.categoryIds.length) {
    body.categoryIds = [...form.categoryIds];
  }
  body.card = {
    photoAngles: buildCardPhotoAnglesPayload()
  };
  if (cardPhotoCount.value > 0) {
    const measurements: Record<string, number> = {};
    for (const f of MODEL_MEASUREMENT_FIELDS) {
      const n = Number(form.measurements[f.key]);
      if (Number.isFinite(n) && n > 0) {
        measurements[f.key] = n;
      }
    }
    if (Object.keys(measurements).length > 0) {
      body.card.measurements = measurements;
    }
    if (form.hairColor) body.card.hairColor = form.hairColor;
    if (form.skinColor) body.card.skinColor = form.skinColor;
  }
  body.pricing = {
    hourly: form.hourly ? Number(form.hourly) : null,
    halfDay: form.halfDay ? Number(form.halfDay) : null,
    fullDay: form.fullDay ? Number(form.fullDay) : null
  };
  body.stylePosition = { photos: form.stylePhotos };
  body.portfolio = {
    folders: form.portfolioFolders.map((f) => {
      const row: { id: string; name: string; coverPhotoId?: string } = {
        id: f.id,
        name: f.name
      };
      const cid = f.coverPhotoId?.trim();
      if (cid) row.coverPhotoId = cid;
      return row;
    }),
    photos: form.portfolioPhotos
  };
  return body;
}

function validateLocal(): string | null {
  const basicErr = validateBasicRequired();
  if (basicErr) return basicErr;
  if (!isEditMode.value) return null;
  if (cardPhotoCount.value > 0) {
    const cardErr = validateTab("card");
    if (cardErr) return cardErr;
  }
  if (form.hourly || form.halfDay || form.fullDay) {
    const pricingErr = validateTab("pricing");
    if (pricingErr) return pricingErr;
  }
  return validateTab("portfolio");
}

async function onSubmit() {
  const err = validateLocal();
  if (err) {
    ElMessage.warning(err);
    return;
  }
  saving.value = true;
  try {
    if (isEditMode.value && props.editingModel) {
      const updated = await updateAdminModel(props.editingModel.userId, buildPayload());
      ElMessage.success(`已保存模特 ${updated.userNo}`);
      visible.value = false;
      emit("updated");
      return;
    }
    const created = await createAdminModel(buildPayload());
    ElMessage.success(`已创建模特 ${created.userNo}`);
    visible.value = false;
    emit("created");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : isEditMode.value ? "保存失败" : "创建失败");
  } finally {
    saving.value = false;
  }
}

function onClose() {
  visible.value = false;
}
</script>

<template>
  <el-dialog
    v-model="visible"
    width="min(1120px, 96vw)"
    top="3vh"
    class="model-create-dialog"
    destroy-on-close
    align-center
    :close-on-click-modal="false"
    @closed="resetForm"
  >
    <template #header>
      <div class="mc-dialog-header">
        <h2 class="mc-dialog-title">{{ isEditMode ? "编辑模特" : "新增模特" }}</h2>
        <p class="mc-dialog-sub">
          {{
            isEditMode
              ? "仅后管创建的模特支持在此编辑；保存后会同步基础资料、分类、模卡、价格、接单设置与作品集。"
              : "仅需填写艺名/姓名与手机号即可创建初始账号；性别、城市、分类、模卡、价格等均可后续补充。资料审核与用户端一致，须模特完善后提交、后台审核通过才会在用户端列表展示。"
          }}
        </p>
      </div>
    </template>

    <div class="mc-dialog-body">
      <el-tabs v-model="activeTab" class="mc-tabs">
        <el-tab-pane :label="tabLabels.basic" name="basic">
          <el-form label-position="top" class="mc-form-grid">
            <el-form-item label="头像">
              <el-upload
                class="mc-avatar-uploader"
                :show-file-list="false"
                accept="image/jpeg,image/png,image/webp"
                :http-request="handleAvatarUpload"
              >
                <el-avatar v-if="form.avatarUrl" :size="80" :src="form.avatarUrl" />
                <div v-else class="mc-avatar-ph">
                  <el-icon><UploadFilled /></el-icon>
                  <span>上传头像</span>
                </div>
              </el-upload>
              <p class="mc-hint">上传前会自动压缩，单张图片不能超过 5M</p>
            </el-form-item>
            <el-form-item label="艺名/姓名" required>
              <el-input v-model="form.name" maxlength="50" placeholder="对应用户端基本信息" />
            </el-form-item>
            <el-form-item label="性别">
              <el-radio-group v-model="form.gender">
                <el-radio value="女">女</el-radio>
                <el-radio value="男">男</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="出生日期">
              <el-date-picker
                v-model="form.birthDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选填"
                class="field-full"
              />
            </el-form-item>
            <el-form-item label="所在城市">
              <el-cascader
                v-model="form.cityCascader"
                :options="CITY_CASCADER_OPTIONS"
                placeholder="选填：省 / 市"
                filterable
                clearable
                class="field-full"
              />
            </el-form-item>
            <el-form-item label="手机号" required>
              <el-input v-model="form.phone" maxlength="11" placeholder="11 位手机号，须唯一" />
            </el-form-item>
            <el-form-item label="简介" class="mc-span-2">
              <el-input
                v-model="form.intro"
                type="textarea"
                :rows="3"
                maxlength="200"
                show-word-limit
                placeholder="选填，200 字以内"
              />
            </el-form-item>
            <el-form-item label="所属代理人">
              <el-select
                v-model="form.agentUserId"
                clearable
                filterable
                placeholder="选填"
                class="field-full"
              >
                <el-option
                  v-for="a in agentOptions"
                  :key="a.userId"
                  :label="`${a.nickname || a.userNo}（${a.userNo}）`"
                  :value="a.userId"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="账号状态">
              <el-radio-group v-model="form.status">
                <el-radio :value="1">正常</el-radio>
                <el-radio :value="2">禁用</el-radio>
                <el-radio v-if="isEditMode && form.status === 4" :value="4">已注销</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-form>
          <div class="mc-tab-footer">
            <el-button type="primary" :loading="tabSaving === 'basic'" @click="saveTab('basic')">
              保存
            </el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="tabLabels.categories" name="categories">
          <p v-if="categoryTreeLoading" class="mc-hint">分类加载中…</p>
          <template v-else>
            <section class="mc-cat-selected">
              <div class="mc-cat-selected-head">
                <span class="mc-cat-selected-title">
                  已选分类
                  <strong>{{ form.categoryIds.length }}</strong>
                  项
                </span>
                <el-button
                  v-if="form.categoryIds.length"
                  type="primary"
                  link
                  size="small"
                  @click="clearAllCategories"
                >
                  清空全部
                </el-button>
              </div>
              <div v-if="selectedCategories.length" class="mc-cat-selected-list">
                <div v-for="c in selectedCategories" :key="c.id" class="mc-cat-selected-item">
                  <div class="mc-cat-selected-item-main">
                    <el-tag size="small" type="info" effect="plain" round class="mc-cat-dim-tag">
                      {{ c.group }}
                    </el-tag>
                    <span class="mc-cat-selected-leaf">{{ c.leafName }}</span>
                    <el-button
                      type="danger"
                      link
                      size="small"
                      class="mc-cat-selected-remove"
                      @click="removeCategory(c.id)"
                    >
                      移除
                    </el-button>
                  </div>
                  <text class="mc-cat-selected-crumb">{{ c.breadcrumb }}</text>
                </div>
              </div>
              <p v-else class="mc-cat-selected-empty">暂未选择，请在下方树形列表中勾选叶子节点</p>
            </section>

            <div class="mc-cat-picker-toolbar">
              <el-input
                v-model="categoryFilter"
                clearable
                placeholder="搜索分类名称，支持匹配父级"
                class="mc-cat-filter-input"
              />
              <span class="mc-cat-picker-hint">仅勾选最末级分类；父级用于展开浏览</span>
            </div>

            <el-collapse v-model="categoryCollapseActive" class="mc-cat-collapse">
              <el-collapse-item
                v-for="sec in categorySections"
                :key="sec.key"
                :name="sec.key"
                :title="categoryCollapseTitle(sec)"
              >
                <div v-if="!sec.tree.length" class="mc-cat-tree-empty">暂无分类数据</div>
                <div v-else class="mc-cat-tree-wrap">
                  <el-tree
                    :ref="categoryTreeRefFn(sec.key)"
                    :data="sec.tree"
                    node-key="id"
                    show-checkbox
                    check-on-click-node
                    :expand-on-click-node="false"
                    default-expand-all
                    :props="categoryTreeProps"
                    :filter-node-method="filterCategoryNode"
                    :filter="categoryFilter"
                    class="mc-cat-tree"
                    @check="onCategoryTreeCheck"
                  />
                </div>
              </el-collapse-item>
            </el-collapse>
          </template>
          <div v-if="!categoryTreeLoading" class="mc-tab-footer">
            <el-button
              type="primary"
              :loading="tabSaving === 'categories'"
              @click="saveTab('categories')"
            >
              保存
            </el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="tabLabels.card" name="card">
          <div class="mc-card-upload-head">
            <text class="mc-card-upload-tip">
              选填，最多 {{ MODEL_CARD_MAX_PHOTOS }} 张，支持一次多选；上传前会自动压缩，单张图片不能超过 5M
            </text>
            <text class="mc-card-upload-count">{{ cardPhotoCount }} / {{ MODEL_CARD_MAX_PHOTOS }}</text>
          </div>
          <div class="mc-card-photos-grid">
            <div v-for="ph in form.cardPhotos" :key="ph.id" class="mc-card-photo-item">
              <el-image :src="ph.url" fit="cover" class="mc-card-photo-img" :preview-src-list="[ph.url]" />
              <button type="button" class="mc-card-photo-del" @click="removeCardPhoto(ph.id)">×</button>
            </div>
            <el-upload
              v-if="canAddMoreCardPhotos"
              class="mc-card-photo-add"
              multiple
              :show-file-list="false"
              accept="image/jpeg,image/png,image/webp"
              :http-request="handleCardUpload"
            >
              <div class="mc-card-photo-add-inner">
                <el-icon class="mc-card-photo-add-icon"><Plus /></el-icon>
                <text>上传</text>
              </div>
            </el-upload>
          </div>
          <el-divider />
          <div class="mc-measure-grid">
            <el-form-item v-for="f in MODEL_MEASUREMENT_FIELDS" :key="f.key" :label="`${f.label}（${f.unit}）`">
              <el-input v-model="form.measurements[f.key]" type="number" />
            </el-form-item>
          </div>
          <el-form-item label="发色">
            <el-select v-model="form.hairColor" class="field-full">
              <el-option v-for="h in MODEL_HAIR_COLORS" :key="h" :label="h" :value="h" />
            </el-select>
          </el-form-item>
          <el-form-item label="肤色">
            <el-select v-model="form.skinColor" class="field-full">
              <el-option v-for="s in MODEL_SKIN_COLORS" :key="s" :label="s" :value="s" />
            </el-select>
          </el-form-item>
          <div class="mc-tab-footer">
            <el-button type="primary" :loading="tabSaving === 'card'" @click="saveTab('card')">
              保存
            </el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="tabLabels.pricing" name="pricing">
          <el-form label-position="top" class="mc-form-grid">
            <el-form-item label="小时价（元）">
              <el-input v-model="form.hourly" type="number" />
            </el-form-item>
            <el-form-item label="半天价（4 小时，元）">
              <el-input v-model="form.halfDay" type="number" />
            </el-form-item>
            <el-form-item label="全天价（8 小时，元）">
              <el-input v-model="form.fullDay" type="number" />
            </el-form-item>
          </el-form>
          <div class="mc-tab-footer">
            <el-button type="primary" :loading="tabSaving === 'pricing'" @click="saveTab('pricing')">
              保存
            </el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="tabLabels.order" name="order">
          <el-form label-position="top">
            <el-form-item label="接单开关">
              <el-switch v-model="form.orderEnabled" />
            </el-form-item>
            <el-form-item label="只接本地单">
              <el-switch v-model="form.onlyLocal" />
            </el-form-item>
            <el-form-item label="只接女性商家">
              <el-switch v-model="form.onlyFemale" />
            </el-form-item>
          </el-form>
          <div class="mc-tab-footer">
            <el-button type="primary" :loading="tabSaving === 'order'" @click="saveTab('order')">
              保存
            </el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="tabLabels.style" name="style">
          <div class="mc-card-upload-head">
            <text class="mc-card-upload-tip">
              选填，最多 {{ MODEL_STYLE_MAX_PHOTOS }} 张，支持一次多选；上传前会自动压缩，单张图片不能超过 5M
            </text>
            <text class="mc-card-upload-count">{{ stylePhotoCount }} / {{ MODEL_STYLE_MAX_PHOTOS }}</text>
          </div>
          <div class="mc-card-photos-grid mc-photos-grid--square">
            <div v-for="ph in form.stylePhotos" :key="ph.id" class="mc-card-photo-item mc-card-photo-item--square">
              <el-image
                :src="ph.url"
                fit="cover"
                class="mc-card-photo-img"
                :preview-src-list="form.stylePhotos.map((p) => p.url)"
              />
              <button type="button" class="mc-card-photo-del" @click="removeStylePhoto(ph.id)">×</button>
            </div>
            <el-upload
              v-if="canAddMoreStylePhotos"
              class="mc-card-photo-add mc-card-photo-add--square"
              multiple
              :show-file-list="false"
              accept="image/jpeg,image/png,image/webp"
              :http-request="handleStyleUpload"
            >
              <div class="mc-card-photo-add-inner mc-card-photo-add-inner--square">
                <el-icon class="mc-card-photo-add-icon"><Plus /></el-icon>
                <text>上传</text>
              </div>
            </el-upload>
          </div>
          <div class="mc-tab-footer">
            <el-button type="primary" :loading="tabSaving === 'style'" @click="saveTab('style')">
              保存
            </el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="tabLabels.portfolio" name="portfolio">
          <div class="mc-card-upload-head">
            <text class="mc-card-upload-tip">
              选填，共最多 {{ MODEL_PORTFOLIO_MAX_PHOTOS }} 张 / {{ MODEL_PORTFOLIO_MAX_FOLDERS }} 个文件夹，支持一次多选；上传前会自动压缩，单张图片不能超过 5M
            </text>
            <text class="mc-card-upload-count">{{ portfolioPhotoCount }} / {{ MODEL_PORTFOLIO_MAX_PHOTOS }}</text>
          </div>
          <el-button
            type="primary"
            plain
            :icon="Plus"
            :disabled="!canAddPortfolioFolder"
            @click="addPortfolioFolder"
          >
            新建文件夹
          </el-button>
          <p v-if="!form.portfolioFolders.length" class="mc-hint mc-portfolio-empty-hint">
            可先新建文件夹，再在每个文件夹内批量上传作品图；每文件夹可点「设封面」指定列表展示图
          </p>
          <div v-for="folder in form.portfolioFolders" :key="folder.id" class="mc-portfolio-folder">
            <div class="mc-portfolio-folder-head">
              <el-image
                v-if="portfolioFolderCoverUrl(folder)"
                :src="portfolioFolderCoverUrl(folder)"
                fit="cover"
                class="mc-portfolio-folder-cover-thumb"
              />
              <el-input v-model="folder.name" maxlength="50" style="max-width: 240px" />
              <text class="mc-portfolio-folder-count">
                {{ portfolioPhotosInFolder(folder.id).length }} 张 · 封面用于列表展示
              </text>
            </div>
            <div class="mc-card-photos-grid mc-photos-grid--square">
              <div
                v-for="ph in portfolioPhotosInFolder(folder.id)"
                :key="ph.id"
                class="mc-card-photo-item mc-card-photo-item--square"
              >
                <el-image
                  :src="ph.url"
                  fit="cover"
                  class="mc-card-photo-img"
                  :preview-src-list="portfolioPhotosInFolder(folder.id).map((p) => p.url)"
                />
                <div v-if="isPortfolioFolderCover(folder.id, ph.id)" class="mc-portfolio-cover-badge">封面</div>
                <button
                  v-else
                  type="button"
                  class="mc-portfolio-set-cover"
                  @click="setPortfolioFolderCover(folder.id, ph.id)"
                >
                  设封面
                </button>
                <button type="button" class="mc-card-photo-del" @click="removePortfolioPhoto(ph.id)">×</button>
              </div>
              <el-upload
                v-if="canAddMorePortfolioPhotos"
                class="mc-card-photo-add mc-card-photo-add--square"
                multiple
                :show-file-list="false"
                accept="image/jpeg,image/png,image/webp"
                :http-request="makePortfolioUploadHandler(folder.id)"
              >
                <div class="mc-card-photo-add-inner mc-card-photo-add-inner--square">
                  <el-icon class="mc-card-photo-add-icon"><Plus /></el-icon>
                  <text>上传</text>
                </div>
              </el-upload>
            </div>
          </div>
          <div class="mc-tab-footer">
            <el-button type="primary" :loading="tabSaving === 'portfolio'" @click="saveTab('portfolio')">
              保存
            </el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <template #footer>
      <el-button @click="onClose">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSubmit">
        {{ isEditMode ? "保存修改" : "保存并创建" }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.model-create-dialog :deep(.el-dialog) {
  min-height: min(680px, 86vh);
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
}
.model-create-dialog :deep(.el-dialog__header) {
  flex-shrink: 0;
}
.model-create-dialog :deep(.el-dialog__body) {
  flex: 1;
  min-height: 0;
  padding-top: 8px;
  padding-bottom: 12px;
  display: flex;
  flex-direction: column;
}
.model-create-dialog :deep(.el-dialog__footer) {
  flex-shrink: 0;
}
.mc-dialog-header {
  padding-right: 24px;
}
.mc-dialog-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
}
.mc-dialog-sub {
  margin: 6px 0 0;
  font-size: 13px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
.mc-dialog-body {
  flex: 1;
  min-height: min(50vh, 500px);
  max-height: min(72vh, 720px);
  overflow-y: auto;
  padding-right: 4px;
}
.mc-tabs :deep(.el-tabs__content) {
  min-height: min(46vh, 460px);
}
.mc-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 20px;
}
.mc-span-2 {
  grid-column: 1 / -1;
}
.field-full {
  width: 100%;
}
.mc-avatar-uploader :deep(.el-upload) {
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  cursor: pointer;
}
.mc-avatar-ph {
  width: 80px;
  height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.mc-cat-selected {
  margin-bottom: 4px;
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
}
.mc-cat-selected-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.mc-cat-selected-title {
  font-size: 14px;
  color: var(--el-text-color-regular);
}
.mc-cat-selected-title strong {
  margin: 0 4px;
  font-size: 16px;
  color: var(--el-color-primary);
}
.mc-cat-selected-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 200px;
  overflow-y: auto;
}
.mc-cat-selected-item {
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--el-color-primary-light-5);
}
.mc-cat-selected-item-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.mc-cat-dim-tag {
  flex-shrink: 0;
}
.mc-cat-selected-leaf {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mc-cat-selected-remove {
  flex-shrink: 0;
  padding: 0;
}
.mc-cat-selected-crumb {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.45;
  word-break: break-all;
}
.mc-cat-selected-empty {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.mc-cat-picker-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 16px 0 12px;
}
.mc-cat-filter-input {
  flex: 1;
  min-width: 220px;
  max-width: 420px;
}
.mc-cat-picker-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.mc-cat-collapse {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  overflow: hidden;
}
.mc-cat-collapse :deep(.el-collapse-item__header) {
  padding: 0 16px;
  font-weight: 600;
  background: var(--el-fill-color-light);
}
.mc-cat-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: none;
}
.mc-cat-collapse :deep(.el-collapse-item__content) {
  padding: 12px 16px 16px;
}
.mc-cat-tree-wrap {
  max-height: 280px;
  overflow: auto;
  padding: 8px 4px;
  border-radius: 8px;
  background: #fafbfc;
  border: 1px solid var(--el-border-color-extra-light);
}
.mc-cat-tree :deep(.el-tree-node__content) {
  height: 32px;
  border-radius: 6px;
}
.mc-cat-tree :deep(.el-tree-node__content:hover) {
  background: var(--el-fill-color-light);
}
.mc-cat-tree :deep(.el-tree-node__label) {
  font-size: 14px;
}
.mc-cat-tree-empty {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.mc-card-upload-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.mc-card-upload-tip {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.mc-card-upload-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-primary);
  font-variant-numeric: tabular-nums;
}
.mc-card-photos-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.mc-card-photo-item {
  position: relative;
  width: 120px;
  height: 160px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
}
.mc-card-photo-img {
  width: 100%;
  height: 100%;
}
.mc-card-photo-del {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.55);
  color: #fff;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.mc-card-photo-add {
  width: 120px;
  height: 160px;
}
.mc-card-photo-add :deep(.el-upload) {
  width: 100%;
  height: 100%;
}
.mc-card-photo-add-inner {
  width: 120px;
  height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 10px;
  border: 1px dashed var(--el-border-color);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.mc-card-photo-add-icon {
  font-size: 28px;
  color: var(--el-color-primary);
}
.mc-card-photo-item--square,
.mc-card-photo-add--square,
.mc-card-photo-add-inner--square {
  width: 120px;
  height: 120px;
}
.mc-portfolio-empty-hint {
  margin: 12px 0 0;
}
.mc-portfolio-folder-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.mc-portfolio-folder-cover-thumb {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  flex-shrink: 0;
}
.mc-portfolio-folder-count {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.mc-portfolio-cover-badge {
  position: absolute;
  left: 6px;
  bottom: 6px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  color: #fff;
  background: rgba(47, 107, 255, 0.92);
  pointer-events: none;
}
.mc-portfolio-set-cover {
  position: absolute;
  left: 6px;
  bottom: 6px;
  font-size: 11px;
  padding: 2px 8px;
  border: none;
  border-radius: 999px;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  cursor: pointer;
}
.mc-portfolio-set-cover:hover {
  background: rgba(47, 107, 255, 0.92);
}
.mc-measure-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 16px;
}
.mc-thumb-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.mc-thumb {
  width: 88px;
  height: 88px;
  border-radius: 8px;
}
.mc-portfolio-folder {
  margin-top: 16px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.mc-hint {
  color: var(--el-text-color-secondary);
}
.mc-tab-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>

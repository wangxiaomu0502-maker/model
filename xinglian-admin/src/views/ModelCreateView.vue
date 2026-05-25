<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { ArrowLeft, Plus, UploadFilled } from "@element-plus/icons-vue";
import type { UploadRequestOptions } from "element-plus";

import { CITY_CASCADER_OPTIONS, cascaderValueToCityText } from "@/constants/province-city";
import {
  DEFAULT_MODEL_MEASUREMENTS,
  MODEL_HAIR_COLORS,
  MODEL_MEASUREMENT_FIELDS,
  MODEL_PHOTO_ANGLES,
  MODEL_SKIN_COLORS
} from "@/constants/model-form";
import {
  createAdminModel,
  fetchAdminAgentUsers,
  fetchAdminModelCategoryTree,
  uploadAdminModelImage,
  type AdminModelCategoryTreeNode,
  type AdminModelCreateBody,
  type AdminUserRow
} from "@/api/admin";

const router = useRouter();
const saving = ref(false);
const activeTab = ref("basic");
const categoryTreeLoading = ref(false);
const categoryLeaves = ref<Array<{ id: number; label: string; group: string }>>([]);
const agentOptions = ref<AdminUserRow[]>([]);

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
  photoAngles: MODEL_PHOTO_ANGLES.map((a) => ({ ...a, url: "", width: 0, height: 0 })),
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
  portfolioFolders: [] as Array<{ id: string; name: string }>,
  portfolioPhotos: [] as Array<{ id: string; folderId: string; url: string }>
});

const cardPhotoCount = computed(
  () => form.photoAngles.filter((p) => String(p.url || "").trim()).length
);

function collectLeaves(nodes: AdminModelCategoryTreeNode[], prefix: string, group: string) {
  for (const n of nodes) {
    const path = prefix ? `${prefix} / ${n.name}` : n.name;
    if (!n.children?.length) {
      categoryLeaves.value.push({ id: n.id, label: path, group });
    } else {
      collectLeaves(n.children, path, group);
    }
  }
}

async function loadCategoryTree() {
  categoryTreeLoading.value = true;
  try {
    const tree = await fetchAdminModelCategoryTree();
    categoryLeaves.value = [];
    collectLeaves(tree.mainTypeGroups, "", "主类型");
    collectLeaves(tree.styleGroups, "", "风格");
    collectLeaves(tree.sceneGroups, "", "场景");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "分类加载失败");
  } finally {
    categoryTreeLoading.value = false;
  }
}

async function loadAgents() {
  try {
    const { list } = await fetchAdminAgentUsers();
    agentOptions.value = list;
  } catch {
    agentOptions.value = [];
  }
}

onMounted(() => {
  void loadCategoryTree();
  void loadAgents();
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

function handleCardUpload(index: number, opt: UploadRequestOptions) {
  const raw = opt.file as File;
  uploadCardAngle(index, raw)
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
  addStylePhoto(raw)
    .then(() => opt.onSuccess?.({}))
    .catch((e: unknown) => {
      ElMessage.error(e instanceof Error ? e.message : "上传失败");
      opt.onError?.(e as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0]);
    });
}

function makeCardUploadHandler(index: number) {
  return (opt: UploadRequestOptions) => handleCardUpload(index, opt);
}

function makePortfolioUploadHandler(folderId: string) {
  return (opt: UploadRequestOptions) => handlePortfolioUpload(folderId, opt);
}

function handlePortfolioUpload(folderId: string, opt: UploadRequestOptions) {
  const raw = opt.file as File;
  addPortfolioPhoto(folderId, raw)
    .then(() => opt.onSuccess?.({}))
    .catch((e: unknown) => {
      ElMessage.error(e instanceof Error ? e.message : "上传失败");
      opt.onError?.(e as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0]);
    });
}

async function uploadCardAngle(index: number, file: File) {
  const url = await doUpload("card", file);
  const next = [...form.photoAngles];
  next[index] = { ...next[index], url, width: 0, height: 0 };
  form.photoAngles = next;
}

async function addStylePhoto(file: File) {
  const url = await doUpload("style", file);
  form.stylePhotos.push({ id: `sp_${Date.now()}`, url });
}

function addPortfolioFolder() {
  const id = `f_${Date.now()}`;
  form.portfolioFolders.push({ id, name: `文件夹${form.portfolioFolders.length + 1}` });
}

async function addPortfolioPhoto(folderId: string, file: File) {
  const url = await doUpload("portfolio", file);
  form.portfolioPhotos.push({
    id: `p_${Date.now()}`,
    folderId,
    url
  });
}

function buildPayload(): AdminModelCreateBody {
  const city = cascaderValueToCityText(form.cityCascader);
  const measurements: Record<string, number> = {};
  for (const f of MODEL_MEASUREMENT_FIELDS) {
    measurements[f.key] = Number(form.measurements[f.key] || 0);
  }
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
    categoryIds: [...form.categoryIds],
    card: {
      photoAngles: form.photoAngles.map((p) => ({
        key: p.key,
        label: p.label,
        url: p.url || undefined,
        width: p.width,
        height: p.height
      })),
      measurements,
      hairColor: form.hairColor,
      skinColor: form.skinColor
    },
    pricing: {
      hourly: Number(form.hourly),
      halfDay: Number(form.halfDay),
      fullDay: Number(form.fullDay)
    },
    orderSettings: {
      settings: {
        orderEnabled: form.orderEnabled,
        onlyLocal: form.onlyLocal,
        onlyFemale: form.onlyFemale
      }
    }
  };
  if (form.stylePhotos.length) {
    body.stylePosition = { photos: form.stylePhotos };
  }
  if (form.portfolioFolders.length && form.portfolioPhotos.length) {
    body.portfolio = {
      folders: form.portfolioFolders.map((f) => ({ id: f.id, name: f.name })),
      photos: form.portfolioPhotos
    };
  }
  return body;
}

function validateLocal(): string | null {
  if (!form.name.trim()) return "请填写艺名/姓名";
  if (!form.birthDate) return "请选择出生日期";
  if (!form.cityCascader.length) return "请选择所在城市";
  if (!form.intro.trim()) return "请填写简介";
  if (!/^1\d{10}$/.test(form.phone.trim())) return "请填写正确的手机号";
  if (!form.categoryIds.length) return "请至少选择 1 个模特分类";
  if (cardPhotoCount.value < 1) return "模卡至少上传 1 张图片";
  for (const f of MODEL_MEASUREMENT_FIELDS) {
    const n = Number(form.measurements[f.key]);
    if (!Number.isFinite(n) || n <= 0) return `请填写${f.label}`;
  }
  if (!form.hairColor || !form.skinColor) return "请选择发色与肤色";
  if (!Number(form.hourly) || !Number(form.halfDay) || !Number(form.fullDay)) {
    return "请填写完整的三档价格";
  }
  return null;
}

async function onSubmit() {
  const err = validateLocal();
  if (err) {
    ElMessage.warning(err);
    return;
  }
  saving.value = true;
  try {
    const created = await createAdminModel(buildPayload());
    ElMessage.success(`已创建模特 ${created.userNo}`);
    router.push({ name: "models" });
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "创建失败");
  } finally {
    saving.value = false;
  }
}

function goBack() {
  router.push({ name: "models" });
}
</script>

<template>
  <div class="mc-page">
    <header class="mc-hero">
      <el-button text type="primary" class="mc-back" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回模特列表
      </el-button>
      <div>
        <h1 class="mc-title">新增模特</h1>
        <p class="mc-sub">填写与用户端一致的模特资料；账号标记为后管创建，资料默认审核通过。</p>
      </div>
      <el-button type="primary" size="large" :loading="saving" @click="onSubmit">保存并创建</el-button>
    </header>

    <el-card shadow="never" class="mc-card">
      <el-tabs v-model="activeTab" class="mc-tabs">
        <el-tab-pane label="基本信息" name="basic">
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
            </el-form-item>
            <el-form-item label="艺名/姓名" required>
              <el-input v-model="form.name" maxlength="50" placeholder="对应用户端基本信息" />
            </el-form-item>
            <el-form-item label="性别" required>
              <el-radio-group v-model="form.gender">
                <el-radio value="女">女</el-radio>
                <el-radio value="男">男</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="出生日期" required>
              <el-date-picker
                v-model="form.birthDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选择日期"
                class="field-full"
              />
            </el-form-item>
            <el-form-item label="所在城市" required>
              <el-cascader
                v-model="form.cityCascader"
                :options="CITY_CASCADER_OPTIONS"
                placeholder="省 / 市"
                filterable
                clearable
                class="field-full"
              />
            </el-form-item>
            <el-form-item label="手机号" required>
              <el-input v-model="form.phone" maxlength="11" placeholder="11 位手机号，须唯一" />
            </el-form-item>
            <el-form-item label="简介" required class="mc-span-2">
              <el-input
                v-model="form.intro"
                type="textarea"
                :rows="3"
                maxlength="200"
                show-word-limit
                placeholder="200 字以内"
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
              </el-radio-group>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="模特分类" name="categories">
          <p v-if="categoryTreeLoading" class="mc-hint">分类加载中…</p>
          <el-checkbox-group v-else v-model="form.categoryIds" class="mc-cat-group">
            <div v-for="g in ['主类型', '风格', '场景']" :key="g" class="mc-cat-block">
              <div class="mc-cat-block-title">{{ g }}</div>
              <el-checkbox
                v-for="c in categoryLeaves.filter((x) => x.group === g)"
                :key="c.id"
                :value="c.id"
                :label="c.id"
              >
                {{ c.label }}
              </el-checkbox>
            </div>
          </el-checkbox-group>
        </el-tab-pane>

        <el-tab-pane :label="`模卡（${cardPhotoCount} 张）`" name="card">
          <div class="mc-card-grid">
            <div v-for="(angle, idx) in form.photoAngles" :key="angle.key" class="mc-card-slot">
              <div class="mc-card-slot-label">{{ angle.label }}</div>
              <el-upload
                :show-file-list="false"
                accept="image/jpeg,image/png,image/webp"
                :http-request="makeCardUploadHandler(idx)"
              >
                <el-image v-if="angle.url" :src="angle.url" fit="cover" class="mc-card-img" />
                <div v-else class="mc-card-ph">上传</div>
              </el-upload>
            </div>
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
        </el-tab-pane>

        <el-tab-pane label="服务价格" name="pricing">
          <el-form label-position="top" class="mc-form-grid">
            <el-form-item label="小时价（元）" required>
              <el-input v-model="form.hourly" type="number" />
            </el-form-item>
            <el-form-item label="半天价（4 小时，元）" required>
              <el-input v-model="form.halfDay" type="number" />
            </el-form-item>
            <el-form-item label="全天价（8 小时，元）" required>
              <el-input v-model="form.fullDay" type="number" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="接单设置" name="order">
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
        </el-tab-pane>

        <el-tab-pane label="风格定位（选填）" name="style">
          <el-upload
            :show-file-list="false"
            accept="image/jpeg,image/png,image/webp"
            :http-request="handleStyleUpload"
          >
            <el-button type="primary" plain :icon="Plus">上传风格图</el-button>
          </el-upload>
          <div class="mc-thumb-row">
            <el-image
              v-for="p in form.stylePhotos"
              :key="p.id"
              :src="p.url"
              fit="cover"
              class="mc-thumb"
              :preview-src-list="[p.url]"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="作品集（选填）" name="portfolio">
          <el-button type="primary" plain :icon="Plus" @click="addPortfolioFolder">新建文件夹</el-button>
          <div v-for="folder in form.portfolioFolders" :key="folder.id" class="mc-portfolio-folder">
            <el-input v-model="folder.name" maxlength="50" style="max-width: 240px" />
            <el-upload
              :show-file-list="false"
              accept="image/jpeg,image/png,image/webp"
              :http-request="makePortfolioUploadHandler(folder.id)"
            >
              <el-button size="small">上传作品图</el-button>
            </el-upload>
            <div class="mc-thumb-row">
              <el-image
                v-for="ph in form.portfolioPhotos.filter((p) => p.folderId === folder.id)"
                :key="ph.id"
                :src="ph.url"
                fit="cover"
                class="mc-thumb"
              />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<style scoped>
.mc-page {
  padding: 0 4px 32px;
}
.mc-hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 24px;
  margin-bottom: 20px;
}
.mc-back {
  margin-right: auto;
}
.mc-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
.mc-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.mc-card {
  border-radius: 12px;
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
.mc-cat-group {
  display: block;
}
.mc-cat-block {
  margin-bottom: 16px;
}
.mc-cat-block-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.mc-cat-block :deep(.el-checkbox) {
  display: block;
  margin-right: 0;
  margin-bottom: 6px;
}
.mc-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}
.mc-card-slot-label {
  font-size: 12px;
  margin-bottom: 6px;
  color: var(--el-text-color-secondary);
}
.mc-card-img,
.mc-card-ph {
  width: 100%;
  height: 140px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}
.mc-card-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--el-border-color);
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
</style>

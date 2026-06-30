<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Picture, Plus, VideoCamera } from "@element-plus/icons-vue";
import type { UploadRequestOptions } from "element-plus";

import ImageCropDialog from "@/components/ImageCropDialog.vue";
import {
  HOME_BANNER_COVER_ASPECT,
  HOME_BANNER_COVER_HEIGHT,
  HOME_BANNER_COVER_OUTPUT_HEIGHT,
  HOME_BANNER_COVER_OUTPUT_WIDTH,
  HOME_BANNER_COVER_WIDTH
} from "@/constants/home-banner-cover";
import {
  createHomeBanner,
  deleteHomeBanner,
  fetchHomeBanners,
  updateHomeBanner,
  uploadAdminAssetImage,
  uploadAdminHomeBannerVideo,
  type HomeBannerRow
} from "@/api/admin";
import { prepareAdminUploadFile } from "@/utils/upload-file";

const loading = ref(false);
const saving = ref(false);
const list = ref<HomeBannerRow[]>([]);
const total = ref(0);
const pager = reactive({ page: 1, pageSize: 20 });
const dialogVisible = ref(false);
const dialogMode = ref<"create" | "edit">("create");
const editingId = ref<number | null>(null);
const imageUploading = ref(false);
const coverUploading = ref(false);
const videoUploading = ref(false);
const coverCropVisible = ref(false);
const pendingCoverFile = ref<File | null>(null);

const coverCropHint = `固定比例 ${HOME_BANNER_COVER_WIDTH}:${HOME_BANNER_COVER_HEIGHT}（宽:高），与小程序首页 Banner 展示区域一致`;

const form = reactive({
  type: "image" as "image" | "video",
  sortOrder: 0,
  enabled: true,
  imageUrl: "",
  coverUrl: "",
  videoUrl: ""
});

function typeLabel(type: HomeBannerRow["type"]): string {
  return type === "video" ? "视频" : "图片";
}

function previewUrl(row: HomeBannerRow): string {
  return row.coverUrl || "";
}

function displayResource(row: HomeBannerRow): string {
  return row.type === "video" ? row.videoUrl || "—" : row.imageUrl || "—";
}

function resetForm(): void {
  form.type = "image";
  form.sortOrder = 0;
  form.enabled = true;
  form.imageUrl = "";
  form.coverUrl = "";
  form.videoUrl = "";
}

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const data = await fetchHomeBanners({
      page: pager.page,
      pageSize: pager.pageSize
    });
    list.value = data.list;
    total.value = data.total;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  dialogMode.value = "create";
  editingId.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: HomeBannerRow): void {
  dialogMode.value = "edit";
  editingId.value = row.id;
  form.type = row.type;
  form.sortOrder = Number(row.sortOrder || 0);
  form.enabled = row.enabled;
  form.imageUrl = row.imageUrl || "";
  form.coverUrl = row.coverUrl || "";
  form.videoUrl = row.videoUrl || "";
  dialogVisible.value = true;
}

function onTypeChange(): void {
  if (form.type === "image") {
    form.videoUrl = "";
  } else {
    form.imageUrl = "";
  }
}

async function onSave(): Promise<void> {
  if (!form.coverUrl.trim()) {
    ElMessage.warning("请上传首图");
    return;
  }
  if (form.type === "image") {
    if (!form.imageUrl.trim()) {
      ElMessage.warning("请上传展示图");
      return;
    }
  } else if (!form.videoUrl.trim()) {
    ElMessage.warning("请上传视频文件");
    return;
  }

  saving.value = true;
  try {
    const body =
      form.type === "image"
        ? {
            type: "image" as const,
            sortOrder: Number(form.sortOrder || 0),
            enabled: form.enabled,
            coverUrl: form.coverUrl.trim(),
            imageUrl: form.imageUrl.trim()
          }
        : {
            type: "video" as const,
            sortOrder: Number(form.sortOrder || 0),
            enabled: form.enabled,
            coverUrl: form.coverUrl.trim(),
            videoUrl: form.videoUrl.trim()
          };

    if (dialogMode.value === "create") {
      await createHomeBanner(body);
      ElMessage.success("已新增 Banner");
    } else if (editingId.value != null) {
      await updateHomeBanner(editingId.value, body);
      ElMessage.success("已保存 Banner");
    }
    dialogVisible.value = false;
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: HomeBannerRow): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除该 Banner（ID ${row.id}）？`, "删除确认", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }
  try {
    await deleteHomeBanner(row.id);
    ElMessage.success("已删除");
    if (list.value.length === 1 && pager.page > 1) {
      pager.page -= 1;
    }
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
  }
}

async function uploadImage(options: UploadRequestOptions): Promise<void> {
  const file = options.file as File;
  imageUploading.value = true;
  try {
    const url = await uploadAdminAssetImage(file);
    form.imageUrl = url;
    options.onSuccess?.({ url });
    ElMessage.success("图片上传成功");
  } catch (e) {
    const error = e instanceof Error ? e : new Error("上传失败");
    options.onError?.(error as unknown as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0]);
    ElMessage.error(error.message);
  } finally {
    imageUploading.value = false;
  }
}

async function uploadCover(options: UploadRequestOptions): Promise<void> {
  const file = options.file as File;
  pendingCoverFile.value = file;
  coverCropVisible.value = true;
  options.onSuccess?.({});
}

async function onCoverCropConfirm(file: File): Promise<void> {
  coverUploading.value = true;
  try {
    const prepared = await prepareAdminUploadFile(file);
    const url = await uploadAdminAssetImage(prepared);
    form.coverUrl = url;
    ElMessage.success("首图上传成功");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "上传失败");
  } finally {
    coverUploading.value = false;
    pendingCoverFile.value = null;
  }
}

async function uploadVideo(options: UploadRequestOptions): Promise<void> {
  const file = options.file as File;
  videoUploading.value = true;
  try {
    const url = await uploadAdminHomeBannerVideo(file);
    form.videoUrl = url;
    options.onSuccess?.({ url });
    ElMessage.success("视频上传成功");
  } catch (e) {
    const error = e instanceof Error ? e : new Error("上传失败");
    options.onError?.(error as unknown as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0]);
    ElMessage.error(error.message);
  } finally {
    videoUploading.value = false;
  }
}

onMounted(() => {
  void loadList();
});
</script>

<template>
  <div class="page-wrap">
    <div class="page-head">
      <div class="page-head-main">
        <h1 class="page-title">首页 Banner</h1>
        <p class="page-desc">首页轮播展示首图（比例 {{ HOME_BANNER_COVER_WIDTH }}:{{ HOME_BANNER_COVER_HEIGHT }}，宽:高）；点击进入详情后，图片类型展示展示图（建议 16:9），视频类型播放视频。</p>
      </div>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        新增 Banner
      </el-button>
    </div>

    <el-card shadow="never" class="list-card">
      <el-table v-loading="loading" :data="list" stripe row-key="id">
        <el-table-column prop="id" label="ID" width="72" align="center" />
        <el-table-column label="预览" width="120" align="center">
          <template #default="{ row }">
            <img v-if="previewUrl(row)" class="thumb" :src="previewUrl(row)" alt="" />
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="88" align="center">
          <template #default="{ row }">
            <el-tag :type="row.type === 'video' ? 'warning' : 'primary'" size="small">
              {{ typeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="排序" width="80" align="center" prop="sortOrder" />
        <el-table-column label="状态" width="88" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
              {{ row.enabled ? "启用" : "停用" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="详情资源" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ displayResource(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="pager.page"
          v-model:page-size="pager.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="loadList"
          @size-change="
            () => {
              pager.page = 1;
              loadList();
            }
          "
        />
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      width="640px"
      destroy-on-close
      align-center
      :title="dialogMode === 'create' ? '新增 Banner' : '编辑 Banner'"
    >
      <el-form label-position="top" @submit.prevent="onSave">
        <el-form-item label="类型" required>
          <el-radio-group v-model="form.type" @change="onTypeChange">
            <el-radio-button value="image">图片</el-radio-button>
            <el-radio-button value="video">视频</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" :max="999999" controls-position="right" />
          <p class="field-hint">数值越小，小程序展示越靠前</p>
        </el-form-item>

        <el-form-item label="状态">
          <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
        </el-form-item>

        <el-form-item label="首图" required>
          <p class="field-hint field-hint--top">
            比例 {{ HOME_BANNER_COVER_WIDTH }}:{{ HOME_BANNER_COVER_HEIGHT }}（宽:高），上传后需裁剪至该比例
          </p>
          <div class="media-editor">
            <div v-if="form.coverUrl" class="media-preview media-preview--cover">
              <img class="media-preview-img media-preview-img--cover" :src="form.coverUrl" alt="" />
              <div class="media-preview-actions">
                <el-upload
                  accept="image/jpeg,image/png,image/webp"
                  :show-file-list="false"
                  :http-request="uploadCover"
                >
                  <el-button size="small" :loading="coverUploading">更换首图</el-button>
                </el-upload>
                <button type="button" class="media-remove" @click="form.coverUrl = ''">删除</button>
              </div>
            </div>
            <el-upload
              v-else
              drag
              accept="image/jpeg,image/png,image/webp"
              :show-file-list="false"
              :http-request="uploadCover"
            >
              <div class="upload-inner">
                <el-icon><Picture /></el-icon>
                <span>{{ coverUploading ? "上传中..." : "上传首图" }}</span>
                <small>上传后裁剪为 {{ HOME_BANNER_COVER_WIDTH }}:{{ HOME_BANNER_COVER_HEIGHT }}（宽:高）</small>
              </div>
            </el-upload>
          </div>
        </el-form-item>

        <template v-if="form.type === 'image'">
          <el-form-item label="展示图" required>
            <p class="field-hint field-hint--top">建议比例 16:9（宽:高），如 1920×1080px，详情页全宽展示</p>
            <div class="media-editor">
              <div v-if="form.imageUrl" class="media-preview">
                <img class="media-preview-img" :src="form.imageUrl" alt="" />
                <button type="button" class="media-remove" @click="form.imageUrl = ''">删除</button>
              </div>
              <el-upload
                v-else
                drag
                accept="image/jpeg,image/png,image/webp"
                :show-file-list="false"
                :http-request="uploadImage"
              >
                <div class="upload-inner">
                  <el-icon><Picture /></el-icon>
                  <span>{{ imageUploading ? "上传中..." : "上传展示图" }}</span>
                  <small>详情页展示用 · 建议 16:9（宽:高）</small>
                </div>
              </el-upload>
            </div>
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="视频文件" required>
            <div class="media-editor">
              <div v-if="form.videoUrl" class="video-preview">
                <video class="video-preview-player" :src="form.videoUrl" :poster="form.coverUrl" controls />
                <button type="button" class="media-remove" @click="form.videoUrl = ''">删除</button>
              </div>
              <el-upload
                v-else
                drag
                accept="video/mp4,video/quicktime,.mp4,.mov"
                :show-file-list="false"
                :http-request="uploadVideo"
              >
                <div class="upload-inner">
                  <el-icon><VideoCamera /></el-icon>
                  <span>{{ videoUploading ? "上传中..." : "上传视频" }}</span>
                  <small>须 H.264 编码的 MP4（扩展名 .mp4 不够，H.265 无法播放），最大 50MB</small>
                </div>
              </el-upload>
            </div>
          </el-form-item>
        </template>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">
          {{ dialogMode === "create" ? "新增" : "保存" }}
        </el-button>
      </template>
    </el-dialog>

    <ImageCropDialog
      v-model:visible="coverCropVisible"
      :file="pendingCoverFile"
      :aspect-ratio="HOME_BANNER_COVER_ASPECT"
      :output-width="HOME_BANNER_COVER_OUTPUT_WIDTH"
      :output-height="HOME_BANNER_COVER_OUTPUT_HEIGHT"
      title="裁剪首图"
      :hint="coverCropHint"
      @confirm="onCoverCropConfirm"
    />
  </div>
</template>

<style scoped>
.page-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
}

.page-desc {
  margin: 6px 0 0;
  font-size: 14px;
  color: #64748b;
}

.list-card {
  border-radius: 12px;
}

.thumb {
  width: 88px;
  height: 48px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.field-hint--top {
  margin: 0 0 8px;
}

.media-editor {
  width: 100%;
}

.media-preview,
.video-preview {
  position: relative;
  width: 100%;
  max-width: 360px;
}

.media-preview--cover {
  max-width: 360px;
}

.media-preview-img,
.video-preview-player {
  display: block;
  width: 100%;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.media-preview-img--cover {
  aspect-ratio: 700 / 316;
  object-fit: cover;
}

.media-preview-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.video-preview-player {
  max-height: 200px;
  background: #0f172a;
}

.media-remove {
  padding: 0;
  border: none;
  background: none;
  color: #ef4444;
  font-size: 13px;
  cursor: pointer;
}

.upload-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 0;
  color: #64748b;
}

.upload-inner small {
  font-size: 12px;
  color: #94a3b8;
}
</style>

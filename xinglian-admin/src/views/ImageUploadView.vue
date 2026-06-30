<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import type { UploadRequestOptions } from "element-plus";
import { Link, Picture, UploadFilled } from "@element-plus/icons-vue";

import { uploadAdminAssetImage } from "@/api/admin";
import { MAX_UPLOAD_FILE_LABEL } from "@/utils/upload-file";

type UploadedImage = {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
};

const uploadingCount = ref(0);
const uploadedImages = ref<UploadedImage[]>([]);

const uploading = computed(() => uploadingCount.value > 0);
const allImageUrlsText = computed(() => uploadedImages.value.map((item) => item.url).join("\n"));

function formatTime(date = new Date()): string {
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

async function copyUrl(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    ElMessage.success("链接已复制");
  } catch {
    ElMessage.error("复制失败，请手动复制");
  }
}

async function copyAllUrls(): Promise<void> {
  if (!allImageUrlsText.value) return;
  try {
    await navigator.clipboard.writeText(allImageUrlsText.value);
    ElMessage.success(`已复制 ${uploadedImages.value.length} 条链接`);
  } catch {
    ElMessage.error("复制失败，请手动复制");
  }
}

function openUrl(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

async function uploadImage(options: UploadRequestOptions): Promise<void> {
  const file = options.file as File;
  uploadingCount.value += 1;
  try {
    const url = await uploadAdminAssetImage(file);
    uploadedImages.value.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: file.name,
      url,
      uploadedAt: formatTime()
    });
    options.onSuccess?.({ url });
    ElMessage.success(`${file.name} 上传成功`);
  } catch (e) {
    const error = e instanceof Error ? e : new Error("上传失败");
    options.onError?.(
      error as unknown as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0]
    );
    ElMessage.error(`${file.name}：${error.message}`);
  } finally {
    uploadingCount.value = Math.max(0, uploadingCount.value - 1);
  }
}

function clearList(): void {
  uploadedImages.value = [];
}
</script>

<template>
  <div class="page">
    <header class="hero">
      <div class="hero-icon-wrap">
        <el-icon><Picture /></el-icon>
      </div>
      <div>
        <h1 class="hero-title">图片上传</h1>
        <p class="hero-sub">批量上传图片到素材目录，上传成功后可直接复制图片链接。</p>
      </div>
    </header>

    <section class="panel">
      <el-upload
        class="upload-box"
        drag
        multiple
        accept="image/jpeg,image/png,image/webp"
        :http-request="uploadImage"
        :show-file-list="false"
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-title">拖拽图片到这里，或点击选择多张图片</div>
        <div class="upload-desc">支持 JPG、PNG、WEBP，单张不超过 {{ MAX_UPLOAD_FILE_LABEL }}，系统会自动压缩大图。</div>
      </el-upload>

      <div class="upload-status" v-if="uploading || uploadedImages.length > 0">
        <span>{{ uploading ? `上传中：${uploadingCount} 张` : `已上传：${uploadedImages.length} 张` }}</span>
        <el-button v-if="uploadedImages.length > 0" text type="primary" @click="clearList">
          清空列表
        </el-button>
      </div>
    </section>

    <section class="panel" v-if="uploadedImages.length > 0">
      <div class="section-head">
        <div>
          <h2 class="section-title">上传链接</h2>
          <p class="section-sub">链接已集合到一起，可一次性复制；刷新页面后列表会清空。</p>
        </div>
        <el-button type="primary" @click="copyAllUrls">复制全部链接</el-button>
      </div>

      <div class="url-summary">
        <el-input
          :model-value="allImageUrlsText"
          type="textarea"
          readonly
          :autosize="{ minRows: 4, maxRows: 10 }"
        />
      </div>

      <div class="image-list">
        <div v-for="item in uploadedImages" :key="item.id" class="image-row">
          <img class="image-thumb" :src="item.url" alt="" />
          <div class="image-main">
            <div class="image-meta">
              <span class="image-name">{{ item.name }}</span>
              <span class="image-time">{{ item.uploadedAt }}</span>
            </div>
            <el-input :model-value="item.url" readonly>
              <template #prepend>
                <el-icon><Link /></el-icon>
              </template>
            </el-input>
          </div>
          <div class="image-actions">
            <el-button @click="copyUrl(item.url)">复制链接</el-button>
            <el-button type="primary" plain @click="openUrl(item.url)">打开</el-button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 24px;
  border-radius: 18px;
  background: linear-gradient(135deg, #eff6ff, #f8fafc);
  border: 1px solid rgba(37, 99, 235, 0.14);
}

.hero-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.12);
  font-size: 24px;
}

.hero-title {
  margin: 0;
  font-size: 24px;
  color: #0f172a;
}

.hero-sub {
  margin: 6px 0 0;
  color: #64748b;
}

.panel {
  padding: 24px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 16px 40px -30px rgba(15, 23, 42, 0.4);
}

.upload-box :deep(.el-upload) {
  width: 100%;
}

.upload-box :deep(.el-upload-dragger) {
  width: 100%;
  padding: 42px 20px;
  border-radius: 18px;
  background: linear-gradient(180deg, #f8fafc, #ffffff);
}

.upload-icon {
  font-size: 46px;
  color: #2563eb;
}

.upload-title {
  margin-top: 12px;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.upload-desc {
  margin-top: 8px;
  color: #64748b;
}

.upload-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
  color: #475569;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.section-title {
  margin: 0;
  font-size: 18px;
  color: #0f172a;
}

.section-sub {
  margin: 6px 0 0;
  color: #64748b;
}

.url-summary {
  margin-bottom: 16px;
}

.url-summary :deep(.el-textarea__inner) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  color: #334155;
  background: #f8fafc;
}

.image-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.image-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.image-thumb {
  width: 88px;
  height: 88px;
  object-fit: cover;
  border-radius: 12px;
  background: #e2e8f0;
}

.image-main {
  min-width: 0;
}

.image-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.image-name {
  min-width: 0;
  font-weight: 700;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-time {
  flex-shrink: 0;
  font-size: 12px;
  color: #94a3b8;
}

.image-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 900px) {
  .image-row {
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .image-thumb {
    width: 72px;
    height: 72px;
  }

  .image-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
}
</style>

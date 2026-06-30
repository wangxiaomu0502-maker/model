<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";

const visible = defineModel<boolean>("visible", { default: false });

const props = withDefaults(
  defineProps<{
    file: File | null;
    aspectRatio: number;
    outputWidth: number;
    outputHeight: number;
    title?: string;
    hint?: string;
  }>(),
  {
    title: "裁剪图片",
    hint: ""
  }
);

const emit = defineEmits<{
  confirm: [file: File];
}>();

const imageRef = ref<HTMLImageElement | null>(null);
const cropStageRef = ref<HTMLDivElement | null>(null);
const objectUrl = ref("");
const confirming = ref(false);
let cropper: Cropper | null = null;

function revokeObjectUrl(): void {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = "";
  }
}

function destroyCropper(): void {
  cropper?.destroy();
  cropper = null;
}

function syncStageHeight(): void {
  const stage = cropStageRef.value;
  if (!stage) return;
  const width = stage.clientWidth;
  if (!width) return;
  stage.style.height = `${width / props.aspectRatio}px`;
}

/** 裁剪框占满弹窗内容区宽度，图片 cover 铺满 */
function fitCropBoxCover(): void {
  if (!cropper) return;
  syncStageHeight();
  const cropperWithResize = cropper as Cropper & { resize?: () => Cropper };
  cropperWithResize.resize?.();

  const container = cropper.getContainerData();
  if (!container.width || !container.height) return;

  const width = container.width;
  const height = width / props.aspectRatio;

  cropper.setCropBoxData({
    left: 0,
    top: 0,
    width,
    height
  });

  const cropBox = cropper.getCropBoxData();
  const image = cropper.getImageData();
  if (!image.naturalWidth || !image.naturalHeight) return;

  const zoom = Math.max(
    cropBox.width / image.naturalWidth,
    cropBox.height / image.naturalHeight
  );
  cropper.zoomTo(zoom);

  const canvas = cropper.getCanvasData();
  cropper.setCanvasData({
    left: cropBox.left - (canvas.width - cropBox.width) / 2,
    top: cropBox.top - (canvas.height - cropBox.height) / 2
  });
}

async function initCropper(): Promise<void> {
  destroyCropper();
  await nextTick();
  syncStageHeight();
  const image = imageRef.value;
  if (!image || !objectUrl.value) return;
  if (image.complete && image.naturalWidth > 0) {
    mountCropper(image);
    return;
  }
  image.onload = () => {
    if (!visible.value || !imageRef.value) return;
    mountCropper(imageRef.value);
  };
}

function mountCropper(image: HTMLImageElement): void {
  destroyCropper();
  cropper = new Cropper(image, {
    aspectRatio: props.aspectRatio,
    viewMode: 1,
    dragMode: "move",
    autoCropArea: 1,
    responsive: true,
    background: false,
    guides: true,
    center: false,
    highlight: false,
    movable: true,
    zoomable: true,
    scalable: false,
    rotatable: false,
    ready() {
      fitCropBoxCover();
    }
  });
}

function handleDialogOpened(): void {
  window.setTimeout(() => {
    fitCropBoxCover();
  }, 0);
}

function handleDialogClosed(): void {
  destroyCropper();
  revokeObjectUrl();
}

watch(
  () => [visible.value, props.file] as const,
  async ([open, file]) => {
    destroyCropper();
    revokeObjectUrl();
    if (!open || !file) return;
    objectUrl.value = URL.createObjectURL(file);
    await initCropper();
  }
);

function closeDialog(): void {
  visible.value = false;
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("裁剪失败"));
      },
      mimeType,
      quality
    );
  });
}

function resolveOutputMime(source: File): "image/png" | "image/jpeg" {
  return source.type === "image/png" ? "image/png" : "image/jpeg";
}

function buildOutputName(sourceName: string, mimeType: "image/png" | "image/jpeg"): string {
  const base = sourceName.replace(/\.[^.]+$/, "") || "banner-cover";
  const ext = mimeType === "image/png" ? "png" : "jpg";
  return `${base}-${props.outputWidth}x${props.outputHeight}.${ext}`;
}

async function onConfirm(): Promise<void> {
  if (!cropper || !props.file) return;
  confirming.value = true;
  try {
    const outputMime = resolveOutputMime(props.file);
    const canvas = cropper.getCroppedCanvas({
      width: props.outputWidth,
      height: props.outputHeight,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
      fillColor: outputMime === "image/png" ? "transparent" : "#ffffff"
    });
    const blob = await canvasToBlob(
      canvas,
      outputMime,
      outputMime === "image/jpeg" ? 0.92 : undefined
    );
    const cropped = new File([blob], buildOutputName(props.file.name, outputMime), {
      type: outputMime,
      lastModified: Date.now()
    });
    emit("confirm", cropped);
    closeDialog();
  } finally {
    confirming.value = false;
  }
}

onBeforeUnmount(() => {
  destroyCropper();
  revokeObjectUrl();
});
</script>

<template>
  <el-dialog
    v-model="visible"
    width="840px"
    destroy-on-close
    align-center
    :title="title"
    class="image-crop-dialog"
    @opened="handleDialogOpened"
    @closed="handleDialogClosed"
  >
    <p v-if="hint" class="crop-hint">{{ hint }}</p>
    <div ref="cropStageRef" class="crop-stage">
      <img
        v-if="objectUrl"
        ref="imageRef"
        class="crop-source"
        :src="objectUrl"
        alt=""
      />
    </div>
    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" :loading="confirming" @click="onConfirm">确认裁剪并上传</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.crop-hint {
  margin: 0 0 12px;
  padding: 0 20px;
  font-size: 13px;
  color: #64748b;
}

.crop-stage {
  width: 100%;
  overflow: hidden;
}

.crop-source {
  display: block;
  max-width: 100%;
}

.crop-stage :deep(.cropper-container) {
  width: 100% !important;
  height: 100% !important;
}

.crop-stage :deep(.cropper-wrap-box),
.crop-stage :deep(.cropper-canvas),
.crop-stage :deep(.cropper-drag-box),
.crop-stage :deep(.cropper-view-box) {
  width: 100%;
  height: 100%;
}
</style>

<style>
/* 裁剪区贴齐弹窗左右边缘，占满弹窗 100% 宽度 */
.image-crop-dialog .el-dialog__body {
  padding-left: 0;
  padding-right: 0;
  padding-top: 10px;
  padding-bottom: 16px;
}

.image-crop-dialog.el-dialog {
  max-width: calc(100vw - 32px);
}
</style>

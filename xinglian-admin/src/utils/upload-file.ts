export const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_FILE_LABEL = "10M";

const DEFAULT_IMAGE_QUALITY = 0.76;
const DEFAULT_IMAGE_MAX_SIDE = 1920;

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

function fileNameWithExt(name: string, ext: "jpg" | "png" | "webp"): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base || "upload"}.${ext}`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败"));
    };
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("图片压缩失败"));
      },
      mimeType,
      quality
    );
  });
}

async function resizeImageFile(
  file: File,
  mimeType: "image/jpeg" | "image/png",
  quality?: number
): Promise<File> {
  const image = await loadImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return file;

  const scale = Math.min(1, DEFAULT_IMAGE_MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await canvasToBlob(canvas, mimeType, quality);
  if (blob.size >= file.size) return file;

  const ext = mimeType === "image/png" ? "png" : "jpg";
  return new File([blob], fileNameWithExt(file.name, ext), {
    type: mimeType,
    lastModified: Date.now()
  });
}

async function compressImageFile(file: File): Promise<File> {
  if (file.type === "image/png") {
    return resizeImageFile(file, "image/png");
  }
  if (file.type === "image/webp") {
    return file;
  }
  return resizeImageFile(file, "image/jpeg", DEFAULT_IMAGE_QUALITY);
}

export async function prepareAdminUploadFile(file: File): Promise<File> {
  const prepared = isImageFile(file)
    ? await compressImageFile(file).catch(() => file)
    : file;

  if (prepared.size > MAX_UPLOAD_FILE_BYTES) {
    throw new Error(`文件不能超过 ${MAX_UPLOAD_FILE_LABEL}`);
  }

  return prepared;
}

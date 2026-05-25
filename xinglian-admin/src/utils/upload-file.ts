export const MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_FILE_LABEL = "5M";

const DEFAULT_IMAGE_QUALITY = 0.76;
const DEFAULT_IMAGE_MAX_SIDE = 1920;

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

function fileNameWithJpgExt(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base || "upload"}.jpg`;
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

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("图片压缩失败"));
      },
      "image/jpeg",
      quality
    );
  });
}

async function compressImageFile(file: File): Promise<File> {
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
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await canvasToBlob(canvas, DEFAULT_IMAGE_QUALITY);
  if (blob.size >= file.size) return file;

  return new File([blob], fileNameWithJpgExt(file.name), {
    type: "image/jpeg",
    lastModified: Date.now()
  });
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

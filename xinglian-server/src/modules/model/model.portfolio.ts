import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";

/** 每个文件夹可有独立封面：指向该文件夹内某张照片 id */
export type PortfolioFolder = { id: string; name: string; coverPhotoId?: string };
export type PortfolioPhoto = { id: string; folderId: string; url: string };

type PortfolioPhotoDraft = PortfolioPhoto & { isCover?: boolean };

function slugName(name: string): string {
  const s = name.trim().replace(/\s+/g, "_");
  return s.slice(0, 48) || "folder";
}

export function isRemotePortfolioImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function portfolioError(message: string): AppError {
  return new AppError(message, 400, ErrorCodes.VALIDATION_ERROR);
}

function finalizeFolderCovers(folders: PortfolioFolder[], photos: PortfolioPhoto[]): PortfolioFolder[] {
  return folders.map((f) => {
    const inFolder = photos.filter((p) => p.folderId === f.id);
    if (inFolder.length === 0) return { id: f.id, name: f.name };
    let cid = f.coverPhotoId?.trim();
    if (!cid || !inFolder.some((p) => p.id === cid)) cid = inFolder[0].id;
    return { id: f.id, name: f.name, coverPhotoId: cid };
  });
}

/** 读取 DB 或接口入参，兼容 legacy：`categories`、`photos[].categories`、`photos[].isCover`（旧全局封面） */
export function normalizePortfolioFromStorage(
  raw: unknown,
  opts: { stripNonRemoteUrls: boolean }
): { folders: PortfolioFolder[]; photos: PortfolioPhoto[] } {
  const folders: PortfolioFolder[] = [];
  const seenFolderIds = new Set<string>();

  const pushFolder = (idRaw: string, nameRaw: string, coverPhotoIdRaw?: string): void => {
    const nname = nameRaw.trim();
    if (!nname) return;
    let fid = idRaw.trim();
    if (!fid) fid = `gen_${seenFolderIds.size}_${slugName(nname)}`;
    if (seenFolderIds.has(fid)) return;
    seenFolderIds.add(fid);
    const cov = coverPhotoIdRaw?.trim();
    folders.push(
      cov ? { id: fid, name: nname, coverPhotoId: cov } : { id: fid, name: nname }
    );
  };

  if (raw == null) return { folders: [], photos: [] };

  let obj: Record<string, unknown>;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return { folders: [], photos: [] };
    try {
      obj = JSON.parse(s) as Record<string, unknown>;
    } catch {
      return { folders: [], photos: [] };
    }
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  } else {
    return { folders: [], photos: [] };
  }

  if (Array.isArray(obj.folders)) {
    obj.folders.forEach((f) => {
      if (!f || typeof f !== "object") return;
      const fo = f as Record<string, unknown>;
      pushFolder(String(fo.id || ""), String(fo.name || ""), String(fo.coverPhotoId || ""));
    });
  }

  if (folders.length === 0 && Array.isArray(obj.categories)) {
    obj.categories.forEach((c, i) => {
      if (typeof c === "string") {
        pushFolder(`legacy_${i}_${slugName(c)}`, c);
      } else if (c && typeof c === "object") {
        const co = c as Record<string, unknown>;
        pushFolder(String(co.id || ""), String(co.name || ""));
      }
    });
  }

  const rebuiltFolderIds = new Set(folders.map((f) => f.id));
  const rebuiltFolderByName = new Map(folders.map((f) => [f.name, f.id]));

  const rawPhotos = Array.isArray(obj.photos) ? (obj.photos as Record<string, unknown>[]) : [];

  if (folders.length === 0 && rawPhotos.length > 0) {
    pushFolder("folder_default", "默认作品集");
  }

  const folderIdsFinal = new Set(folders.map((f) => f.id));

  let photos: PortfolioPhotoDraft[] = [];
  rawPhotos.forEach((po, idx) => {
    if (!po || typeof po !== "object") return;
    const id = String(po.id || "").trim() || `photo_${idx}`;
    const url = String(po.url || "").trim();
    if (!url) return;
    if (opts.stripNonRemoteUrls && !isRemotePortfolioImageUrl(url)) return;

    let folderId = String(po.folderId || "").trim();
    if (!folderId || !folderIdsFinal.has(folderId)) {
      const cats = Array.isArray(po.categories) ? po.categories : [];
      const firstCat = cats.map((x) => String(x).trim()).find(Boolean);
      folderId = (firstCat && rebuiltFolderByName.get(firstCat)) || "";
    }
    if (!folderId || !folderIdsFinal.has(folderId)) {
      folderId = folders[0]?.id || "";
    }
    if (!folderId || !folderIdsFinal.has(folderId)) return;

    photos.push({
      id,
      folderId,
      url,
      isCover: Boolean(po.isCover)
    });
  });

  // legacy：照片上的 isCover → 对应文件夹 coverPhotoId（每文件夹优先取本文件夹内标记为封面的）
  for (const f of folders) {
    const inFolder = photos.filter((p) => p.folderId === f.id);
    const marked = inFolder.find((p) => p.isCover);
    if (!f.coverPhotoId && marked) {
      f.coverPhotoId = marked.id;
    }
  }
  const globalMarked = photos.find((p) => p.isCover);
  if (globalMarked) {
    const fd = folders.find((x) => x.id === globalMarked.folderId);
    if (fd && !fd.coverPhotoId) fd.coverPhotoId = globalMarked.id;
  }

  const photosOut: PortfolioPhoto[] = photos.map(({ isCover: _drop, ...rest }) => rest);
  const foldersOut = finalizeFolderCovers(folders, photosOut);

  return { folders: foldersOut, photos: photosOut };
}

/** 保存前强校验；持久化为 `{ folders, photos }`（封面仅存于 folders[].coverPhotoId） */
export function normalizePortfolioForPersist(payload: Record<string, unknown>): {
  folders: PortfolioFolder[];
  photos: PortfolioPhoto[];
} {
  const { folders, photos } = normalizePortfolioFromStorage(payload, { stripNonRemoteUrls: false });

  if (folders.length > 10) throw portfolioError("作品集文件夹最多 10 个");
  if (photos.length > 100) throw portfolioError("作品集照片最多 100 张");
  if (photos.length > 0 && folders.length === 0) throw portfolioError("请先创建作品集文件夹");

  const folderIds = new Set<string>();
  const folderNames = new Set<string>();
  for (const f of folders) {
    if (folderIds.has(f.id)) throw portfolioError("作品集文件夹 id 重复");
    folderIds.add(f.id);
    if (folderNames.has(f.name)) throw portfolioError("作品集文件夹名称不能重复");
    folderNames.add(f.name);
  }

  for (const p of photos) {
    if (!isRemotePortfolioImageUrl(p.url)) {
      throw portfolioError("照片需先上传至服务器（http/https 链接）");
    }
    if (!folderIds.has(p.folderId)) throw portfolioError("照片所属文件夹不存在");
  }

  for (const f of folders) {
    const cid = f.coverPhotoId?.trim();
    if (!cid) continue;
    const inFolder = photos.filter((p) => p.folderId === f.id);
    if (!inFolder.some((p) => p.id === cid)) {
      throw portfolioError("文件夹封面必须为该文件夹内的照片");
    }
  }

  return {
    folders: finalizeFolderCovers(folders, photos),
    photos
  };
}

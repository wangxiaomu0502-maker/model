export const CONTENT_REVIEW_STATUS = {
  DRAFT: 0,
  PENDING: 1,
  APPROVED: 2,
  REJECTED: 3
} as const;

export type ModelContentReviewSection = "card" | "portfolio" | "stylePosition";

export type ModelContentReviewItem = {
  status: number;
  rejectReason: string | null;
  pendingCount: number;
  rejectedCount: number;
};

export type ModelContentReviewState = Record<ModelContentReviewSection, ModelContentReviewItem>;

const DEFAULT_APPROVED: ModelContentReviewItem = {
  status: CONTENT_REVIEW_STATUS.APPROVED,
  rejectReason: null,
  pendingCount: 0,
  rejectedCount: 0
};

type ReviewablePhoto = {
  url?: unknown;
  reviewStatus?: unknown;
  rejectReason?: unknown;
};

export function normalizePhotoReviewStatus(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return CONTENT_REVIEW_STATUS.APPROVED;
  if (
    n === CONTENT_REVIEW_STATUS.DRAFT ||
    n === CONTENT_REVIEW_STATUS.PENDING ||
    n === CONTENT_REVIEW_STATUS.APPROVED ||
    n === CONTENT_REVIEW_STATUS.REJECTED
  ) {
    return n;
  }
  return CONTENT_REVIEW_STATUS.APPROVED;
}

export function isContentReviewApproved(status: unknown): boolean {
  return normalizePhotoReviewStatus(status) === CONTENT_REVIEW_STATUS.APPROVED;
}

export function getPhotoReviewId(
  section: ModelContentReviewSection,
  photo: Record<string, unknown>
): string {
  if (section === "card") return String(photo.key || "").trim();
  return String(photo.id || "").trim();
}

export function extractSectionPhotos(
  section: ModelContentReviewSection,
  payload: Record<string, unknown> | null | undefined
): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== "object") return [];
  if (section === "card") {
    const angles = payload.photoAngles;
    return Array.isArray(angles)
      ? angles.filter((item) => item && typeof item === "object").map((item) => item as Record<string, unknown>)
      : [];
  }
  const photos = payload.photos;
  return Array.isArray(photos)
    ? photos.filter((item) => item && typeof item === "object").map((item) => item as Record<string, unknown>)
    : [];
}

export function hasExplicitPhotoReviewStatus(photo: ReviewablePhoto): boolean {
  return photo.reviewStatus !== undefined && photo.reviewStatus !== null && String(photo.reviewStatus).trim() !== "";
}

/** 读取有效审核状态；兼容旧数据：模块级待审但图片未写 reviewStatus */
export function effectivePhotoReviewStatus(
  photo: ReviewablePhoto,
  legacySectionPending = false
): number {
  const url = String(photo.url || "").trim();
  if (!url) return CONTENT_REVIEW_STATUS.DRAFT;
  if (hasExplicitPhotoReviewStatus(photo)) {
    return normalizePhotoReviewStatus(photo.reviewStatus);
  }
  if (legacySectionPending) return CONTENT_REVIEW_STATUS.PENDING;
  return CONTENT_REVIEW_STATUS.APPROVED;
}

/** 将旧版「模块待审、图片无 reviewStatus」的数据补齐为单图待审 */
export function materializeLegacyPhotoReviewsInPayload(
  section: ModelContentReviewSection,
  payload: Record<string, unknown>,
  sectionDbStatus: unknown
): Record<string, unknown> {
  const legacyPending = Number(sectionDbStatus) === CONTENT_REVIEW_STATUS.PENDING;
  if (!legacyPending) return payload;

  const materialize = (photo: Record<string, unknown>): Record<string, unknown> => {
    const url = String(photo.url || "").trim();
    if (!url || hasExplicitPhotoReviewStatus(photo)) return photo;
    return { ...photo, reviewStatus: CONTENT_REVIEW_STATUS.PENDING };
  };

  if (section === "card") {
    return { ...payload, photoAngles: extractSectionPhotos(section, payload).map(materialize) };
  }
  return { ...payload, photos: extractSectionPhotos(section, payload).map(materialize) };
}

export function summarizePhotoReviews(
  photos: ReviewablePhoto[],
  legacySectionPending = false
): {
  pendingCount: number;
  rejectedCount: number;
  approvedCount: number;
  withUrlCount: number;
} {
  let pendingCount = 0;
  let rejectedCount = 0;
  let approvedCount = 0;
  let withUrlCount = 0;
  photos.forEach((photo) => {
    const url = String(photo.url || "").trim();
    if (!url) return;
    withUrlCount += 1;
    const status = effectivePhotoReviewStatus(photo, legacySectionPending);
    if (status === CONTENT_REVIEW_STATUS.PENDING) pendingCount += 1;
    else if (status === CONTENT_REVIEW_STATUS.REJECTED) rejectedCount += 1;
    else if (status === CONTENT_REVIEW_STATUS.APPROVED) approvedCount += 1;
  });
  return { pendingCount, rejectedCount, approvedCount, withUrlCount };
}

export function deriveSectionReviewFromPhotos(
  photos: ReviewablePhoto[],
  legacySectionPending = false
): {
  status: number;
  rejectReason: string | null;
  pendingCount: number;
  rejectedCount: number;
} {
  const summary = summarizePhotoReviews(photos, legacySectionPending);
  if (summary.withUrlCount === 0) {
    return {
      status: CONTENT_REVIEW_STATUS.DRAFT,
      rejectReason: null,
      pendingCount: 0,
      rejectedCount: 0
    };
  }
  if (summary.pendingCount > 0) {
    return {
      status: CONTENT_REVIEW_STATUS.PENDING,
      rejectReason: null,
      pendingCount: summary.pendingCount,
      rejectedCount: summary.rejectedCount
    };
  }
  if (summary.rejectedCount > 0) {
    const firstRejected = photos.find((photo) => {
      const url = String(photo.url || "").trim();
      return (
        url &&
        effectivePhotoReviewStatus(photo, legacySectionPending) === CONTENT_REVIEW_STATUS.REJECTED
      );
    });
    const reason = firstRejected?.rejectReason != null ? String(firstRejected.rejectReason).trim() : "";
    return {
      status: CONTENT_REVIEW_STATUS.REJECTED,
      rejectReason: reason || null,
      pendingCount: 0,
      rejectedCount: summary.rejectedCount
    };
  }
  return {
    status: CONTENT_REVIEW_STATUS.APPROVED,
    rejectReason: null,
    pendingCount: 0,
    rejectedCount: 0
  };
}

function mergeOnePhotoReview(
  oldPhoto: Record<string, unknown> | undefined,
  newPhoto: Record<string, unknown>,
  autoApprove: boolean
): Record<string, unknown> {
  let url = String(newPhoto.url || "").trim();
  const oldUrl = oldPhoto ? String(oldPhoto.url || "").trim() : "";
  const explicitlyCleared = newPhoto.cleared === true;

  if (!url && oldUrl && !explicitlyCleared) {
    url = oldUrl;
  }

  let reviewStatus: number = CONTENT_REVIEW_STATUS.APPROVED;
  let rejectReason: string | null = null;

  if (!url) {
    reviewStatus = CONTENT_REVIEW_STATUS.DRAFT;
  } else if (autoApprove) {
    reviewStatus = CONTENT_REVIEW_STATUS.APPROVED;
  } else if (!oldPhoto || oldUrl !== url) {
    reviewStatus = CONTENT_REVIEW_STATUS.PENDING;
  } else {
    reviewStatus = normalizePhotoReviewStatus(oldPhoto.reviewStatus);
    rejectReason =
      reviewStatus === CONTENT_REVIEW_STATUS.REJECTED
        ? String(oldPhoto.rejectReason || "").trim() || null
        : null;
  }

  const next: Record<string, unknown> = { ...newPhoto, url, reviewStatus };
  delete next.cleared;
  if (rejectReason) next.rejectReason = rejectReason;
  else delete next.rejectReason;
  return next;
}

export function mergeSectionPhotoReviewsOnSave(
  section: ModelContentReviewSection,
  oldPayload: Record<string, unknown> | null | undefined,
  newPayload: Record<string, unknown>,
  options?: { autoApprove?: boolean; allowClearAllPhotos?: boolean }
): Record<string, unknown> {
  const autoApprove = Boolean(options?.autoApprove);
  const allowClearAllPhotos = Boolean(options?.allowClearAllPhotos);
  const oldPhotos = extractSectionPhotos(section, oldPayload || undefined);
  const oldMap = new Map(oldPhotos.map((photo) => [getPhotoReviewId(section, photo), photo]));
  const oldWithUrlCount = oldPhotos.filter((photo) => String(photo.url || "").trim()).length;

  if (section === "card") {
    const incoming = Array.isArray(newPayload.photoAngles) ? newPayload.photoAngles : [];
    if (
      !allowClearAllPhotos &&
      oldWithUrlCount > 0 &&
      incoming.length === 0
    ) {
      return { ...newPayload, photoAngles: oldPhotos };
    }
    const photoAngles = incoming
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const photo = item as Record<string, unknown>;
        const id = getPhotoReviewId(section, photo);
        return mergeOnePhotoReview(oldMap.get(id), photo, autoApprove);
      });
    return { ...newPayload, photoAngles };
  }

  const incoming = Array.isArray(newPayload.photos) ? newPayload.photos : [];
  if (
    !allowClearAllPhotos &&
    oldWithUrlCount > 0 &&
    incoming.length === 0
  ) {
    return { ...newPayload, photos: oldPhotos };
  }
  const photos = incoming
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const photo = item as Record<string, unknown>;
      const id = getPhotoReviewId(section, photo);
      return mergeOnePhotoReview(oldMap.get(id), photo, autoApprove);
    });
  return { ...newPayload, photos };
}

export function applyPhotoReviewDecisionsToPayload(
  section: ModelContentReviewSection,
  payload: Record<string, unknown>,
  photoIds: string[] | undefined,
  decision: "approve" | "reject",
  rejectReason?: string | null,
  legacySectionPending = false
): { payload: Record<string, unknown>; updatedCount: number } {
  const targetIds =
    photoIds && photoIds.length > 0
      ? new Set(photoIds.map((id) => String(id).trim()).filter(Boolean))
      : null;
  const reason = decision === "reject" ? String(rejectReason || "").trim() || null : null;
  let updatedCount = 0;

  const updatePhoto = (photo: Record<string, unknown>): Record<string, unknown> => {
    const url = String(photo.url || "").trim();
    if (!url) return photo;
    const id = getPhotoReviewId(section, photo);
    if (!id) return photo;
    if (targetIds && !targetIds.has(id)) return photo;
    if (effectivePhotoReviewStatus(photo, legacySectionPending) !== CONTENT_REVIEW_STATUS.PENDING) {
      return photo;
    }
    updatedCount += 1;
    const next: Record<string, unknown> = {
      ...photo,
      reviewStatus:
        decision === "approve" ? CONTENT_REVIEW_STATUS.APPROVED : CONTENT_REVIEW_STATUS.REJECTED
    };
    if (decision === "reject" && reason) next.rejectReason = reason;
    else delete next.rejectReason;
    return next;
  };

  if (section === "card") {
    const photoAngles = extractSectionPhotos(section, payload).map(updatePhoto);
    return { payload: { ...payload, photoAngles }, updatedCount };
  }

  const photos = extractSectionPhotos(section, payload).map(updatePhoto);
  return { payload: { ...payload, photos }, updatedCount };
}

export function approveAllPhotosInPayload(
  section: ModelContentReviewSection,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const approvePhoto = (photo: Record<string, unknown>): Record<string, unknown> => {
    const url = String(photo.url || "").trim();
    if (!url) return photo;
    const next: Record<string, unknown> = { ...photo, reviewStatus: CONTENT_REVIEW_STATUS.APPROVED };
    delete next.rejectReason;
    return next;
  };

  if (section === "card") {
    return { ...payload, photoAngles: extractSectionPhotos(section, payload).map(approvePhoto) };
  }
  return { ...payload, photos: extractSectionPhotos(section, payload).map(approvePhoto) };
}

export function stripSectionPhotosForPublic(
  section: ModelContentReviewSection,
  payload: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!payload || typeof payload !== "object") {
    if (section === "card") return { photoAngles: [], measurements: {}, hairColor: "", skinColor: "" };
    if (section === "portfolio") return { folders: [], photos: [] };
    return { photos: [] };
  }

  if (section === "card") {
    const photoAngles = extractSectionPhotos(section, payload)
      .filter((photo) => {
        const url = String(photo.url || "").trim();
        return url && isContentReviewApproved(photo.reviewStatus);
      })
      .map(({ reviewStatus: _rs, rejectReason: _rr, ...rest }) => rest);
    return {
      ...payload,
      photoAngles
    };
  }

  if (section === "portfolio") {
    const approvedPhotos = extractSectionPhotos(section, payload)
      .filter((photo) => {
        const url = String(photo.url || "").trim();
        return url && isContentReviewApproved(photo.reviewStatus);
      })
      .map(({ reviewStatus: _rs, rejectReason: _rr, ...rest }) => rest);
    const approvedIds = new Set(
      approvedPhotos.map((photo) => String((photo as Record<string, unknown>).id || ""))
    );
    const folders = Array.isArray(payload.folders)
      ? (payload.folders as Array<Record<string, unknown>>)
          .map((folder) => {
            const folderId = String(folder.id || "");
            const inFolder = approvedPhotos.filter(
              (photo) => String((photo as Record<string, unknown>).folderId || "") === folderId
            );
            if (!inFolder.length) return null;
            let coverPhotoId = String(folder.coverPhotoId || "").trim();
            if (!coverPhotoId || !approvedIds.has(coverPhotoId)) {
              coverPhotoId = String((inFolder[0] as Record<string, unknown>).id || "");
            }
            const nextFolder: Record<string, unknown> = {
              id: folder.id,
              name: folder.name
            };
            if (coverPhotoId) nextFolder.coverPhotoId = coverPhotoId;
            return nextFolder;
          })
          .filter((folder): folder is Record<string, unknown> => folder != null)
      : [];
    return { folders, photos: approvedPhotos };
  }

  const photos = extractSectionPhotos(section, payload)
    .filter((photo) => {
      const url = String(photo.url || "").trim();
      return url && isContentReviewApproved(photo.reviewStatus);
    })
    .map(({ reviewStatus: _rs, rejectReason: _rr, ...rest }) => rest);
  return { photos };
}

export function buildDefaultContentReviewState(): ModelContentReviewState {
  return {
    card: { ...DEFAULT_APPROVED },
    portfolio: { ...DEFAULT_APPROVED },
    stylePosition: { ...DEFAULT_APPROVED }
  };
}

export function buildContentReviewState(
  card: Record<string, unknown> | null | undefined,
  portfolio: Record<string, unknown> | null | undefined,
  stylePosition: Record<string, unknown> | null | undefined,
  legacy?: {
    cardSectionPending?: boolean;
    portfolioSectionPending?: boolean;
    styleSectionPending?: boolean;
  }
): ModelContentReviewState {
  const cardDerived = deriveSectionReviewFromPhotos(
    extractSectionPhotos("card", card || undefined),
    Boolean(legacy?.cardSectionPending)
  );
  const portfolioDerived = deriveSectionReviewFromPhotos(
    extractSectionPhotos("portfolio", portfolio || undefined),
    Boolean(legacy?.portfolioSectionPending)
  );
  const styleDerived = deriveSectionReviewFromPhotos(
    extractSectionPhotos("stylePosition", stylePosition || undefined),
    Boolean(legacy?.styleSectionPending)
  );
  return {
    card: {
      status: cardDerived.status,
      rejectReason: cardDerived.rejectReason,
      pendingCount: cardDerived.pendingCount,
      rejectedCount: cardDerived.rejectedCount
    },
    portfolio: {
      status: portfolioDerived.status,
      rejectReason: portfolioDerived.rejectReason,
      pendingCount: portfolioDerived.pendingCount,
      rejectedCount: portfolioDerived.rejectedCount
    },
    stylePosition: {
      status: styleDerived.status,
      rejectReason: styleDerived.rejectReason,
      pendingCount: styleDerived.pendingCount,
      rejectedCount: styleDerived.rejectedCount
    }
  };
}

/** 兼容旧列：若 JSON 无单图状态，默认已通过 */
export function parseContentReviewStateFromExtra(extra: {
  card_review_status?: unknown;
  card_review_reject_reason?: unknown;
  portfolio_review_status?: unknown;
  portfolio_review_reject_reason?: unknown;
  style_position_review_status?: unknown;
  style_position_review_reject_reason?: unknown;
} | null | undefined): ModelContentReviewState {
  if (!extra) return buildDefaultContentReviewState();
  const reason = (value: unknown) => {
    const s = value != null ? String(value).trim() : "";
    return s || null;
  };
  const status = (value: unknown) => normalizePhotoReviewStatus(value);
  return {
    card: {
      status: status(extra.card_review_status),
      rejectReason: reason(extra.card_review_reject_reason),
      pendingCount: 0,
      rejectedCount: 0
    },
    portfolio: {
      status: status(extra.portfolio_review_status),
      rejectReason: reason(extra.portfolio_review_reject_reason),
      pendingCount: 0,
      rejectedCount: 0
    },
    stylePosition: {
      status: status(extra.style_position_review_status),
      rejectReason: reason(extra.style_position_review_reject_reason),
      pendingCount: 0,
      rejectedCount: 0
    }
  };
}

export type ContentReviewPendingCounts = {
  card: number;
  portfolio: number;
  stylePosition: number;
};

function parseReviewJsonPayload(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return {};
    try {
      const parsed = JSON.parse(s) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function countPendingPhotosForSection(
  section: ModelContentReviewSection,
  rawJson: unknown,
  sectionDbStatus?: unknown
): number {
  const payload = parseReviewJsonPayload(rawJson);
  const materialized = materializeLegacyPhotoReviewsInPayload(section, payload, sectionDbStatus);
  return summarizePhotoReviews(extractSectionPhotos(section, materialized)).pendingCount;
}

export function buildContentReviewPendingCounts(
  cardJson: unknown,
  portfolioJson: unknown,
  stylePositionJson: unknown,
  sectionStatuses?: {
    card?: unknown;
    portfolio?: unknown;
    stylePosition?: unknown;
  }
): ContentReviewPendingCounts {
  return {
    card: countPendingPhotosForSection("card", cardJson, sectionStatuses?.card),
    portfolio: countPendingPhotosForSection("portfolio", portfolioJson, sectionStatuses?.portfolio),
    stylePosition: countPendingPhotosForSection(
      "stylePosition",
      stylePositionJson,
      sectionStatuses?.stylePosition
    )
  };
}

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { UploadRequestOptions } from "element-plus";
import { Plus, Shop } from "@element-plus/icons-vue";
import { codeToText, regionData } from "element-china-area-data";

import {
  createCommercialShoot,
  createCommercialShootPackage,
  deleteCommercialShoot,
  deleteCommercialShootPackage,
  fetchCommercialShoots,
  fetchCommercialShootPackages,
  updateCommercialShoot,
  updateCommercialShootPackage,
  uploadAdminAssetImage,
  type CommercialShootPackageRow,
  type CommercialShootRow
} from "@/api/admin";

const loading = ref(false);
const saving = ref(false);
const list = ref<CommercialShootRow[]>([]);
const total = ref(0);
const pager = reactive({ page: 1, pageSize: 20 });

const packageDrawerVisible = ref(false);
const packageVenue = ref<CommercialShootRow | null>(null);
const packageLoading = ref(false);
const packageSaving = ref(false);
const packageList = ref<CommercialShootPackageRow[]>([]);
const packageTotal = ref(0);
const packagePager = reactive({ page: 1, pageSize: 20 });
const packageDialogVisible = ref(false);
const packageDialogMode = ref<"create" | "edit">("create");
const packageEditingId = ref<number | null>(null);
const packageCoverUploading = ref(false);

const packageForm = reactive({
  name: "",
  fee: "",
  listPrice: "",
  remark: "",
  coverUrl: "",
  sortOrder: 0
});

const dialogVisible = ref(false);
const dialogMode = ref<"create" | "edit">("create");
const editingId = ref<number | null>(null);

const form = reactive({
  name: "",
  regionCodes: [] as string[],
  detailAddress: "",
  contactName: "",
  contactPhone: "",
  priceRange: "",
  description: "",
  imageUrls: [] as string[]
});

const imageUploading = ref(false);

function formatTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { hour12: false });
}

function trimText(value: string): string {
  return value.trim();
}

function pickRegionLabels(codes: string[]): { province: string | null; city: string | null; district: string | null } {
  return {
    province: codes[0] ? codeToText[codes[0]] || null : null,
    city: codes[1] ? codeToText[codes[1]] || null : null,
    district: codes[2] ? codeToText[codes[2]] || null : null
  };
}

function findRegionCodes(row: CommercialShootRow): string[] {
  const provinceEntry = regionData.find((province) => province.label === row.province);
  const cityEntry = provinceEntry?.children?.find((city) => city.label === row.city);
  const districtEntry = cityEntry?.children?.find((district) => district.label === row.district);
  return [provinceEntry?.value, cityEntry?.value, districtEntry?.value].filter(Boolean) as string[];
}

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const data = await fetchCommercialShoots({
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

async function loadPackageList(): Promise<void> {
  const shootId = packageVenue.value?.id;
  if (!shootId) return;
  packageLoading.value = true;
  try {
    const data = await fetchCommercialShootPackages(shootId, {
      page: packagePager.page,
      pageSize: packagePager.pageSize
    });
    packageList.value = data.list;
    packageTotal.value = data.total;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "套餐加载失败");
  } finally {
    packageLoading.value = false;
  }
}

function openPackageManager(row: CommercialShootRow): void {
  packageVenue.value = row;
  packagePager.page = 1;
  packageDrawerVisible.value = true;
  void loadPackageList();
}

function closePackageDrawer(): void {
  packageDrawerVisible.value = false;
  packageVenue.value = null;
  packageList.value = [];
  packageTotal.value = 0;
}

function resetPackageForm(): void {
  packageForm.name = "";
  packageForm.fee = "";
  packageForm.listPrice = "";
  packageForm.remark = "";
  packageForm.coverUrl = "";
  packageForm.sortOrder = 0;
}

function openPackageCreate(): void {
  packageDialogMode.value = "create";
  packageEditingId.value = null;
  resetPackageForm();
  packageDialogVisible.value = true;
}

function openPackageEdit(row: CommercialShootPackageRow): void {
  packageDialogMode.value = "edit";
  packageEditingId.value = row.id;
  packageForm.name = row.name;
  packageForm.fee = row.fee;
  packageForm.listPrice = row.listPrice || "";
  packageForm.remark = row.remark || "";
  packageForm.coverUrl = row.coverUrl;
  packageForm.sortOrder = Number(row.sortOrder || 0);
  packageDialogVisible.value = true;
}

async function onSavePackage(): Promise<void> {
  const name = packageForm.name.trim();
  if (!name) {
    ElMessage.warning("请填写套餐名称");
    return;
  }
  const fee = packageForm.fee.trim();
  if (!fee) {
    ElMessage.warning("请填写费用");
    return;
  }
  const listPrice = packageForm.listPrice.trim();
  if (!listPrice) {
    ElMessage.warning("请填写标牌价");
    return;
  }
  if (!packageForm.coverUrl.trim()) {
    ElMessage.warning("请上传头图");
    return;
  }
  packageSaving.value = true;
  try {
    const shootId = packageVenue.value?.id;
    if (!shootId) {
      ElMessage.warning("请先选择商拍场地");
      return;
    }
    const body = {
      name,
      fee,
      listPrice,
      remark: packageForm.remark.trim(),
      coverUrl: packageForm.coverUrl.trim(),
      sortOrder: Number(packageForm.sortOrder || 0)
    };
    if (packageDialogMode.value === "create") {
      await createCommercialShootPackage(shootId, body);
      ElMessage.success("已新增套餐");
    } else if (packageEditingId.value != null) {
      await updateCommercialShootPackage(shootId, packageEditingId.value, body);
      ElMessage.success("已保存套餐");
    }
    packageDialogVisible.value = false;
    await loadPackageList();
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    packageSaving.value = false;
  }
}

async function uploadPackageCover(options: UploadRequestOptions): Promise<void> {
  const file = options.file as File;
  packageCoverUploading.value = true;
  try {
    const url = await uploadAdminAssetImage(file);
    packageForm.coverUrl = url;
    options.onSuccess?.({ url });
    ElMessage.success("头图上传成功");
  } catch (e) {
    const error = e instanceof Error ? e : new Error("上传失败");
    options.onError?.(error as unknown as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0]);
    ElMessage.error(error.message);
  } finally {
    packageCoverUploading.value = false;
  }
}

function removePackageCover(): void {
  packageForm.coverUrl = "";
}

async function onDeletePackage(row: CommercialShootPackageRow): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除商拍套餐「${row.name}」？此操作不可恢复。`, "删除确认", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }
  try {
    const shootId = packageVenue.value?.id;
    if (!shootId) return;
    await deleteCommercialShootPackage(shootId, row.id);
    ElMessage.success("已删除");
    if (packageList.value.length === 1 && packagePager.page > 1) {
      packagePager.page -= 1;
    }
    await loadPackageList();
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
  }
}

function onPackagePageChange(page: number): void {
  packagePager.page = page;
  void loadPackageList();
}

function onPackageSizeChange(size: number): void {
  packagePager.pageSize = size;
  packagePager.page = 1;
  void loadPackageList();
}

function resetForm(): void {
  form.name = "";
  form.regionCodes = [];
  form.detailAddress = "";
  form.contactName = "";
  form.contactPhone = "";
  form.priceRange = "";
  form.description = "";
  form.imageUrls = [];
}

function openCreate(): void {
  dialogMode.value = "create";
  editingId.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: CommercialShootRow): void {
  dialogMode.value = "edit";
  editingId.value = row.id;
  form.name = row.name;
  form.regionCodes = findRegionCodes(row);
  form.detailAddress = row.detailAddress ?? "";
  form.contactName = row.contactName ?? "";
  form.contactPhone = row.contactPhone ?? "";
  form.priceRange = row.priceRange ?? "";
  form.description = row.description ?? "";
  form.imageUrls = row.imageUrls.slice(0, 9);
  dialogVisible.value = true;
}

async function onSave(): Promise<void> {
  const name = form.name.trim();
  if (!name) {
    ElMessage.warning("请填写名称");
    return;
  }
  if (form.regionCodes.length < 3) {
    ElMessage.warning("请选择完整的省市区");
    return;
  }
  const detailAddress = trimText(form.detailAddress);
  if (!detailAddress) {
    ElMessage.warning("请填写详细地址");
    return;
  }
  const contactName = trimText(form.contactName);
  if (!contactName) {
    ElMessage.warning("请填写联系人");
    return;
  }
  const contactPhone = trimText(form.contactPhone);
  if (!contactPhone) {
    ElMessage.warning("请填写联系方式");
    return;
  }
  const priceRange = trimText(form.priceRange);
  if (!priceRange) {
    ElMessage.warning("请填写价格区间");
    return;
  }
  const description = trimText(form.description);
  if (!description) {
    ElMessage.warning("请填写介绍");
    return;
  }
  if (form.imageUrls.length < 1) {
    ElMessage.warning("请至少上传1张图片");
    return;
  }
  const region = pickRegionLabels(form.regionCodes);
  saving.value = true;
  try {
    const body = {
      name,
      province: region.province,
      city: region.city,
      district: region.district,
      detailAddress,
      contactName,
      contactPhone,
      priceRange,
      description,
      imageUrls: form.imageUrls.slice(0, 9)
    };
    if (dialogMode.value === "create") {
      await createCommercialShoot(body);
      ElMessage.success("已新增商拍");
    } else if (editingId.value != null) {
      await updateCommercialShoot(editingId.value, body);
      ElMessage.success("已保存");
    }
    dialogVisible.value = false;
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

async function uploadShootImage(options: UploadRequestOptions): Promise<void> {
  const file = options.file as File;
  if (form.imageUrls.length >= 9) {
    const error = new Error("图片最多上传9张");
    options.onError?.(error as unknown as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0]);
    ElMessage.warning(error.message);
    return;
  }
  imageUploading.value = true;
  try {
    const url = await uploadAdminAssetImage(file);
    form.imageUrls = form.imageUrls.concat(url).slice(0, 9);
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

function removeShootImage(index: number): void {
  form.imageUrls.splice(index, 1);
}

async function onDelete(row: CommercialShootRow): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除商拍中心「${row.name}」？此操作不可恢复。`, "删除确认", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }
  try {
    await deleteCommercialShoot(row.id);
    ElMessage.success("已删除");
    if (list.value.length === 1 && pager.page > 1) {
      pager.page -= 1;
    }
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
  }
}

function onPageChange(page: number): void {
  pager.page = page;
  void loadList();
}

function onSizeChange(size: number): void {
  pager.pageSize = size;
  pager.page = 1;
  void loadList();
}

onMounted(() => {
  void loadList();
});
</script>

<template>
  <div class="alv-page">
    <header class="alv-hero">
      <div class="alv-hero-text">
        <h1 class="alv-hero-title">商拍中心</h1>
        <p class="alv-hero-sub">维护小程序商拍中心展示内容，套餐挂在各场地下管理</p>
      </div>
    </header>

    <div class="shoot-tab-toolbar">
      <p class="shoot-tab-summary">共 <strong>{{ total }}</strong> 条场地记录</p>
      <el-button type="primary" round @click="openCreate">
        <el-icon><Plus /></el-icon>
        新增商拍
      </el-button>
    </div>

    <el-card shadow="never" class="alv-card">
      <div class="alv-table-wrap">
        <el-table
          v-loading="loading"
          class="alv-table"
          :data="list"
          empty-text="暂无商拍内容，点击右上角新增"
          row-key="id"
          :row-class-name="() => 'alv-table-row'"
        >
          <el-table-column prop="id" label="ID" width="80" align="center">
            <template #default="{ row }">
              <span class="alv-id-badge">{{ row.id }}</span>
            </template>
          </el-table-column>
          <el-table-column label="名称" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="shoot-title">{{ row.name }}</div>
            </template>
          </el-table-column>
          <el-table-column label="地址" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              {{
                [row.province, row.city, row.district, row.detailAddress]
                  .filter(Boolean)
                  .join(" ") || "—"
              }}
            </template>
          </el-table-column>
          <el-table-column label="联系人" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.contactName || "—" }}
            </template>
          </el-table-column>
          <el-table-column label="联系方式" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.contactPhone || "—" }}
            </template>
          </el-table-column>
          <el-table-column label="价格区间" min-width="130" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.priceRange || "—" }}
            </template>
          </el-table-column>
          <el-table-column label="套餐" width="100" align="center">
            <template #default="{ row }">
              <el-tag size="small" effect="light" round>{{ row.packageCount ?? 0 }} 个</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="图片" width="90" align="center">
            <template #default="{ row }">
              <el-tag size="small" effect="light" round>{{ row.imageUrls.length }} 张</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" min-width="168">
            <template #default="{ row }">
              <span class="alv-time">{{ formatTime(row.updatedAt) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openPackageManager(row)">管理套餐</el-button>
              <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button link type="danger" @click="onDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="alv-pager">
          <el-pagination
            v-model:current-page="pager.page"
            v-model:page-size="pager.pageSize"
            :total="total"
            :page-sizes="[10, 20, 50]"
            layout="total, prev, pager, next, sizes"
            background
            @current-change="onPageChange"
            @size-change="onSizeChange"
          />
        </div>
      </div>
    </el-card>

    <el-drawer
      v-model="packageDrawerVisible"
      :title="packageVenue ? `「${packageVenue.name}」的套餐` : '商拍套餐'"
      size="720px"
      destroy-on-close
      @closed="closePackageDrawer"
    >
      <div class="shoot-tab-toolbar">
        <p class="shoot-tab-summary">共 <strong>{{ packageTotal }}</strong> 个套餐</p>
        <el-button type="primary" round @click="openPackageCreate">
          <el-icon><Plus /></el-icon>
          新增套餐
        </el-button>
      </div>

      <el-table
        v-loading="packageLoading"
        class="alv-table"
        :data="packageList"
        empty-text="暂无套餐，点击右上角新增"
        row-key="id"
      >
        <el-table-column prop="id" label="ID" width="80" align="center">
          <template #default="{ row }">
            <span class="alv-id-badge">{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="头图" width="100" align="center">
          <template #default="{ row }">
            <img v-if="row.coverUrl" class="package-cover-thumb" :src="row.coverUrl" alt="" />
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="名称" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="shoot-title">{{ row.name }}</div>
          </template>
        </el-table-column>
        <el-table-column label="费用" min-width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ row.fee || "—" }}</template>
        </el-table-column>
        <el-table-column label="标牌价" min-width="110" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="shoot-list-price">{{ row.listPrice || "—" }}</span>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || "—" }}</template>
        </el-table-column>
        <el-table-column label="排序" width="80" align="center">
          <template #default="{ row }">{{ row.sortOrder ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openPackageEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="onDeletePackage(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="alv-pager">
        <el-pagination
          v-model:current-page="packagePager.page"
          v-model:page-size="packagePager.pageSize"
          :total="packageTotal"
          :page-sizes="[10, 20, 50]"
          layout="total, prev, pager, next, sizes"
          background
          @current-change="onPackagePageChange"
          @size-change="onPackageSizeChange"
        />
      </div>
    </el-drawer>

    <el-dialog
      v-model="packageDialogVisible"
      width="640px"
      class="shoot-dialog"
      destroy-on-close
      align-center
    >
      <template #header>
        <div class="shoot-dialog-header">
          <div class="shoot-dialog-header-icon" aria-hidden="true">
            <el-icon :size="22"><Shop /></el-icon>
          </div>
          <div class="shoot-dialog-header-text">
            <h2 class="shoot-dialog-title">
              {{ packageDialogMode === "create" ? "新增商拍套餐" : "编辑商拍套餐" }}
            </h2>
            <p class="shoot-dialog-desc">配置套餐名称、费用、标牌价、备注与头图。</p>
          </div>
        </div>
      </template>

      <el-form label-position="top" class="shoot-form" @submit.prevent="onSavePackage">
        <el-form-item label="套餐名称" required>
          <el-input v-model="packageForm.name" maxlength="120" show-word-limit clearable />
        </el-form-item>
        <div class="shoot-form-grid package-form-grid">
          <el-form-item label="费用" required>
            <el-input v-model="packageForm.fee" maxlength="120" placeholder="实际费用，如：¥1200" clearable />
          </el-form-item>
          <el-form-item label="标牌价" required>
            <el-input v-model="packageForm.listPrice" maxlength="120" placeholder="对外展示标价，如：¥1500" clearable />
          </el-form-item>
        </div>
        <el-form-item label="排序">
          <el-input-number v-model="packageForm.sortOrder" :min="0" :max="999999" controls-position="right" />
          <p class="shoot-field-hint">数值越小，小程序展示越靠前</p>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="packageForm.remark"
            type="textarea"
            :rows="3"
            maxlength="2000"
            show-word-limit
            placeholder="选填，补充套餐说明"
          />
        </el-form-item>
        <el-form-item label="头图" required>
          <div class="shoot-image-editor">
            <div v-if="packageForm.coverUrl" class="package-cover-preview">
              <img class="package-cover-preview-img" :src="packageForm.coverUrl" alt="" />
              <button type="button" class="shoot-image-remove" @click="removePackageCover">删除</button>
            </div>
            <el-upload
              v-else
              class="shoot-image-uploader"
              drag
              accept="image/jpeg,image/png,image/webp"
              :show-file-list="false"
              :http-request="uploadPackageCover"
            >
              <div class="shoot-upload-inner">
                <el-icon><Plus /></el-icon>
                <span>{{ packageCoverUploading ? "上传中..." : "上传头图" }}</span>
                <small>支持 JPG/PNG/WEBP</small>
              </div>
            </el-upload>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="shoot-dialog-footer">
          <el-button size="large" @click="packageDialogVisible = false">取消</el-button>
          <el-button type="primary" size="large" :loading="packageSaving" @click="onSavePackage">
            {{ packageDialogMode === "create" ? "新增套餐" : "保存修改" }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="dialogVisible"
      width="860px"
      class="shoot-dialog"
      destroy-on-close
      align-center
    >
      <template #header>
        <div class="shoot-dialog-header">
          <div class="shoot-dialog-header-icon" aria-hidden="true">
            <el-icon :size="22"><Shop /></el-icon>
          </div>
          <div class="shoot-dialog-header-text">
            <h2 class="shoot-dialog-title">
              {{ dialogMode === "create" ? "新增商拍" : "编辑商拍" }}
            </h2>
            <p class="shoot-dialog-desc">维护小程序商拍中心展示信息。</p>
          </div>
        </div>
      </template>

      <el-form label-position="top" class="shoot-form" @submit.prevent="onSave">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" maxlength="120" show-word-limit clearable />
        </el-form-item>
        <div class="shoot-form-grid">
          <el-form-item label="省市区" required>
            <el-cascader
              v-model="form.regionCodes"
              :options="regionData"
              clearable
              filterable
              placeholder="请选择省 / 市 / 区"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="详细地址" required>
            <el-input v-model="form.detailAddress" maxlength="255" clearable />
          </el-form-item>
          <el-form-item label="联系人" required>
            <el-input v-model="form.contactName" maxlength="64" clearable />
          </el-form-item>
          <el-form-item label="联系方式" required>
            <el-input v-model="form.contactPhone" maxlength="64" clearable />
          </el-form-item>
          <el-form-item label="价格区间" required>
            <el-input v-model="form.priceRange" maxlength="120" placeholder="如：¥1200-¥1800" clearable />
          </el-form-item>
        </div>
        <el-form-item label="介绍" required>
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            maxlength="2000"
            show-word-limit
            placeholder="填写商拍中心介绍"
          />
        </el-form-item>
        <el-form-item label="图片展示" required>
          <div class="shoot-image-editor">
            <div v-if="form.imageUrls.length > 0" class="shoot-image-grid">
              <div v-for="(url, index) in form.imageUrls" :key="`${url}_${index}`" class="shoot-image-item">
                <img class="shoot-image-thumb" :src="url" alt="" />
                <button type="button" class="shoot-image-remove" @click="removeShootImage(index)">
                  删除
                </button>
              </div>
            </div>
            <el-upload
              v-if="form.imageUrls.length < 9"
              class="shoot-image-uploader"
              drag
              multiple
              accept="image/jpeg,image/png,image/webp"
              :show-file-list="false"
              :http-request="uploadShootImage"
            >
              <div class="shoot-upload-inner">
                <el-icon><Plus /></el-icon>
                <span>{{ imageUploading ? "上传中..." : "上传图片" }}</span>
                <small>最多9张，支持 JPG/PNG/WEBP</small>
              </div>
            </el-upload>
            <div v-else class="shoot-image-limit">已达到 9 张上限</div>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="shoot-dialog-footer">
          <el-button size="large" @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" size="large" :loading="saving" @click="onSave">
            {{ dialogMode === "create" ? "新增商拍" : "保存修改" }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.shoot-hero-actions,
.shoot-toolbar,
.shoot-dialog-footer,
.shoot-tab-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.shoot-tab-toolbar {
  justify-content: space-between;
  margin-bottom: 16px;
}

.shoot-tab-summary {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.shoot-tabs {
  margin-top: 8px;
}

.package-cover-thumb {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  object-fit: cover;
  border: 1px solid var(--el-border-color-lighter);
}

.package-cover-preview {
  position: relative;
  width: 180px;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
}

.package-cover-preview-img {
  display: block;
  width: 100%;
  height: 120px;
  object-fit: cover;
}

.package-form-grid {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

@media (max-width: 720px) {
  .package-form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.shoot-toolbar {
  justify-content: flex-end;
  margin-bottom: 16px;
}

.shoot-filter {
  width: 160px;
}

.shoot-title {
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.shoot-list-price {
  font-weight: 800;
  color: var(--el-color-primary);
}

.shoot-field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.shoot-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.shoot-form {
  padding: 4px 4px 0;
}

.shoot-form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
}

.shoot-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.shoot-form :deep(.el-form-item__label) {
  font-weight: 600;
  color: var(--el-text-color-primary);
  padding-bottom: 8px;
  line-height: 1.4;
}

.shoot-image-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.shoot-image-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.shoot-image-item {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}

.shoot-image-thumb {
  display: block;
  width: 100%;
  height: 120px;
  object-fit: cover;
}

.shoot-image-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  border: 0;
  border-radius: 999px;
  font-size: 12px;
  color: #fff;
  background: rgba(15, 23, 42, 0.72);
  cursor: pointer;
}

.shoot-image-uploader {
  width: 100%;
}

.shoot-image-uploader :deep(.el-upload) {
  width: 100%;
}

.shoot-image-uploader :deep(.el-upload-dragger) {
  width: 100%;
  padding: 22px 16px;
  border-radius: 14px;
}

.shoot-upload-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--el-color-primary);
}

.shoot-upload-inner small {
  color: var(--el-text-color-secondary);
}

.shoot-image-limit {
  padding: 12px 14px;
  border-radius: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}

.shoot-status-radio {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.shoot-status-radio :deep(.el-radio) {
  margin-right: 0;
  min-width: 112px;
}

.shoot-dialog-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding-right: 28px;
}

.shoot-dialog-header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  color: var(--el-color-primary);
  background: linear-gradient(145deg, var(--el-color-primary-light-8), var(--el-color-primary-light-9));
  border: 1px solid var(--el-color-primary-light-7);
}

.shoot-dialog-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--el-text-color-primary);
}

.shoot-dialog-desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.55;
}

.shoot-dialog-footer {
  justify-content: flex-end;
  width: 100%;
}

:deep(.shoot-dialog) {
  border-radius: 16px;
  overflow: hidden;
}

:deep(.shoot-dialog .el-dialog__header) {
  margin-right: 0;
  padding: 22px 28px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

:deep(.shoot-dialog .el-dialog__body) {
  padding: 20px 28px 8px;
}

:deep(.shoot-dialog .el-dialog__footer) {
  padding: 16px 28px 22px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>

/*
  ASISTEN OPERATOR ARKAS - FRONTEND GITHUB PAGES
  Backend: Google Apps Script Web App.

  Wajib:
  1. Deploy Code.gs sebagai Web App.
  2. Tempel URL Web App pada kolom aplikasi atau isi DEFAULT_GAS_WEB_APP_URL.
  3. Untuk simpan draft dari GitHub Pages, tambahkan Patch_CodeGS_JSONP_Save.gs ke Code.gs.
*/

const DEFAULT_GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzfp4ZMFOElBwXDF_xfGwKxEOHylk2EuBLXcmMbKsjyHofZYx6mZgmGIs4VYRYA-6DVzg/exec;
const STORAGE_KEYS = {
  gasUrl: "arkas_gas_web_app_url",
  draft: "arkas_draft_items_v1",
  school: "arkas_school_name",
  operator: "arkas_operator_name",
  totalBos: "arkas_total_bos",
  budgetYear: "arkas_budget_year"
};

const SHEET_INFO = {
  spreadsheetId: "12mgin0NIfV1sFJKxJ7z5IsJR0VGFSDAGWgh83VcvwE0",
  referenceSheet: "Referensi_Operator",
  planSheet: "Rencana_ARKAS",
  logSheet: "Log_Aktivitas"
};

let activeMode = "Input ARKAS Baru";
let searchResults = [];
let draftItems = [];
let toastTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  loadSavedSettings();
  bindEvents();
  loadDraftFromStorage();
  setMode(activeMode);
  updateTotalItem();
  renderDraft();
  validateLocalBudget();
}

function bindEvents() {
  $("#btnSaveGasUrl").addEventListener("click", saveGasUrl);
  $("#btnTestConnection").addEventListener("click", testConnection);
  $("#btnRefreshStats").addEventListener("click", loadStats);
  $("#btnQuickSearch").addEventListener("click", quickSearch);
  $("#btnClearSearch").addEventListener("click", clearSearch);
  $("#btnResetForm").addEventListener("click", resetForm);
  $("#btnAddItem").addEventListener("click", addItemToDraft);
  $("#btnValidate").addEventListener("click", validateLocalBudget);
  $("#btnClearDraft").addEventListener("click", clearDraft);
  $("#btnDownloadCsv").addEventListener("click", downloadDraftCsv);
  $("#btnSaveDraft").addEventListener("click", saveDraftToSheet);

  $$(".mode-card").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  ["#harga", "#jumlah"].forEach((selector) => {
    $(selector).addEventListener("input", updateTotalItem);
  });

  ["#totalBos", "#schoolName", "#operatorName", "#budgetYear"].forEach((selector) => {
    $(selector).addEventListener("input", saveCurrentInputs);
  });

  $("#quickKeyword").addEventListener("keydown", (event) => {
    if (event.key === "Enter") quickSearch();
  });
}

function loadSavedSettings() {
  const savedUrl = localStorage.getItem(STORAGE_KEYS.gasUrl) || "";
  $("#gasUrl").value = savedUrl || (DEFAULT_GAS_WEB_APP_URL.includes("PASTE_URL") ? "" : DEFAULT_GAS_WEB_APP_URL);

  $("#schoolName").value = localStorage.getItem(STORAGE_KEYS.school) || "";
  $("#operatorName").value = localStorage.getItem(STORAGE_KEYS.operator) || "";
  $("#totalBos").value = localStorage.getItem(STORAGE_KEYS.totalBos) || "";
  $("#budgetYear").value = localStorage.getItem(STORAGE_KEYS.budgetYear) || new Date().getFullYear();
}

function saveCurrentInputs() {
  localStorage.setItem(STORAGE_KEYS.school, $("#schoolName").value.trim());
  localStorage.setItem(STORAGE_KEYS.operator, $("#operatorName").value.trim());
  localStorage.setItem(STORAGE_KEYS.totalBos, $("#totalBos").value.trim());
  localStorage.setItem(STORAGE_KEYS.budgetYear, $("#budgetYear").value.trim());
  validateLocalBudget();
}

function getGasUrl() {
  return $("#gasUrl").value.trim().replace(/\.$/, "");
}

function saveGasUrl() {
  const url = getGasUrl();
  if (!url) {
    showToast("URL Web App GAS belum diisi.", "warning");
    return;
  }
  if (!url.startsWith("https://script.google.com/macros/s/")) {
    showToast("URL tidak tampak seperti Web App Google Apps Script.", "warning");
    return;
  }
  localStorage.setItem(STORAGE_KEYS.gasUrl, url);
  setConnectionStatus("URL tersimpan", "ok");
  showToast("URL Web App tersimpan di browser ini.", "success");
}

async function testConnection() {
  try {
    const url = ensureGasUrl();
    setConnectionStatus("Mengetes...", "neutral");
    const result = await gasGet({ action: "ping" });
    if (result.success) {
      setConnectionStatus("Terhubung", "ok");
      showToast("Backend GAS aktif.", "success");
      loadStats();
    } else {
      setConnectionStatus("Gagal", "bad");
      showToast(result.message || "Koneksi gagal.", "error");
    }
  } catch (error) {
    setConnectionStatus("Gagal", "bad");
    showToast(error.message, "error");
  }
}

async function loadStats() {
  try {
    ensureGasUrl();
    const result = await gasGet({ action: "getStats" });
    if (!result.success) throw new Error(result.message || "Statistik tidak tersedia.");
    $("#statTotalRef").textContent = formatNumber(result.totalReferensi || 0);
    showToast("Statistik referensi berhasil dimuat.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function quickSearch() {
  const keyword = $("#quickKeyword").value.trim();
  const limit = $("#searchLimit").value || "50";

  if (!keyword) {
    showToast("Masukkan kata kunci pencarian dulu.", "warning");
    $("#quickKeyword").focus();
    return;
  }

  try {
    ensureGasUrl();
    $("#searchLoading").classList.remove("hidden");
    $("#searchInfo").textContent = "Mencari referensi...";

    const result = await gasGet({ action: "quickSearch", q: keyword, limit });
    if (!result.success) throw new Error(result.message || "Pencarian gagal.");

    searchResults = Array.isArray(result.data) ? result.data : [];
    renderSearchResults(searchResults);
    $("#searchInfo").textContent = `Ditemukan ${formatNumber(result.totalFound || searchResults.length)} referensi, ditampilkan ${formatNumber(searchResults.length)}.`;
  } catch (error) {
    renderSearchResults([]);
    $("#searchInfo").textContent = "Pencarian gagal.";
    showToast(error.message, "error");
  } finally {
    $("#searchLoading").classList.add("hidden");
  }
}

function clearSearch() {
  $("#quickKeyword").value = "";
  searchResults = [];
  renderSearchResults([]);
  $("#searchInfo").textContent = "Belum ada pencarian.";
}

function renderSearchResults(rows) {
  const body = $("#searchResultsBody");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="8" class="empty-state">Tidak ada hasil. Coba kata kunci lain.</td></tr>`;
    return;
  }

  body.innerHTML = rows.map((row, index) => `
    <tr>
      <td><button class="mini-btn" type="button" onclick="useReference(${index})">Pakai</button></td>
      <td>${escapeHtml(row.uraianBarangJasa)}</td>
      <td><strong>${escapeHtml(row.kodeRekening)}</strong></td>
      <td>${escapeHtml(row.rekeningBelanja)}</td>
      <td>${escapeHtml(row.kodeKegiatan)}</td>
      <td>${escapeHtml(row.kegiatanDisarankan)}</td>
      <td>${escapeHtml(row.satuan)}</td>
      <td>${formatRupiah(row.hargaReferensi)}</td>
    </tr>
  `).join("");
}

window.useReference = function useReference(index) {
  const row = searchResults[index];
  if (!row) return;

  $("#kodeKegiatan").value = safe(row.kodeKegiatan);
  $("#kegiatanDisarankan").value = safe(row.kegiatanDisarankan);
  $("#kodeRekening").value = safe(row.kodeRekening);
  $("#rekeningBelanja").value = safe(row.rekeningBelanja);
  $("#uraianBarangJasa").value = safe(row.uraianBarangJasa);
  $("#satuan").value = safe(row.satuan);
  $("#harga").value = row.hargaReferensi ? toNumber(row.hargaReferensi) : "";
  $("#kodeBelanja").value = safe(row.kodeBelanja);
  $("#blokId").value = safe(row.blokId);
  $("#idBarang").value = safe(row.idBarang);

  if (!$("#jumlah").value) $("#jumlah").value = 1;
  updateTotalItem();
  showToast("Referensi masuk ke form item belanja.", "success");
  $("#uraianBarangJasa").scrollIntoView({ behavior: "smooth", block: "center" });
};

function setMode(mode) {
  activeMode = mode;
  $("#activeModeLabel").textContent = mode;

  $$(".mode-card").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });

  const isShiftOrChange = mode === "Pergeseran" || mode === "Perubahan";
  $("#oldBudgetFields").classList.toggle("hidden", !isShiftOrChange);
  $("#shiftWarningBox").classList.toggle("hidden", mode !== "Pergeseran");

  validateLocalBudget();
}

function updateTotalItem() {
  const harga = toNumber($("#harga").value);
  const jumlah = toNumber($("#jumlah").value);
  $("#totalItem").value = formatRupiah(harga * jumlah);
}

function resetForm() {
  const ids = [
    "oldKodeRekening", "oldUraian", "kodeKegiatan", "kegiatanDisarankan", "kodeRekening",
    "rekeningBelanja", "uraianBarangJasa", "satuan", "harga", "jumlah", "kodeBelanja", "blokId", "idBarang"
  ];
  ids.forEach((id) => { $("#" + id).value = ""; });
  $("#sudahRealisasi").checked = false;
  updateTotalItem();
}

function addItemToDraft() {
  const uraian = $("#uraianBarangJasa").value.trim();
  const kodeRekening = $("#kodeRekening").value.trim();
  const harga = toNumber($("#harga").value);
  const jumlah = toNumber($("#jumlah").value);

  if (!uraian) {
    showToast("Uraian Barang/Jasa wajib diisi.", "warning");
    $("#uraianBarangJasa").focus();
    return;
  }
  if (!kodeRekening) {
    showToast("Kode Rekening wajib diisi.", "warning");
    $("#kodeRekening").focus();
    return;
  }
  if (harga <= 0) {
    showToast("Harga satuan harus lebih dari 0.", "warning");
    $("#harga").focus();
    return;
  }
  if (jumlah <= 0) {
    showToast("Jumlah harus lebih dari 0.", "warning");
    $("#jumlah").focus();
    return;
  }

  const item = {
    mode: activeMode,
    kodeRekeningLama: $("#oldKodeRekening").value.trim(),
    uraianLama: $("#oldUraian").value.trim(),
    sudahRealisasi: $("#sudahRealisasi").checked ? 1 : 0,
    realisasi: $("#sudahRealisasi").checked ? 1 : 0,
    kodeKegiatan: $("#kodeKegiatan").value.trim(),
    kegiatanDisarankan: $("#kegiatanDisarankan").value.trim(),
    kodeRekening: kodeRekening,
    rekeningBelanja: $("#rekeningBelanja").value.trim(),
    uraianBarangJasa: uraian,
    satuan: $("#satuan").value.trim(),
    harga: harga,
    jumlah: jumlah,
    bulan: $("#bulan").value,
    kodeBelanja: $("#kodeBelanja").value.trim(),
    blokId: $("#blokId").value.trim(),
    idBarang: $("#idBarang").value.trim(),
    total: harga * jumlah
  };

  draftItems.push(item);
  saveDraftToStorage();
  renderDraft();
  validateLocalBudget();
  resetForm();
  showToast("Item ditambahkan ke draft.", "success");
}

function renderDraft() {
  const body = $("#draftBody");
  if (!draftItems.length) {
    body.innerHTML = `<tr><td colspan="13" class="empty-state">Belum ada item draft.</td></tr>`;
    return;
  }

  body.innerHTML = draftItems.map((item, index) => `
    <tr>
      <td><button class="mini-btn danger" type="button" onclick="removeDraftItem(${index})">Hapus</button></td>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.mode)}</td>
      <td>${escapeHtml(item.kodeKegiatan)}</td>
      <td>${escapeHtml(item.kegiatanDisarankan)}</td>
      <td><strong>${escapeHtml(item.kodeRekening)}</strong></td>
      <td>${escapeHtml(item.rekeningBelanja)}</td>
      <td>${escapeHtml(item.uraianBarangJasa)}</td>
      <td>${escapeHtml(item.satuan)}</td>
      <td>${formatRupiah(item.harga)}</td>
      <td>${formatNumber(item.jumlah)}</td>
      <td>${escapeHtml(item.bulan)}</td>
      <td><strong>${formatRupiah(item.total)}</strong></td>
    </tr>
  `).join("");
}

window.removeDraftItem = function removeDraftItem(index) {
  draftItems.splice(index, 1);
  saveDraftToStorage();
  renderDraft();
  validateLocalBudget();
  showToast("Item draft dihapus.", "success");
};

function clearDraft() {
  if (!draftItems.length) return;
  if (!confirm("Hapus semua item draft?")) return;
  draftItems = [];
  saveDraftToStorage();
  renderDraft();
  validateLocalBudget();
  showToast("Draft dikosongkan.", "success");
}

function saveDraftToStorage() {
  localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(draftItems));
}

function loadDraftFromStorage() {
  try {
    draftItems = JSON.parse(localStorage.getItem(STORAGE_KEYS.draft) || "[]");
    if (!Array.isArray(draftItems)) draftItems = [];
  } catch (_) {
    draftItems = [];
  }
}

function validateLocalBudget() {
  const totalBos = toNumber($("#totalBos").value);
  const validation = calculateValidation(totalBos, draftItems, activeMode);

  $("#summaryTotal").textContent = formatRupiah(validation.totalSemua);
  $("#summaryHonor").textContent = `${formatPercent(validation.persenHonor)} / maks. 20%`;
  $("#summaryBuku").textContent = `${formatPercent(validation.persenBuku)} / min. 10%`;
  $("#summarySarpras").textContent = `${formatPercent(validation.persenSarpras)} / maks. 20%`;

  const box = $("#validationMessages");
  const messages = [];

  if (!draftItems.length) {
    box.innerHTML = `<div class="empty-state">Belum ada item draft.</div>`;
    return validation;
  }

  validation.errors.forEach((message) => messages.push(`<div class="message err">${escapeHtml(message)}</div>`));
  validation.warnings.forEach((message) => messages.push(`<div class="message warn">${escapeHtml(message)}</div>`));

  if (!messages.length) {
    messages.push(`<div class="message ok">Validasi lokal aman. Tetap cocokan ulang dengan ARKAS resmi sebelum finalisasi.</div>`);
  }

  box.innerHTML = messages.join("");
  return validation;
}

function calculateValidation(totalBos, items, mode) {
  let totalHonor = 0;
  let totalBuku = 0;
  let totalSarpras = 0;
  let totalSemua = 0;
  const warnings = [];
  const errors = [];

  items.forEach((item) => {
    const total = toNumber(item.total) || (toNumber(item.harga) * toNumber(item.jumlah));
    totalSemua += total;

    const kategori = detectKategori(item);
    if (kategori === "HONOR") totalHonor += total;
    if (kategori === "BUKU") totalBuku += total;
    if (kategori === "SARPRAS") totalSarpras += total;

    if (mode === "Pergeseran" || item.mode === "Pergeseran") {
      if (item.kodeRekeningLama && item.kodeRekening && getAkunUtama(item.kodeRekeningLama) !== getAkunUtama(item.kodeRekening)) {
        errors.push(`Pergeseran lintas akun belanja terdeteksi: ${item.kodeRekeningLama} → ${item.kodeRekening}.`);
      }
      if (toNumber(item.realisasi || item.sudahRealisasi) > 0) {
        errors.push(`Item "${item.uraianBarangJasa}" ditandai sudah realisasi/BKU, tidak aman untuk digeser.`);
      }
      if (isAset(item)) {
        warnings.push(`Item aset/modal terdeteksi pada "${item.uraianBarangJasa}". Pada pergeseran, pengganti sebaiknya aset/modal sejenis.`);
      }
    }
  });

  if (totalBos > 0) {
    if (totalHonor > totalBos * 0.20) errors.push(`Belanja honor melebihi 20% dari BOS. Total honor ${formatRupiah(totalHonor)}.`);
    if (totalSarpras > totalBos * 0.20) errors.push(`Belanja pemeliharaan/perbaikan sarpras melebihi 20% dari BOS. Total sarpras ${formatRupiah(totalSarpras)}.`);
    if (totalBuku < totalBos * 0.10) warnings.push(`Belanja buku masih di bawah 10% dari BOS. Total buku ${formatRupiah(totalBuku)}.`);
  } else if (items.length) {
    warnings.push("Total dana BOS belum diisi, validasi persentase belum lengkap.");
  }

  return {
    totalBos,
    totalSemua,
    totalHonor,
    totalBuku,
    totalSarpras,
    persenHonor: totalBos ? totalHonor / totalBos : 0,
    persenBuku: totalBos ? totalBuku / totalBos : 0,
    persenSarpras: totalBos ? totalSarpras / totalBos : 0,
    warnings,
    errors
  };
}

async function saveDraftToSheet() {
  if (!draftItems.length) {
    showToast("Draft masih kosong.", "warning");
    return;
  }

  const validation = validateLocalBudget();
  if (validation.errors.length) {
    if (!confirm("Masih ada error validasi. Tetap simpan sebagai draft?")) return;
  }

  const payload = {
    action: "saveDraft",
    mode: activeMode,
    sekolah: $("#schoolName").value.trim(),
    operator: $("#operatorName").value.trim(),
    tahunAnggaran: $("#budgetYear").value.trim(),
    totalBos: toNumber($("#totalBos").value),
    catatan: "Disimpan dari GitHub Pages - Asisten Operator ARKAS",
    items: draftItems
  };

  const encodedLength = encodeURIComponent(JSON.stringify(payload)).length;
  if (encodedLength > 7500) {
    showToast("Draft terlalu banyak untuk disimpan via GitHub/JSONP. Unduh CSV atau simpan bertahap.", "warning");
    return;
  }

  try {
    ensureGasUrl();
    const result = await gasGet({ action: "saveDraftJsonp", payload: JSON.stringify(payload) });
    if (!result.success) throw new Error(result.message || "Gagal menyimpan draft.");

    showToast(`Draft tersimpan ke Rencana_ARKAS. Batch: ${result.batchId || "-"}`, "success");
  } catch (error) {
    showToast(error.message + " Pastikan Patch_CodeGS_JSONP_Save.gs sudah ditambahkan ke Code.gs.", "error");
  }
}

function downloadDraftCsv() {
  if (!draftItems.length) {
    showToast("Draft masih kosong.", "warning");
    return;
  }

  const headers = [
    "Mode", "Kode Kegiatan", "Kegiatan Disarankan", "Kode Rekening", "Rekening Belanja",
    "Uraian Barang/Jasa", "Satuan", "Harga", "Jumlah", "Bulan", "Total", "Kode Belanja", "Blok ID", "ID Barang"
  ];

  const rows = draftItems.map((item) => [
    item.mode,
    item.kodeKegiatan,
    item.kegiatanDisarankan,
    item.kodeRekening,
    item.rekeningBelanja,
    item.uraianBarangJasa,
    item.satuan,
    item.harga,
    item.jumlah,
    item.bulan,
    item.total,
    item.kodeBelanja,
    item.blokId,
    item.idBarang
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Draft_ARKAS_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function gasGet(params) {
  const baseUrl = ensureGasUrl();
  return jsonpRequest(baseUrl, params);
}

function ensureGasUrl() {
  const url = getGasUrl();
  if (!url) throw new Error("URL Web App GAS belum diisi.");
  return url;
}

function jsonpRequest(baseUrl, params = {}, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const callbackName = `arkasCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const query = new URLSearchParams({ ...params, callback: callbackName });
    const separator = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${separator}${query.toString()}`;
    let done = false;

    const cleanup = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[callbackName];
    };

    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error("Permintaan ke GAS timeout. Periksa URL Web App dan izin deploy."));
    }, timeoutMs);

    window[callbackName] = (data) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      cleanup();
      reject(new Error("Gagal menghubungi GAS. Pastikan Web App bisa diakses oleh Anyone/Siapa saja."));
    };

    script.src = url;
    document.body.appendChild(script);
  });
}

function setConnectionStatus(text, type) {
  const el = $("#connectionStatus");
  el.textContent = text;
  el.classList.remove("status-neutral", "status-ok", "status-bad");
  el.classList.add(type === "ok" ? "status-ok" : type === "bad" ? "status-bad" : "status-neutral");
}

function detectKategori(item) {
  const text = normalizeText([
    item.kodeRekening,
    item.rekeningBelanja,
    item.uraianBarangJasa,
    item.kegiatanDisarankan
  ].join(" "));

  if (text.includes("honor") || text.includes("honorarium") || text.includes("upah")) return "HONOR";
  if (text.includes("buku") || text.includes("perpustakaan") || text.includes("literasi")) return "BUKU";
  if (
    text.includes("pemeliharaan") || text.includes("perbaikan") || text.includes("rehab") ||
    text.includes("rehabilitasi") || text.includes("sarana") || text.includes("prasarana") ||
    text.includes("gedung") || text.includes("bangunan")
  ) return "SARPRAS";
  return "LAINNYA";
}

function isAset(item) {
  const text = normalizeText([item.kodeRekening, item.rekeningBelanja, item.uraianBarangJasa].join(" "));
  return ["modal", "aset", "peralatan", "mesin", "laptop", "komputer", "printer", "proyektor", "meubel", "lemari", "kursi", "meja"]
    .some((word) => text.includes(word));
}

function getAkunUtama(kodeRekening) {
  const parts = String(kodeRekening || "").trim().split(".");
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`;
  return String(kodeRekening || "").slice(0, 3);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value) {
  if (typeof value === "number") return value;
  if (value === null || value === undefined || value === "") return 0;
  const clean = String(value)
    .replace(/Rp/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");
  const num = Number(clean);
  return Number.isFinite(num) ? num : 0;
}

function formatRupiah(value) {
  return `Rp ${toNumber(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

function formatNumber(value) {
  return toNumber(value).toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function safe(value) {
  return value === null || value === undefined ? "" : String(value);
}

function showToast(message, type = "") {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`.trim();
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.className = "toast";
  }, 4200);
}

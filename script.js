/*******************************************************
 * SCRIPT.JS - FRONTEND GITHUB PAGES V2
 * Tampilan premium untuk Aplikasi Bantu Operator ARKAS
 *******************************************************/

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxGJqF6qbxJDHnCSMHlXwkDGYA6QEiR2zDy1noOETIB5zIuulx0E8y_qxblvy9_udZqCQ/exec';

const state = {
  selectedReference: null,
  selectedRekening: null,
  selectedKegiatan: null,
  rekeningOptions: [],
  kegiatanOptions: [],
  items: []
};

const els = {};

window.addEventListener('DOMContentLoaded', () => {
  bindElements();
  bindEvents();
  initUi();
  initApp();
});

function bindElements() {
  const ids = [
    'connectionStatus',
    'namaSekolah',
    'jenisPekerjaan',
    'namaPenginput',
    'noHpPenginput',
    'totalDanaMasuk',
    'tahap',
    'keywordReferensi',
    'btnCariReferensi',
    'searchInfo',
    'hasilReferensi',
    'modeManual',
    'selectedReferenceBox',
    'manualPanel',
    'uraianManual',
    'keywordRekening',
    'btnCariRekening',
    'pilihRekening',
    'keywordKegiatan',
    'btnCariKegiatan',
    'pilihKegiatan',
    'bulanBelanja',
    'satuan',
    'hargaSatuan',
    'jumlah',
    'totalBelanjaPreview',
    'catatanSekolah',
    'btnTambahItem',
    'btnResetItem',
    'summaryDana',
    'summaryBelanja',
    'summarySisa',
    'summaryItem',
    'summaryDanaSide',
    'summaryBelanjaSide',
    'summarySisaSide',
    'summaryItemSide',
    'heroSchool',
    'heroJob',
    'heroTotalBelanja',
    'validationHint',
    'jobInsight',
    'daftarItemBody',
    'saveMessage',
    'btnSimpanPengajuan',
    'btnKosongkanDaftar',
    'toastContainer',
    'currentYear'
  ];

  ids.forEach(id => { els[id] = document.getElementById(id); });
}

function bindEvents() {
  els.btnCariReferensi.addEventListener('click', searchReference);
  els.keywordReferensi.addEventListener('keydown', event => {
    if (event.key === 'Enter') searchReference();
  });

  document.querySelectorAll('.keyword-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      els.keywordReferensi.value = btn.dataset.keyword || '';
      searchReference();
    });
  });

  document.querySelectorAll('.job-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      els.jenisPekerjaan.value = btn.dataset.job || 'Input Baru';
      syncJobTypeUi();
    });
  });

  els.namaSekolah.addEventListener('change', syncHeroSummary);
  els.jenisPekerjaan.addEventListener('change', syncJobTypeUi);

  els.modeManual.addEventListener('change', handleManualModeChange);

  els.btnCariRekening.addEventListener('click', loadRekeningOptions);
  els.keywordRekening.addEventListener('keydown', event => {
    if (event.key === 'Enter') loadRekeningOptions();
  });

  els.btnCariKegiatan.addEventListener('click', loadKegiatanOptions);
  els.keywordKegiatan.addEventListener('keydown', event => {
    if (event.key === 'Enter') loadKegiatanOptions();
  });

  els.pilihRekening.addEventListener('change', handleRekeningSelect);
  els.pilihKegiatan.addEventListener('change', handleKegiatanSelect);

  els.hargaSatuan.addEventListener('input', updateItemTotalPreview);
  els.jumlah.addEventListener('input', updateItemTotalPreview);
  els.totalDanaMasuk.addEventListener('input', updateSummary);

  els.btnTambahItem.addEventListener('click', addItem);
  els.btnResetItem.addEventListener('click', () => resetItemForm({ keepIdentity: true }));
  els.btnSimpanPengajuan.addEventListener('click', savePengajuan);
  els.btnKosongkanDaftar.addEventListener('click', clearItems);
}

function initUi() {
  if (els.currentYear) els.currentYear.textContent = String(new Date().getFullYear());
  syncJobTypeUi();
  syncHeroSummary();
  updateSummary();
}

async function initApp() {
  setConnectionStatus('warning', 'Menghubungkan backend...');

  try {
    const ping = await callGas('ping');
    if (!ping.success) throw new Error(ping.message || 'Backend tidak merespons.');

    setConnectionStatus('ok', 'Backend aktif & siap digunakan');
    await loadSchools();
    await loadRekeningOptions();
    await loadKegiatanOptions();
    updateSummary();
    showToast('Backend berhasil terhubung.', 'ok');
  } catch (error) {
    setConnectionStatus('error', 'Backend gagal terhubung');
    showSaveMessage(error.message, 'error');
    showToast(error.message, 'error');
  }
}

function callGas(action, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = 'arkasCallback_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    const script = document.createElement('script');
    const query = new URLSearchParams({ action, callback: callbackName });

    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, value);
      }
    });

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Koneksi ke backend terlalu lama.'));
    }, 25000);

    window[callbackName] = data => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Gagal memuat respons dari Google Apps Script.'));
    };

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    script.src = `${GAS_URL}?${query.toString()}`;
    document.body.appendChild(script);
  });
}

function setConnectionStatus(type, text) {
  const dotClass = type === 'ok' ? 'ok' : type === 'error' ? 'error' : 'warning';
  els.connectionStatus.innerHTML = `<span class="status-dot ${dotClass}"></span><span>${escapeHtml(text)}</span>`;
}

function syncJobTypeUi() {
  const current = els.jenisPekerjaan.value || 'Input Baru';

  document.querySelectorAll('.job-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.job === current);
  });

  const insightMap = {
    'Input Baru': {
      html: 'Mode <strong>Input Baru</strong>: digunakan untuk menyusun belanja baru sesuai dana masuk atau pagu yang tersedia.'
    },
    'Pergeseran': {
      html: 'Mode <strong>Pergeseran</strong>: digunakan untuk menggeser rencana dalam satu lingkup anggaran yang sejenis. Periksa kembali agar tidak salah akun.'
    },
    'Perubahan': {
      html: 'Mode <strong>Perubahan</strong>: digunakan ketika sekolah perlu menyesuaikan rencana karena kebutuhan riil yang berubah dari rencana awal.'
    }
  };

  els.jobInsight.innerHTML = insightMap[current]?.html || insightMap['Input Baru'].html;
  syncHeroSummary();
}

function syncHeroSummary() {
  els.heroSchool.textContent = els.namaSekolah.value || 'Belum dipilih';
  els.heroJob.textContent = els.jenisPekerjaan.value || 'Input Baru';
  els.heroTotalBelanja.textContent = els.summaryBelanja.textContent || 'Rp 0';
}

async function loadSchools() {
  const result = await callGas('getSchools');
  if (!result.success) throw new Error(result.message || 'Gagal mengambil daftar sekolah.');

  els.namaSekolah.innerHTML = '<option value="">Pilih sekolah</option>';
  result.data.forEach(school => {
    const option = document.createElement('option');
    option.value = school.namaSekolah;
    option.textContent = school.namaSekolah;
    els.namaSekolah.appendChild(option);
  });
}

async function searchReference() {
  const keyword = els.keywordReferensi.value.trim();

  if (!keyword) {
    els.searchInfo.textContent = 'Masukkan kata kunci pencarian terlebih dahulu.';
    els.hasilReferensi.innerHTML = '';
    return;
  }

  els.btnCariReferensi.disabled = true;
  els.searchInfo.textContent = 'Mencari referensi...';
  els.hasilReferensi.innerHTML = '';

  try {
    const result = await callGas('searchReference', { q: keyword, limit: 30 });
    if (!result.success) throw new Error(result.message || 'Pencarian gagal.');
    renderSearchResults(result.data || [], result.totalFound || 0);
  } catch (error) {
    els.searchInfo.textContent = error.message;
  } finally {
    els.btnCariReferensi.disabled = false;
  }
}

function renderSearchResults(data, totalFound) {
  els.searchInfo.textContent = `Ditemukan ${totalFound} referensi. Ditampilkan ${data.length} hasil terbaik.`;
  els.hasilReferensi.innerHTML = '';

  if (!data.length) {
    els.hasilReferensi.innerHTML = `
      <div class="result-card">
        <h3 class="result-title">Tidak ada referensi yang cocok.</h3>
        <p class="section-desc">Gunakan mode input manual jika uraian belanja belum tersedia di referensi.</p>
      </div>`;
    return;
  }

  data.forEach(item => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <h3 class="result-title">${escapeHtml(item.uraianBarangJasa || '-')}</h3>
      <div class="meta-grid">
        <div class="meta-chip"><strong>Kode Rekening</strong><span>${escapeHtml(item.kodeRekening || '-')}</span></div>
        <div class="meta-chip"><strong>Rekening</strong><span>${escapeHtml(item.rekeningBelanja || '-')}</span></div>
        <div class="meta-chip"><strong>Kode Kegiatan</strong><span>${escapeHtml(item.kodeKegiatan || '-')}</span></div>
        <div class="meta-chip"><strong>Kegiatan</strong><span>${escapeHtml(item.kegiatanDisarankan || '-')}</span></div>
        <div class="meta-chip"><strong>Satuan</strong><span>${escapeHtml(item.satuan || '-')}</span></div>
        <div class="meta-chip"><strong>Harga Referensi</strong><span>${formatRupiah(item.hargaReferensi)}</span></div>
      </div>
      <div class="result-actions"></div>
    `;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-primary';
    button.textContent = 'Pilih Referensi Ini';
    button.addEventListener('click', () => selectReference(item));

    card.querySelector('.result-actions').appendChild(button);
    els.hasilReferensi.appendChild(card);
  });
}

function selectReference(item) {
  state.selectedReference = item;
  state.selectedRekening = null;
  state.selectedKegiatan = null;

  els.modeManual.checked = false;
  handleManualModeChange();

  els.satuan.value = item.satuan || '';
  els.hargaSatuan.value = toNumber(item.hargaReferensi) || '';
  updateSelectedReferenceBox();
  updateItemTotalPreview();
  showToast('Referensi berhasil dipilih.', 'info');

  window.scrollTo({ top: els.selectedReferenceBox.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
}

function updateSelectedReferenceBox() {
  const item = state.selectedReference;

  if (!item) {
    els.selectedReferenceBox.className = 'reference-highlight empty';
    els.selectedReferenceBox.textContent = 'Belum ada referensi yang dipilih.';
    return;
  }

  els.selectedReferenceBox.className = 'reference-highlight';
  els.selectedReferenceBox.innerHTML = `
    <strong>${escapeHtml(item.uraianBarangJasa || '-')}</strong><br>
    Kode Rekening: ${escapeHtml(item.kodeRekening || '-')} - ${escapeHtml(item.rekeningBelanja || '-')}<br>
    Kegiatan: ${escapeHtml(item.kodeKegiatan || '-')} - ${escapeHtml(item.kegiatanDisarankan || '-')}<br>
    <div class="badge-row">
      <span class="small-badge">Satuan: ${escapeHtml(item.satuan || '-')}</span>
      <span class="small-badge">Harga Referensi: ${formatRupiah(item.hargaReferensi)}</span>
      <span class="small-badge">Kode Belanja: ${escapeHtml(item.kodeBelanja || '-')}</span>
      <span class="small-badge">ID Barang: ${escapeHtml(item.idBarang || '-')}</span>
    </div>
  `;
}

function handleManualModeChange() {
  const manual = els.modeManual.checked;
  els.manualPanel.classList.toggle('hidden', !manual);

  if (manual) {
    state.selectedReference = null;
    updateSelectedReferenceBox();
    showToast('Mode input manual aktif.', 'info');
  }
}

async function loadRekeningOptions() {
  const keyword = els.keywordRekening.value.trim();
  els.btnCariRekening.disabled = true;

  try {
    const result = await callGas('getRekening', { q: keyword, limit: 100 });
    if (!result.success) throw new Error(result.message || 'Gagal mengambil rekening.');
    state.rekeningOptions = result.data || [];
    renderRekeningOptions();
  } catch (error) {
    els.pilihRekening.innerHTML = `<option value="">${escapeHtml(error.message)}</option>`;
  } finally {
    els.btnCariRekening.disabled = false;
  }
}

function renderRekeningOptions() {
  els.pilihRekening.innerHTML = '<option value="">Pilih kode rekening</option>';
  state.rekeningOptions.forEach((item, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${item.kodeRekening || '-'} | ${item.rekeningBelanja || '-'}`;
    els.pilihRekening.appendChild(option);
  });
}

function handleRekeningSelect() {
  const index = els.pilihRekening.value;
  state.selectedRekening = index === '' ? null : state.rekeningOptions[Number(index)];
}

async function loadKegiatanOptions() {
  const keyword = els.keywordKegiatan.value.trim();
  els.btnCariKegiatan.disabled = true;

  try {
    const result = await callGas('getKegiatan', { q: keyword, limit: 100 });
    if (!result.success) throw new Error(result.message || 'Gagal mengambil kegiatan.');
    state.kegiatanOptions = result.data || [];
    renderKegiatanOptions();
  } catch (error) {
    els.pilihKegiatan.innerHTML = `<option value="">${escapeHtml(error.message)}</option>`;
  } finally {
    els.btnCariKegiatan.disabled = false;
  }
}

function renderKegiatanOptions() {
  els.pilihKegiatan.innerHTML = '<option value="">Pilih kegiatan</option>';
  state.kegiatanOptions.forEach((item, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${item.kodeKegiatan || '-'} | ${item.kegiatanDisarankan || '-'}`;
    els.pilihKegiatan.appendChild(option);
  });
}

function handleKegiatanSelect() {
  const index = els.pilihKegiatan.value;
  state.selectedKegiatan = index === '' ? null : state.kegiatanOptions[Number(index)];
}

function addItem() {
  const manual = els.modeManual.checked;
  const hargaSatuan = toNumber(els.hargaSatuan.value);
  const jumlah = toNumber(els.jumlah.value);

  if (!els.namaSekolah.value) return notifyValidation('Pilih nama sekolah terlebih dahulu.');
  if (!manual && !state.selectedReference) return notifyValidation('Pilih referensi belanja terlebih dahulu, atau aktifkan input manual.');
  if (manual && !els.uraianManual.value.trim()) return notifyValidation('Isi uraian manual terlebih dahulu.');
  if (manual && !state.selectedRekening) return notifyValidation('Pilih kode rekening untuk input manual.');
  if (manual && !state.selectedKegiatan) return notifyValidation('Pilih kegiatan untuk input manual.');
  if (!els.bulanBelanja.value) return notifyValidation('Pilih bulan belanja terlebih dahulu.');
  if (!hargaSatuan || hargaSatuan < 0) return notifyValidation('Isi harga satuan dengan benar.');
  if (!jumlah || jumlah <= 0) return notifyValidation('Isi jumlah dengan benar.');

  let item;

  if (manual) {
    item = {
      bulanBelanja: els.bulanBelanja.value,
      kodeKegiatan: state.selectedKegiatan.kodeKegiatan || '',
      kegiatan: state.selectedKegiatan.kegiatanDisarankan || '',
      kodeRekening: state.selectedRekening.kodeRekening || '',
      rekeningBelanja: state.selectedRekening.rekeningBelanja || '',
      uraianBarangJasa: '',
      uraianManual: els.uraianManual.value.trim(),
      satuan: els.satuan.value.trim(),
      hargaSatuan,
      jumlah,
      kodeBelanja: state.selectedRekening.kodeBelanja || '',
      blokId: '',
      idBarang: '',
      statusReferensi: 'Manual',
      catatanSekolah: els.catatanSekolah.value.trim()
    };
  } else {
    const ref = state.selectedReference;
    item = {
      bulanBelanja: els.bulanBelanja.value,
      kodeKegiatan: ref.kodeKegiatan || '',
      kegiatan: ref.kegiatanDisarankan || '',
      kodeRekening: ref.kodeRekening || '',
      rekeningBelanja: ref.rekeningBelanja || '',
      uraianBarangJasa: ref.uraianBarangJasa || '',
      uraianManual: '',
      satuan: els.satuan.value.trim() || ref.satuan || '',
      hargaSatuan,
      jumlah,
      kodeBelanja: ref.kodeBelanja || '',
      blokId: ref.blokId || '',
      idBarang: ref.idBarang || '',
      statusReferensi: 'Dari Referensi',
      catatanSekolah: els.catatanSekolah.value.trim()
    };
  }

  item.totalBelanja = item.hargaSatuan * item.jumlah;
  state.items.push(item);

  renderItems();
  updateSummary();
  resetItemForm({ keepIdentity: true });
  showToast('Item berhasil ditambahkan ke daftar.', 'ok');
}

function renderItems() {
  els.daftarItemBody.innerHTML = '';

  if (!state.items.length) {
    els.daftarItemBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-table">
          <div class="empty-state">
            <div class="empty-emoji">🗂️</div>
            <div>
              <strong>Belum ada item belanja.</strong>
              <p>Tambahkan item dari referensi atau gunakan input manual.</p>
            </div>
          </div>
        </td>
      </tr>`;
    return;
  }

  state.items.forEach((item, index) => {
    const uraian = item.statusReferensi === 'Manual' ? item.uraianManual : item.uraianBarangJasa;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHtml(item.bulanBelanja || '-')}</td>
      <td>
        <strong>${escapeHtml(uraian || '-')}</strong>
        <div class="item-pill">${escapeHtml(item.statusReferensi || '-')}</div>
      </td>
      <td>${escapeHtml(item.kodeRekening || '-')}<br>${escapeHtml(item.rekeningBelanja || '')}</td>
      <td>${escapeHtml(item.kodeKegiatan || '-')}<br>${escapeHtml(item.kegiatan || '')}</td>
      <td>${escapeHtml(item.satuan || '-')}</td>
      <td>${formatRupiah(item.hargaSatuan)}</td>
      <td>${formatNumber(item.jumlah)}</td>
      <td>${formatRupiah(item.totalBelanja)}</td>
    `;

    const actionTd = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = 'Hapus';
    deleteBtn.addEventListener('click', () => removeItem(index));
    actionTd.appendChild(deleteBtn);
    tr.appendChild(actionTd);
    els.daftarItemBody.appendChild(tr);
  });
}

function removeItem(index) {
  state.items.splice(index, 1);
  renderItems();
  updateSummary();
  showToast('Item berhasil dihapus.', 'info');
}

function clearItems() {
  if (!state.items.length) return;
  if (!confirm('Kosongkan seluruh daftar belanja?')) return;
  state.items = [];
  renderItems();
  updateSummary();
  showToast('Seluruh daftar berhasil dikosongkan.', 'info');
}

async function savePengajuan() {
  if (!els.namaSekolah.value) return notifyValidation('Nama sekolah wajib dipilih.');
  if (!els.jenisPekerjaan.value) return notifyValidation('Jenis pekerjaan wajib dipilih.');
  if (!state.items.length) return notifyValidation('Belum ada item belanja yang akan disimpan.');

  const payload = {
    namaSekolah: els.namaSekolah.value,
    namaPenginput: els.namaPenginput.value.trim(),
    noHpPenginput: els.noHpPenginput.value.trim(),
    jenisPekerjaan: els.jenisPekerjaan.value,
    totalDanaMasuk: toNumber(els.totalDanaMasuk.value),
    tahap: els.tahap.value.trim(),
    catatanSekolah: '',
    items: state.items
  };

  els.btnSimpanPengajuan.disabled = true;
  showSaveMessage('Menyimpan pengajuan ke Google Sheet...', '');

  try {
    const result = await callGas('savePengajuan', { payload: JSON.stringify(payload) });
    if (!result.success) throw new Error(result.message || 'Gagal menyimpan pengajuan.');

    showSaveMessage(`Berhasil disimpan. ID Pengajuan: ${result.idPengajuan}. Total item: ${result.totalItems}.`, 'ok');
    showToast('Pengajuan berhasil disimpan ke Google Sheet.', 'ok');
    state.items = [];
    renderItems();
    updateSummary();
  } catch (error) {
    showSaveMessage(error.message, 'error');
    showToast(error.message, 'error');
  } finally {
    els.btnSimpanPengajuan.disabled = false;
  }
}

function resetItemForm(options = {}) {
  state.selectedReference = null;
  state.selectedRekening = null;
  state.selectedKegiatan = null;

  els.keywordReferensi.value = '';
  els.searchInfo.textContent = '';
  els.hasilReferensi.innerHTML = '';
  els.modeManual.checked = false;
  els.manualPanel.classList.add('hidden');
  els.uraianManual.value = '';
  els.pilihRekening.value = '';
  els.pilihKegiatan.value = '';
  els.bulanBelanja.value = '';
  els.satuan.value = '';
  els.hargaSatuan.value = '';
  els.jumlah.value = '';
  els.catatanSekolah.value = '';

  updateSelectedReferenceBox();
  updateItemTotalPreview();

  if (!options.keepIdentity) {
    els.namaPenginput.value = '';
    els.noHpPenginput.value = '';
  }
}

function updateItemTotalPreview() {
  const harga = toNumber(els.hargaSatuan.value);
  const jumlah = toNumber(els.jumlah.value);
  els.totalBelanjaPreview.value = formatRupiah(harga * jumlah);
}

function updateSummary() {
  const totalDana = toNumber(els.totalDanaMasuk.value);
  const totalBelanja = state.items.reduce((sum, item) => sum + toNumber(item.totalBelanja), 0);
  const sisa = totalDana - totalBelanja;
  const sisaText = formatRupiah(sisa);

  els.summaryDana.textContent = formatRupiah(totalDana);
  els.summaryBelanja.textContent = formatRupiah(totalBelanja);
  els.summarySisa.textContent = sisaText;
  els.summaryItem.textContent = String(state.items.length);

  els.summaryDanaSide.textContent = formatRupiah(totalDana);
  els.summaryBelanjaSide.textContent = formatRupiah(totalBelanja);
  els.summarySisaSide.textContent = sisaText;
  els.summaryItemSide.textContent = String(state.items.length);

  els.heroTotalBelanja.textContent = formatRupiah(totalBelanja);

  if (!state.items.length) {
    els.validationHint.innerHTML = 'Belum ada item belanja. Tambahkan item terlebih dahulu untuk melihat ringkasan pengajuan.';
  } else if (sisa < 0) {
    els.validationHint.innerHTML = `<strong>Peringatan:</strong> total belanja melebihi dana masuk sebesar ${formatRupiah(Math.abs(sisa))}.`;
  } else {
    els.validationHint.innerHTML = `Ringkasan saat ini: <strong>${state.items.length} item</strong> dengan total belanja <strong>${formatRupiah(totalBelanja)}</strong>. Sisa dana <strong>${sisaText}</strong>.`;
  }

  syncHeroSummary();
}

function showSaveMessage(message, type) {
  els.saveMessage.textContent = message || '';
  els.saveMessage.className = 'save-message';
  if (type) els.saveMessage.classList.add(type);
}

function notifyValidation(message) {
  showToast(message, 'error');
  alert(message);
}

function showToast(message, type = 'info') {
  if (!els.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  els.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
  }, 3200);

  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3600);
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined || value === '') return 0;

  const clean = String(value)
    .replace(/Rp/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/[^\d.-]/g, '');

  const num = Number(clean);
  return Number.isFinite(num) ? num : 0;
}

function formatRupiah(value) {
  return 'Rp ' + toNumber(value).toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

function formatNumber(value) {
  return toNumber(value).toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

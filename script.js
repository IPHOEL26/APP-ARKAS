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
  syncJobTypeUi();
  initApp();
});

function bindElements() {
  const ids = [
    'connectionStatus','namaSekolah','jenisPekerjaan','namaPenginput','noHpPenginput','totalDanaMasuk','tahap',
    'keywordReferensi','btnCariReferensi','searchInfo','hasilReferensi','modeManual','selectedReferenceBox',
    'manualPanel','uraianManual','keywordRekening','btnCariRekening','pilihRekening','keywordKegiatan',
    'btnCariKegiatan','pilihKegiatan','bulanBelanja','satuan','hargaSatuan','jumlah','totalBelanjaPreview',
    'catatanSekolah','btnTambahItem','btnResetItem','summaryDana','summaryBelanja','summarySisa','summaryItem',
    'summaryDanaSide','summaryBelanjaSide','summarySisaSide','summaryItemSide','heroSchool','heroJob',
    'heroTotalBelanja','validationHint','jobInsight','daftarItemBody','saveMessage','btnSimpanPengajuan',
    'btnKosongkanDaftar','toastContainer'
  ];
  ids.forEach(id => { els[id] = document.getElementById(id); });
}

function bindEvents() {
  els.btnCariReferensi.addEventListener('click', searchReference);
  els.keywordReferensi.addEventListener('keydown', e => { if (e.key === 'Enter') searchReference(); });

  document.querySelectorAll('.search-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      els.keywordReferensi.value = btn.dataset.keyword || '';
      searchReference();
    });
  });

  document.querySelectorAll('.job-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      els.jenisPekerjaan.value = btn.dataset.job || 'Input Baru';
      syncJobTypeUi();
    });
  });

  els.jenisPekerjaan.addEventListener('change', syncJobTypeUi);
  els.namaSekolah.addEventListener('change', syncHeroHeader);
  els.modeManual.addEventListener('change', handleManualModeChange);

  els.btnCariRekening.addEventListener('click', loadRekeningOptions);
  els.keywordRekening.addEventListener('keydown', e => { if (e.key === 'Enter') loadRekeningOptions(); });

  els.btnCariKegiatan.addEventListener('click', loadKegiatanOptions);
  els.keywordKegiatan.addEventListener('keydown', e => { if (e.key === 'Enter') loadKegiatanOptions(); });

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

async function initApp() {
  setConnectionStatus('warning', 'Menghubungkan backend...');
  try {
    const ping = await callGas('ping');
    if (!ping.success) throw new Error(ping.message || 'Backend tidak merespons.');
    setConnectionStatus('ok', 'Backend aktif');
    await loadSchools();
    await loadRekeningOptions();
    await loadKegiatanOptions();
    updateSummary();
    showToast('Backend berhasil terhubung.', 'ok');
  } catch (error) {
    setConnectionStatus('error', 'Backend gagal');
    showSaveMessage(error.message, 'error');
    showToast(error.message, 'error');
  }
}

function callGas(action, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = 'arkasCb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    const script = document.createElement('script');
    const query = new URLSearchParams({ action, callback: callbackName });
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value !== undefined && value !== null && value !== '') query.set(key, value);
    });

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Koneksi ke backend terlalu lama.'));
    }, 25000);

    window[callbackName] = data => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error('Gagal memuat respons dari Google Apps Script.')); };

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
  els.connectionStatus.innerHTML = `
    <span class="status-dot ${type === 'ok' ? 'ok' : type === 'error' ? 'error' : 'warning'}"></span>
    <div><small>Status Backend</small><strong>${escapeHtml(text)}</strong></div>
  `;
}

function syncJobTypeUi() {
  const current = els.jenisPekerjaan.value || 'Input Baru';
  document.querySelectorAll('.job-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.job === current));

  const info = {
    'Input Baru': '<strong>Input Baru</strong> digunakan untuk menyusun belanja baru sesuai dana masuk atau pagu yang tersedia.',
    'Pergeseran': '<strong>Pergeseran</strong> digunakan untuk menyesuaikan rencana dalam lingkup anggaran yang sejenis. Periksa kembali agar tidak salah akun.',
    'Perubahan': '<strong>Perubahan</strong> digunakan saat sekolah perlu menyesuaikan rencana belanja karena kondisi riil berbeda dari rencana awal.'
  };
  els.jobInsight.innerHTML = info[current] || info['Input Baru'];
  syncHeroHeader();
}

function syncHeroHeader() {
  els.heroSchool.textContent = els.namaSekolah.value || 'Belum dipilih';
  els.heroJob.textContent = els.jenisPekerjaan.value || 'Input Baru';
  els.heroTotalBelanja.textContent = els.summaryBelanja.textContent || 'Rp 0';
}

async function loadSchools() {
  const result = await callGas('getSchools');
  if (!result.success) throw new Error(result.message || 'Gagal mengambil daftar sekolah.');
  els.namaSekolah.innerHTML = '<option value="">Pilih sekolah</option>';
  result.data.forEach(item => {
    const option = document.createElement('option');
    option.value = item.namaSekolah;
    option.textContent = item.namaSekolah;
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
    els.hasilReferensi.innerHTML = '<div class="reference-card">Tidak ada referensi yang cocok. Gunakan input manual.</div>';
    return;
  }

  data.forEach(item => {
    const card = document.createElement('div');
    card.className = 'reference-card';
    card.innerHTML = `
      <h3>${escapeHtml(item.uraianBarangJasa || '-')}</h3>
      <div class="reference-meta">
        <div class="reference-chip"><strong>Kode Rekening</strong>${escapeHtml(item.kodeRekening || '-')}</div>
        <div class="reference-chip"><strong>Rekening Belanja</strong>${escapeHtml(item.rekeningBelanja || '-')}</div>
        <div class="reference-chip"><strong>Kode Kegiatan</strong>${escapeHtml(item.kodeKegiatan || '-')}</div>
        <div class="reference-chip"><strong>Kegiatan</strong>${escapeHtml(item.kegiatanDisarankan || '-')}</div>
        <div class="reference-chip"><strong>Satuan</strong>${escapeHtml(item.satuan || '-')}</div>
        <div class="reference-chip"><strong>Harga Referensi</strong>${formatRupiah(item.hargaReferensi)}</div>
      </div>
      <div class="reference-actions"></div>
    `;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--primary';
    btn.textContent = 'Pilih Referensi Ini';
    btn.addEventListener('click', () => selectReference(item));
    card.querySelector('.reference-actions').appendChild(btn);
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
    els.selectedReferenceBox.className = 'selected-reference empty';
    els.selectedReferenceBox.textContent = 'Belum ada referensi yang dipilih.';
    return;
  }
  els.selectedReferenceBox.className = 'selected-reference';
  els.selectedReferenceBox.innerHTML = `
    <strong>${escapeHtml(item.uraianBarangJasa || '-')}</strong><br>
    Kode Rekening: ${escapeHtml(item.kodeRekening || '-')} - ${escapeHtml(item.rekeningBelanja || '-')}<br>
    Kegiatan: ${escapeHtml(item.kodeKegiatan || '-')} - ${escapeHtml(item.kegiatanDisarankan || '-')}<br>
    <div class="badge-row">
      <span class="mini-badge">Satuan: ${escapeHtml(item.satuan || '-')}</span>
      <span class="mini-badge">Harga Referensi: ${formatRupiah(item.hargaReferensi)}</span>
      <span class="mini-badge">Kode Belanja: ${escapeHtml(item.kodeBelanja || '-')}</span>
      <span class="mini-badge">ID Barang: ${escapeHtml(item.idBarang || '-')}</span>
    </div>
  `;
}

function handleManualModeChange() {
  const manual = els.modeManual.checked;
  els.manualPanel.classList.toggle('hidden', !manual);
  if (manual) {
    state.selectedReference = null;
    updateSelectedReferenceBox();
  }
}

async function loadRekeningOptions() {
  const result = await callGas('getRekening', { q: els.keywordRekening.value.trim(), limit: 100 });
  if (!result.success) {
    els.pilihRekening.innerHTML = `<option value="">${escapeHtml(result.message || 'Gagal mengambil rekening.')}</option>`;
    return;
  }
  state.rekeningOptions = result.data || [];
  els.pilihRekening.innerHTML = '<option value="">Pilih kode rekening</option>';
  state.rekeningOptions.forEach((item, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${item.kodeRekening || '-'} | ${item.rekeningBelanja || '-'}`;
    els.pilihRekening.appendChild(opt);
  });
}

function handleRekeningSelect() {
  const idx = els.pilihRekening.value;
  state.selectedRekening = idx === '' ? null : state.rekeningOptions[Number(idx)];
}

async function loadKegiatanOptions() {
  const result = await callGas('getKegiatan', { q: els.keywordKegiatan.value.trim(), limit: 100 });
  if (!result.success) {
    els.pilihKegiatan.innerHTML = `<option value="">${escapeHtml(result.message || 'Gagal mengambil kegiatan.')}</option>`;
    return;
  }
  state.kegiatanOptions = result.data || [];
  els.pilihKegiatan.innerHTML = '<option value="">Pilih kegiatan</option>';
  state.kegiatanOptions.forEach((item, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${item.kodeKegiatan || '-'} | ${item.kegiatanDisarankan || '-'}`;
    els.pilihKegiatan.appendChild(opt);
  });
}

function handleKegiatanSelect() {
  const idx = els.pilihKegiatan.value;
  state.selectedKegiatan = idx === '' ? null : state.kegiatanOptions[Number(idx)];
}

function addItem() {
  const manual = els.modeManual.checked;
  const hargaSatuan = toNumber(els.hargaSatuan.value);
  const jumlah = toNumber(els.jumlah.value);

  if (!els.namaSekolah.value) return notify('Pilih nama sekolah terlebih dahulu.');
  if (!manual && !state.selectedReference) return notify('Pilih referensi belanja terlebih dahulu, atau aktifkan input manual.');
  if (manual && !els.uraianManual.value.trim()) return notify('Isi uraian manual terlebih dahulu.');
  if (manual && !state.selectedRekening) return notify('Pilih kode rekening untuk input manual.');
  if (manual && !state.selectedKegiatan) return notify('Pilih kegiatan untuk input manual.');
  if (!els.bulanBelanja.value) return notify('Pilih bulan belanja terlebih dahulu.');
  if (!hargaSatuan || hargaSatuan < 0) return notify('Isi harga satuan dengan benar.');
  if (!jumlah || jumlah <= 0) return notify('Isi jumlah dengan benar.');

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
      hargaSatuan, jumlah,
      kodeBelanja: state.selectedRekening.kodeBelanja || '',
      blokId: '', idBarang: '',
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
      hargaSatuan, jumlah,
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
  showToast('Item berhasil ditambahkan.', 'ok');
}

function renderItems() {
  els.daftarItemBody.innerHTML = '';
  if (!state.items.length) {
    els.daftarItemBody.innerHTML = '<tr><td colspan="10" class="empty-table">Belum ada item belanja.</td></tr>';
    return;
  }
  state.items.forEach((item, index) => {
    const uraian = item.statusReferensi === 'Manual' ? item.uraianManual : item.uraianBarangJasa;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHtml(item.bulanBelanja || '-')}</td>
      <td><strong>${escapeHtml(uraian || '-')}</strong><br><span class="item-badge">${escapeHtml(item.statusReferensi || '-')}</span></td>
      <td>${escapeHtml(item.kodeRekening || '-')}<br>${escapeHtml(item.rekeningBelanja || '')}</td>
      <td>${escapeHtml(item.kodeKegiatan || '-')}<br>${escapeHtml(item.kegiatan || '')}</td>
      <td>${escapeHtml(item.satuan || '-')}</td>
      <td>${formatRupiah(item.hargaSatuan)}</td>
      <td>${formatNumber(item.jumlah)}</td>
      <td>${formatRupiah(item.totalBelanja)}</td>
    `;
    const actionTd = document.createElement('td');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--outline-danger';
    btn.textContent = 'Hapus';
    btn.addEventListener('click', () => removeItem(index));
    actionTd.appendChild(btn);
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
  if (!els.namaSekolah.value) return notify('Nama sekolah wajib dipilih.');
  if (!els.jenisPekerjaan.value) return notify('Jenis pekerjaan wajib dipilih.');
  if (!state.items.length) return notify('Belum ada item belanja yang akan disimpan.');

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
    state.items = [];
    renderItems();
    updateSummary();
    showToast('Pengajuan berhasil disimpan.', 'ok');
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
  els.totalBelanjaPreview.value = formatRupiah(toNumber(els.hargaSatuan.value) * toNumber(els.jumlah.value));
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

  if (!state.items.length) {
    els.validationHint.textContent = 'Belum ada item belanja. Tambahkan item terlebih dahulu untuk melihat ringkasan pengajuan.';
  } else if (sisa < 0) {
    els.validationHint.innerHTML = `Peringatan: total belanja melebihi dana masuk sebesar <strong>${formatRupiah(Math.abs(sisa))}</strong>.`;
  } else {
    els.validationHint.innerHTML = `Ringkasan saat ini: <strong>${state.items.length} item</strong> dengan total belanja <strong>${formatRupiah(totalBelanja)}</strong>. Sisa dana <strong>${sisaText}</strong>.`;
  }
  syncHeroHeader();
}

function showSaveMessage(message, type) {
  els.saveMessage.textContent = message || '';
  els.saveMessage.className = 'save-message';
  if (type) els.saveMessage.classList.add(type);
}

function notify(message) {
  alert(message);
  showToast(message, 'error');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
  }, 3000);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3400);
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined || value === '') return 0;
  const clean = String(value).replace(/Rp/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '');
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
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ==========================================
// FILE: app.js
// ==========================================

// PENTING: Ganti URL di bawah dengan URL Web App Anda dari langkah deployment GAS!
const API_URL = "https://script.google.com/macros/s/AKfycbz0xOlnyO-TeDTJVtDMgPtqATotkwVHoCMFjXXSvXVZfnw-YCGCp1W4mc2JICFGtVd1/exec";

// Global State
let dataKeluarga = [];
let dataPeserta = [];
let calonPemenang = null;

// Routing Antarmuka
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  document.getElementById(`page-${pageId}`).classList.remove('hidden');
  document.getElementById(`nav-${pageId}`).classList.add('active');
  
  if (pageId === 'dashboard') loadDashboard();
  if (pageId === 'keluarga') loadKeluarga();
  if (pageId === 'peserta') loadPeserta();
  if (pageId === 'pemenang') loadPemenang();
}

// Fetch Wrapper
async function apiCall(action, payload = {}) {
  showLoader();
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action, payload })
    });
    const json = await res.json();
    hideLoader();
    if (!json.success) throw new Error(json.message);
    return json.data;
  } catch (err) {
    hideLoader();
    showToast("Error: " + err.message, true);
    throw err;
  }
}

// UI Helpers
function showLoader() { document.getElementById('loader').classList.remove('hidden'); }
function hideLoader() { document.getElementById('loader').classList.add('hidden'); }
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = isError ? 'var(--danger)' : 'var(--success)';
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ================= Dashboard =================
async function loadDashboard() {
  const data = await apiCall("getDashboard");
  document.getElementById('dash-keluarga').innerText = data.totalKeluarga;
  document.getElementById('dash-peserta').innerText = data.totalPeserta;
  document.getElementById('dash-bayar').innerText = data.sudahBayar;
  document.getElementById('dash-belum').innerText = data.belumBayar;
  document.getElementById('dash-pemenang').innerText = data.totalPemenang;
}

// ================= Keluarga =================
async function loadKeluarga() {
  dataKeluarga = await apiCall("getKeluarga");
  const tbody = document.querySelector("#tbl-keluarga tbody");
  tbody.innerHTML = dataKeluarga.map(k => `
    <tr>
      <td><strong>${k['Nomor Arisan']}</strong></td>
      <td>${k['Nama Lengkap']}</td>
      <td>${k['Status']}</td>
      <td>${k['Nomor HP']}</td>
      <td>
        <button class="btn btn-danger" onclick="hapusKeluarga('${k.ID}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function openModalKeluarga() {
  document.getElementById('form-keluarga').reset();
  document.getElementById('kel-id').value = '';
  openModal('modal-keluarga');
}

async function submitKeluarga(e) {
  e.preventDefault();
  let base64 = "";
  const fileInput = document.getElementById('kel-foto');
  
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    base64 = await new Promise((res) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result);
      reader.readAsDataURL(file);
    });
    // Upload foto ke Google Drive melalui API
    base64 = await apiCall("uploadFoto", { base64, mimeType: file.type, filename: file.name });
  }

  const payload = {
    ID: document.getElementById('kel-id').value,
    NomorArisan: document.getElementById('kel-no').value,
    NamaLengkap: document.getElementById('kel-nama').value,
    NomorHP: document.getElementById('kel-hp').value,
    Status: document.getElementById('kel-status').value,
    Foto: base64
  };

  await apiCall("saveKeluarga", payload);
  showToast("Data keluarga berhasil disimpan");
  closeModal('modal-keluarga');
  loadKeluarga();
}

async function hapusKeluarga(id) {
  if (!confirm("Hapus data ini?")) return;
  await apiCall("hapusKeluarga", { id });
  showToast("Data dihapus");
  loadKeluarga();
}

// ================= Peserta =================
async function loadPeserta() {
  dataPeserta = await apiCall("getPeserta");
  if (!dataKeluarga.length) dataKeluarga = await apiCall("getKeluarga");

  const tahun = document.getElementById('filter-tahun').value;
  const acara = document.getElementById('filter-acara').value;
  
  const filtered = dataPeserta.filter(p => p.Tahun == tahun && p['Jenis Acara'] == acara);
  
  const tbody = document.querySelector("#tbl-peserta tbody");
  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td><strong>${p['Nomor Arisan']}</strong></td>
      <td>${p['Nama Peserta']} <br><small>${p['Status Pemenang'] === 'Sudah' ? '🏆 Pemenang' : ''}</small></td>
      <td>${p['Jenis Acara']} ${p.Tahun}</td>
      <td><span class="${p.Pembayaran === true || p.Pembayaran === 'TRUE' ? 'badge-success' : 'badge-warning'}">${p.Pembayaran === true || p.Pembayaran === 'TRUE' ? '✅ LUNAS' : '⚠️ BELUM'}</span></td>
      <td>
        <input type="checkbox" ${p.Pembayaran === true || p.Pembayaran === 'TRUE' ? 'checked' : ''} onchange="toggleBayar('${p.ID}', this.checked)" style="transform: scale(1.5); cursor: pointer;">
      </td>
      <td><button class="btn btn-danger" onclick="hapusPeserta('${p.ID}')"><i class="fas fa-trash"></i></button></td>
    </tr>
  `).join('');
}

function openModalPeserta() {
  document.getElementById('form-peserta').reset();
  document.getElementById('pes-id').value = '';
  
  const select = document.getElementById('pes-keluarga');
  select.innerHTML = '<option value="">-- Pilih Keluarga --</option>' + 
    dataKeluarga.map(k => `<option value="${k.ID}" data-no="${k['Nomor Arisan']}" data-nama="${k['Nama Lengkap']}">${k['Nomor Arisan']} - ${k['Nama Lengkap']}</option>`).join('');
  
  openModal('modal-peserta');
}

function autoFillPeserta() {
  const select = document.getElementById('pes-keluarga');
  const opt = select.options[select.selectedIndex];
  if(opt && opt.value) {
    document.getElementById('pes-no').value = opt.getAttribute('data-no');
  }
}

async function submitPeserta(e) {
  e.preventDefault();
  const select = document.getElementById('pes-keluarga');
  const opt = select.options[select.selectedIndex];

  const payload = {
    ID: document.getElementById('pes-id').value,
    IDKeluarga: document.getElementById('pes-keluarga').value,
    NomorArisan: document.getElementById('pes-no').value,
    NamaPeserta: opt.getAttribute('data-nama'),
    JenisAcara: document.getElementById('pes-acara').value,
    Tahun: document.getElementById('pes-tahun').value,
    Nominal: 100000
  };

  try {
    await apiCall("savePeserta", payload);
    showToast("Peserta berhasil didaftarkan");
    closeModal('modal-peserta');
    loadPeserta();
  } catch(e) {
    // handled by wrapper
  }
}

async function toggleBayar(id, status) {
  await apiCall("updatePembayaran", { id, status });
  showToast("Status pembayaran diubah");
  loadPeserta();
}

async function hapusPeserta(id) {
  if (!confirm("Hapus peserta ini?")) return;
  await apiCall("hapusPeserta", { id });
  showToast("Peserta dihapus");
  loadPeserta();
}

// ================= Mesin Undian =================
let intervalUndian;
let daftarKandidat = [];

async function mulaiUndian() {
  const tahun = document.getElementById('filter-tahun').value;
  const acara = document.getElementById('filter-acara').value;

  try {
    // Minta backend mencarikan siapa saja yang berhak ikut undian
    daftarKandidat = await apiCall("undiArisan", { Tahun: tahun, JenisAcara: acara });
    if(daftarKandidat.length === 0) throw new Error("Kosong");
  } catch (err) {
    alert("Tidak ada peserta valid! Pastikan ada yang sudah bayar dan belum menang di periode ini.");
    return;
  }

  // Animasi Berputar
  const display = document.getElementById('lottery-display');
  const btn = document.getElementById('btn-undi');
  document.getElementById('hasil-undian').classList.add('hidden');
  
  btn.disabled = true;
  display.classList.add('spin-anim');

  let putaran = 0;
  const totalWaktu = 4000; // 4 detik putaran
  const kecepatan = 50; 
  
  intervalUndian = setInterval(() => {
    // Acak tampilan sementara
    const acak = daftarKandidat[Math.floor(Math.random() * daftarKandidat.length)];
    display.innerText = acak['Nomor Arisan'];
    putaran += kecepatan;

    if (putaran >= totalWaktu) {
      clearInterval(intervalUndian);
      display.classList.remove('spin-anim');
      
      // Pilih pemenang final dari frontend array acak (backend sudah filter yang berhak)
      calonPemenang = daftarKandidat[Math.floor(Math.random() * daftarKandidat.length)];
      display.innerText = calonPemenang['Nomor Arisan'];
      
      tampilkanHasil(calonPemenang, acara, tahun);
      btn.disabled = false;
    }
  }, kecepatan);
}

function tampilkanHasil(pemenang, acara, tahun) {
  document.getElementById('win-nomor').innerText = pemenang['Nomor Arisan'];
  document.getElementById('win-nama').innerText = pemenang['Nama Peserta'];
  document.getElementById('win-detail').innerText = `${acara} ${tahun}`;
  document.getElementById('hasil-undian').classList.remove('hidden');
}

async function konfirmasiSimpanPemenang() {
  if (!calonPemenang) return;
  const tahun = document.getElementById('filter-tahun').value;
  const acara = document.getElementById('filter-acara').value;

  const payload = {
    Tahun: tahun,
    JenisAcara: acara,
    Tanggal: new Date().toLocaleDateString('id-ID'),
    NomorArisan: calonPemenang['Nomor Arisan'],
    Nama: calonPemenang['Nama Peserta'],
    IDKeluarga: calonPemenang['ID Keluarga']
  };

  await apiCall("simpanPemenang", payload);
  showToast("Pemenang berhasil disimpan permanen!");
  document.getElementById('hasil-undian').classList.add('hidden');
  document.getElementById('lottery-display').innerText = '--';
  loadPeserta(); // Update status menang di tabel
}

// ================= Pemenang =================
async function loadPemenang() {
  const pemenang = await apiCall("getPemenang");
  // Urutkan dari yang terbaru (reverse)
  pemenang.reverse();
  
  const container = document.getElementById('winner-container');
  container.innerHTML = pemenang.map(p => `
    <div class="winner-card">
      <p>🏆 Pemenang Arisan</p>
      <h1>${p['Nomor Arisan']}</h1>
      <h2>${p['Nama Pemenang']}</h2>
      <p><strong>${p['Jenis Acara']} ${p['Tahun']}</strong></p>
      <small>${p['Waktu Pengundian']}</small>
    </div>
  `).join('');
}

// Init
window.onload = () => {
  showPage('dashboard');
};
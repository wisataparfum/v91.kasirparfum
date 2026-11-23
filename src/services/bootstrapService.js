const { supabase } = require('../config/supabase');
const { getNowJakarta } = require('../utils/dateHelper');
const { appendActivityLog } = require('../utils/activityLogger');

/**
 * Helper ambil semua baris tabel (>1000 baris didukung dengan loop range pagination)
 */
async function fetchAllRows(tableName, orderByCol = null, ascending = true) {
  const PAGE = 1000;
  let from = 0;
  let all = [];

  while (true) {
    let q = supabase.from(tableName).select('*').range(from, from + PAGE - 1);
    if (orderByCol) {
      q = q.order(orderByCol, { ascending });
    }
    const { data, error } = await q;
    if (error) throw new Error(`Gagal membaca tabel ${tableName}: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/**
 * 0. BOOTSTRAP & SINKRONISASI DATA AWAL DARI 15 TABEL SUPABASE KE FRONTEND
 * (Setara getAppBootstrapDataV91 di code.gs — format JSON 100% identik)
 */
async function getAppBootstrapDataV91(currentUser = null) {
  const isOwner = Boolean(
    currentUser && (currentUser.role === 'Pemilik' || currentUser.role === 'Administrator')
  );

  const [
    prodRows,
    varRows,
    privRows,
    custRows,
    supRows,
    salesRows,
    trxRows,
    arcRows,
    pgRows,
    expRows,
    recRows,
    clsRows,
    usrRows,
    logRows,
    cfgRows
  ] = await Promise.all([
    fetchAllRows('products', 'kode', true),
    fetchAllRows('price_variants', 'urutan', true),
    fetchAllRows('privacy_data', 'kode_produk', true),
    fetchAllRows('customers', 'kode', true),
    fetchAllRows('suppliers', 'kode', true),
    fetchAllRows('sales_staff', 'kode', true),
    fetchAllRows('transactions', 'created_at', false),
    fetchAllRows('archives', 'created_at', false),
    fetchAllRows('payment_gateway_logs', 'created_at', false),
    fetchAllRows('operational_expenses', 'created_at', false),
    fetchAllRows('receivables', 'created_at', false),
    fetchAllRows('daily_closings', 'created_at', false),
    fetchAllRows('admin_users', 'username', true),
    fetchAllRows('activity_logs', 'created_at', false),
    fetchAllRows('app_config', 'config_key', true)
  ]);

  const privacyByCode = {};
  const privacyList = privRows.map((pr) => {
    const obj = {
      kodeProduk: pr.kode_produk,
      brandPabrikan: pr.brand_pabrikan || 'LUZI',
      varianBibit: pr.varian_bibit || '',
      inspiredBy: pr.inspired_by || '',
      kategori:
        pr.kategori ||
        (String(pr.kode_produk).startsWith('CLS')
          ? 'CLASSIC'
          : String(pr.kode_produk).startsWith('LAU')
          ? 'LAUNDRY'
          : 'PREMIUM'),
      rasioVIP: pr.rasio_vip || '65% Bibit : 35% Absolute',
      rasioVVIP: pr.rasio_vvip || '85% Bibit : 15% Absolute',
      hargaModalMl: Number(pr.harga_modal_ml) || 1500,
      pemasok: pr.pemasok || 'PT Luzi Fragrance Indonesia',
      lokasiRak: pr.lokasi_rak || 'RAK-PRE-01'
    };
    privacyByCode[obj.kodeProduk] = obj;
    return obj;
  });

  const productsList = prodRows.map((r) => {
    const privMatch = privacyByCode[r.kode];
    return {
      kode: r.kode,
      nama: r.nama || r.kode,
      kategori: r.kategori || 'PREMIUM',
      gender: r.gender || 'Unisex',
      notesDominan: r.notes_dominan || '',
      topNotes: r.top_notes || '',
      middleNotes: r.middle_notes || '',
      baseNotes: r.base_notes || '',
      tahun: Number(r.tahun) || 2024,
      link: r.link || '',
      keterangan: r.keterangan || '',
      image: r.image || '',
      stokMl: Number(r.stok_ml) || 0,
      minStokMl: Number(r.min_stok_ml) || 100,
      hargaModalMl: isOwner
        ? privMatch
          ? privMatch.hargaModalMl
          : String(r.kode).startsWith('CLS')
          ? 950
          : 1550
        : 0,
      hargaDasar: Number(r.harga_dasar) || 2500,
      lokasiRak: r.lokasi_rak || 'RAK-A01',
      updatedAt: r.updated_at || ''
    };
  });

  const variantsList = varRows.map((vr) => ({
    id: vr.id,
    kategori: vr.kategori || 'CLASSIC',
    nama: vr.nama || vr.id,
    grade: vr.grade || '',
    volumeMl: Number(vr.volume_ml) || 1,
    harga: Number(vr.harga) || 0,
    hargaModal: isOwner ? Number(vr.harga_modal) || Math.round((Number(vr.harga) || 0) * 0.42) : 0,
    tipe: vr.tipe || 'PAKET',
    urutan: Number(vr.urutan) || 1,
    status: vr.status || 'AKTIF',
    keterangan: vr.keterangan || '',
    updatedAt: vr.updated_at || ''
  }));

  const customersList = custRows.map((cr) => ({
    kode: cr.kode,
    nama: cr.nama || 'Pelanggan',
    telepon: cr.telepon || '',
    email: cr.email || '',
    tanggalBergabung: cr.tanggal_bergabung || '',
    alamat: cr.alamat || '',
    keterangan: cr.keterangan || 'Member Reguler'
  }));

  const suppliersList = isOwner
    ? supRows.map((sr) => ({
        kode: sr.kode,
        nama: sr.nama || '',
        brand: sr.brand || '',
        telepon: sr.telepon || '',
        email: sr.email || '',
        alamat: sr.alamat || '',
        estimasiPo: Number(sr.estimasi_po) || 0,
        keterangan: sr.keterangan || ''
      }))
    : [];

  const salesList = salesRows.map((slr) => ({
    kode: slr.kode,
    nama: slr.nama || '',
    jabatan: slr.jabatan || '',
    telepon: slr.telepon || '',
    email: slr.email || '',
    target: Number(slr.target) || 0,
    komisiPct: Number(slr.komisi_pct) || 3,
    status: slr.status || 'AKTIF'
  }));

  const transactionsList = trxRows.map((tr) => ({
    noNota: tr.no_nota,
    waktu: tr.waktu || '',
    kodePelanggan: tr.kode_pelanggan || 'UMUM',
    namaPelanggan: tr.nama_pelanggan || 'Pelanggan Umum',
    teleponPelanggan: tr.telepon_pelanggan || '',
    emailPelanggan: tr.email_pelanggan || '',
    kodeSales: tr.kode_sales || 'SLS-001',
    namaSales: tr.nama_sales || 'Kasir',
    items: Array.isArray(tr.items) ? tr.items : [],
    totalQty: Number(tr.total_qty) || 0,
    totalMl: Number(tr.total_ml) || 0,
    subtotal: Number(tr.subtotal) || 0,
    diskon: Number(tr.diskon) || 0,
    totalBayar: Number(tr.total_bayar) || 0,
    uangDiterima: Number(tr.uang_diterima) || 0,
    kembalian: Number(tr.kembalian) || 0,
    totalModal: isOwner ? Number(tr.total_modal) || 0 : 0,
    labaKotor: isOwner ? Number(tr.laba_kotor) || 0 : 0,
    metodeBayar: tr.metode_bayar || 'Tunai',
    catatan: tr.catatan || '-',
    pgId: tr.pg_id || '',
    pgStatus: tr.pg_status || 'SETTLED',
    pgRefNo: tr.pg_ref_no || ''
  }));

  const archivesList = arcRows.map((ar) => ({
    batchKode: ar.batch_kode || 'ARSIP',
    batchLabel: ar.batch_label || 'Arsip Lama',
    archivedAt: ar.archived_at || '',
    noNota: ar.no_nota,
    waktu: ar.waktu || '',
    kodePelanggan: ar.kode_pelanggan || 'UMUM',
    namaPelanggan: ar.nama_pelanggan || 'Pelanggan Umum',
    teleponPelanggan: ar.telepon_pelanggan || '',
    emailPelanggan: ar.email_pelanggan || '',
    kodeSales: ar.kode_sales || 'SLS-001',
    namaSales: ar.nama_sales || 'Kasir',
    items: Array.isArray(ar.items) ? ar.items : [],
    totalQty: Number(ar.total_qty) || 0,
    totalMl: Number(ar.total_ml) || 0,
    subtotal: Number(ar.subtotal) || 0,
    diskon: Number(ar.diskon) || 0,
    totalBayar: Number(ar.total_bayar) || 0,
    uangDiterima: Number(ar.total_bayar) || 0,
    kembalian: 0,
    metodeBayar: ar.metode_bayar || 'Tunai',
    totalModal: isOwner ? Number(ar.total_modal) || 0 : 0,
    labaKotor: isOwner ? Number(ar.laba_kotor) || 0 : 0,
    catatan: ar.catatan || '-',
    pgId: ar.pg_id || '',
    pgStatus: ar.pg_status || 'SETTLED'
  }));

  const pgLogsList = pgRows.map((gr) => ({
    idPg: gr.id_pg,
    noNota: gr.no_nota || '',
    waktu: gr.waktu || '',
    kodePelanggan: gr.kode_pelanggan || 'UMUM',
    namaPelanggan: gr.nama_pelanggan || 'Pelanggan Umum',
    channel: gr.channel || 'QRIS',
    provider: gr.provider || 'QRIS Wisata Parfum',
    refNo: gr.ref_no || '',
    nominalTagihan: Number(gr.nominal_tagihan) || 0,
    biayaMdr: Number(gr.biaya_mdr) || 0,
    nominalBersih: Number(gr.nominal_bersih) || 0,
    status: gr.status || 'TERVERIFIKASI',
    namaSales: gr.nama_sales || 'Kasir'
  }));

  const expensesList = expRows.map((er) => ({
    id: er.id,
    tanggal: er.tanggal || '',
    kategori: er.kategori || 'Lain-lain',
    keterangan: er.keterangan || '',
    sumberDana: er.sumber_dana || 'Kas Tunai Laci',
    nominal: Number(er.nominal) || 0,
    dicatatOleh: er.dicatat_oleh || 'prassetiosh',
    updatedAt: er.updated_at || ''
  }));

  const receivablesList = recRows.map((rr) => ({
    id: rr.id,
    noNota: rr.no_nota || '-',
    tanggal: rr.tanggal || '',
    jatuhTempo: rr.jatuh_tempo || '',
    kodePelanggan: rr.kode_pelanggan || 'UMUM',
    namaPelanggan: rr.nama_pelanggan || 'Pelanggan',
    telepon: rr.telepon || '',
    totalTagihan: Number(rr.total_tagihan) || 0,
    sudahDibayar: Number(rr.sudah_dibayar) || 0,
    sisaPiutang: Number(rr.sisa_piutang) || 0,
    status: rr.status || 'BELUM LUNAS',
    riwayatCicilan: Array.isArray(rr.riwayat_cicilan) ? rr.riwayat_cicilan : [],
    keterangan: rr.keterangan || ''
  }));

  const closingsList = clsRows.map((crw) => ({
    id: crw.id,
    tanggalBuku: crw.tanggal_buku || '',
    waktuClosing: crw.waktu_closing || '',
    kasAwal: Number(crw.kas_awal) || 0,
    penjualanTunai: Number(crw.penjualan_tunai) || 0,
    penjualanQris: Number(crw.penjualan_qris) || 0,
    penjualanTransfer: Number(crw.penjualan_transfer) || 0,
    penjualanEwallet: Number(crw.penjualan_ewallet) || 0,
    penjualanEdc: Number(crw.penjualan_edc) || 0,
    penjualanPiutang: Number(crw.penjualan_piutang) || 0,
    pelunasanPiutangTunai: Number(crw.pelunasan_piutang_tunai) || 0,
    pelunasanPiutangNonTunai: Number(crw.pelunasan_piutang_non_tunai) || 0,
    totalBiayaOps: Number(crw.total_biaya_ops) || 0,
    totalOmzet: Number(crw.total_omzet) || 0,
    kasSeharusnya: Number(crw.kas_seharusnya) || 0,
    kasAktualLaci: Number(crw.kas_aktual_laci) || 0,
    selisihKas: Number(crw.selisih_kas) || 0,
    statusSelisih: crw.status_selisih || 'BALANCE',
    catatan: crw.catatan || '',
    ditutupOleh: crw.ditutup_oleh || ''
  }));

  // KEAMANAN: Kirim daftar akun TANPA password_hash & pin_hash ke frontend
  const usersSafeList = usrRows.map((ur) => ({
    username: ur.username,
    role: ur.role || 'Kasir',
    namaLengkap: ur.nama_lengkap || ur.username,
    updatedAt: ur.updated_at || ''
  }));

  const logsList = logRows.map((lr) => ({
    id: lr.id,
    waktu: lr.waktu || '',
    username: lr.username || 'SYSTEM',
    aksi: lr.aksi || '',
    kodeProduk: lr.kode_produk || '-',
    detail: lr.detail || ''
  }));

  const configMap = {};
  let hasPgServerKey = false;
  let hasWaGatewayToken = false;
  let hasEmailPasskey = Boolean(process.env.SMTP_PASS);

  for (const kr of cfgRows) {
    if (kr.is_secret) {
      if (kr.config_key === 'PG_API_SERVER_KEY' && kr.config_value) hasPgServerKey = true;
      if (kr.config_key === 'WA_GATEWAY_TOKEN' && kr.config_value) hasWaGatewayToken = true;
      if (kr.config_key === 'EMAIL_SMTP_PASS' && kr.config_value) hasEmailPasskey = true;
      continue;
    }
    configMap[kr.config_key] = kr.config_value || '';
  }
  configMap.PG_HAS_SERVER_KEY = hasPgServerKey ? 'TRUE' : 'FALSE';
  configMap.WA_HAS_GATEWAY_TOKEN = hasWaGatewayToken ? 'TRUE' : 'FALSE';
  configMap.EMAIL_HAS_PASSKEY = hasEmailPasskey ? 'TRUE' : 'FALSE';

  return {
    status: 'success',
    needsMasterSeed: productsList.length < 50 || customersList.length < 50,
    productsCount: productsList.length,
    customersCount: customersList.length,
    emailQuota: Number(process.env.EMAIL_DAILY_QUOTA) || 500,
    data: {
      products: productsList,
      priceVariants: variantsList,
      privacyData: isOwner ? privacyList : [],
      customers: customersList,
      suppliers: suppliersList,
      salesStaff: salesList,
      transactions: transactionsList,
      archives: archivesList,
      paymentGatewayLogs: pgLogsList,
      operationalExpenses: expensesList,
      receivables: receivablesList,
      dailyClosings: closingsList,
      users: usersSafeList,
      activityLogs: logsList,
      configMap
    }
  };
}

/**
 * Helper batch upsert (Supabase direkomendasikan 500 baris per chunk)
 */
async function batchUpsert(tableName, rows, onConflictCol) {
  if (!rows || rows.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(tableName).upsert(slice, { onConflict: onConflictCol });
    if (error) throw new Error(`Gagal upsert ${tableName}: ${error.message}`);
  }
}

/**
 * 0B. SINKRONISASI PENUH DATABASE MASTER DARI FRONTEND KE 15 TABEL SUPABASE
 * (Setara syncFullMasterToSheetV91 di code.gs)
 */
async function syncFullMasterToSheetV91(payload) {
  const nowStr = getNowJakarta();

  if (Array.isArray(payload.products) && payload.products.length > 0) {
    const prodRows = payload.products.map((p) => ({
      kode: String(p.kode || ''),
      nama: String(p.nama || ''),
      kategori: String(p.kategori || 'PREMIUM'),
      gender: String(p.gender || 'Unisex'),
      notes_dominan: String(p.notesDominan || ''),
      top_notes: String(p.topNotes || ''),
      middle_notes: String(p.middleNotes || ''),
      base_notes: String(p.baseNotes || ''),
      tahun: Number(p.tahun || 2024),
      link: String(p.link || ''),
      keterangan: String(p.keterangan || ''),
      image: String(p.image || ''),
      stok_ml: Number(p.stokMl || 0),
      min_stok_ml: Number(p.minStokMl || 100),
      harga_dasar: Number(p.hargaDasar || 2500),
      lokasi_rak: String(p.lokasiRak || 'RAK-A01'),
      updated_at: String(p.updatedAt || nowStr)
    }));
    await batchUpsert('products', prodRows, 'kode');
  }

  const varCostMap = {};
  if (Array.isArray(payload.priceVariants) && payload.priceVariants.length > 0) {
    const varRows = payload.priceVariants.map((vr, idx) => {
      varCostMap[vr.id] = Number(vr.hargaModal || 0);
      return {
        id: String(vr.id || ''),
        kategori: String(vr.kategori || 'CLASSIC'),
        nama: String(vr.nama || ''),
        grade: String(vr.grade || ''),
        volume_ml: Number(vr.volumeMl || 1),
        harga: Number(vr.harga || 0),
        harga_modal: Number(vr.hargaModal || 0),
        tipe: String(vr.tipe || 'PAKET'),
        urutan: Number(vr.urutan || idx + 1),
        status: String(vr.status || 'AKTIF'),
        keterangan: String(vr.keterangan || ''),
        updated_at: String(vr.updatedAt || nowStr)
      };
    });
    await batchUpsert('price_variants', varRows, 'id');
  }

  if (Array.isArray(payload.privacyData) && payload.privacyData.length > 0) {
    const privRows = payload.privacyData.map((pr, d) => ({
      kode_produk: String(pr.kodeProduk || ''),
      brand_pabrikan: String(pr.brandPabrikan || ''),
      varian_bibit: String(pr.varianBibit || ''),
      inspired_by: String(pr.inspiredBy || ''),
      kategori: String(pr.kategori || 'PREMIUM'),
      rasio_vip: String(pr.rasioVIP || ''),
      rasio_vvip: String(pr.rasioVVIP || ''),
      harga_modal_ml: Number(pr.hargaModalMl || 1500),
      harga_modal_varian_json: d === 0 ? varCostMap : {},
      pemasok: String(pr.pemasok || ''),
      lokasi_rak: String(pr.lokasiRak || ''),
      updated_at: nowStr
    }));
    await batchUpsert('privacy_data', privRows, 'kode_produk');
  }

  if (Array.isArray(payload.customers) && payload.customers.length > 0) {
    const custRows = payload.customers.map((cu) => ({
      kode: String(cu.kode || ''),
      nama: String(cu.nama || ''),
      telepon: String(cu.telepon || ''),
      email: String(cu.email || ''),
      tanggal_bergabung: String(cu.tanggalBergabung || ''),
      alamat: String(cu.alamat || ''),
      keterangan: String(cu.keterangan || 'Member Reguler')
    }));
    await batchUpsert('customers', custRows, 'kode');
  }

  if (Array.isArray(payload.suppliers) && payload.suppliers.length > 0) {
    const supRows = payload.suppliers.map((su) => ({
      kode: String(su.kode || ''),
      nama: String(su.nama || ''),
      brand: String(su.brand || ''),
      telepon: String(su.telepon || ''),
      email: String(su.email || ''),
      alamat: String(su.alamat || ''),
      estimasi_po: Number(su.estimasiPo || 0),
      keterangan: String(su.keterangan || ''),
      updated_at: nowStr
    }));
    await batchUpsert('suppliers', supRows, 'kode');
  }

  if (Array.isArray(payload.salesStaff) && payload.salesStaff.length > 0) {
    const slsRows = payload.salesStaff.map((sa) => ({
      kode: String(sa.kode || ''),
      nama: String(sa.nama || ''),
      jabatan: String(sa.jabatan || ''),
      telepon: String(sa.telepon || ''),
      email: String(sa.email || ''),
      target: Number(sa.target || 0),
      komisi_pct: Number(sa.komisiPct || 3),
      status: String(sa.status || 'AKTIF'),
      updated_at: nowStr
    }));
    await batchUpsert('sales_staff', slsRows, 'kode');
  }

  if (Array.isArray(payload.transactions) && payload.transactions.length > 0) {
    const trxRows = payload.transactions.map((tr) => ({
      no_nota: String(tr.noNota || ''),
      waktu: String(tr.waktu || nowStr),
      kode_pelanggan: String(tr.kodePelanggan || 'UMUM'),
      nama_pelanggan: String(tr.namaPelanggan || 'Pelanggan Umum'),
      telepon_pelanggan: String(tr.teleponPelanggan || ''),
      email_pelanggan: String(tr.emailPelanggan || ''),
      kode_sales: String(tr.kodeSales || 'SLS-001'),
      nama_sales: String(tr.namaSales || 'Kasir'),
      items: Array.isArray(tr.items) ? tr.items : [],
      total_qty: Number(tr.totalQty || 0),
      total_ml: Number(tr.totalMl || 0),
      subtotal: Number(tr.subtotal || 0),
      diskon: Number(tr.diskon || 0),
      total_bayar: Number(tr.totalBayar || 0),
      uang_diterima: Number(tr.uangDiterima || 0),
      kembalian: Number(tr.kembalian || 0),
      total_modal: Number(tr.totalModal || 0),
      laba_kotor: Number(tr.labaKotor || 0),
      metode_bayar: String(tr.metodeBayar || 'Tunai'),
      catatan: String(tr.catatan || '-'),
      pg_id: String(tr.pgId || ''),
      pg_status: String(tr.pgStatus || 'SETTLED'),
      pg_ref_no: String(tr.pgRefNo || '')
    }));
    await batchUpsert('transactions', trxRows, 'no_nota');
  }

  if (Array.isArray(payload.paymentGatewayLogs) && payload.paymentGatewayLogs.length > 0) {
    const pgRows = payload.paymentGatewayLogs.map((pg) => ({
      id_pg: String(pg.idPg || ''),
      no_nota: String(pg.noNota || ''),
      waktu: String(pg.waktu || nowStr),
      kode_pelanggan: String(pg.kodePelanggan || 'UMUM'),
      nama_pelanggan: String(pg.namaPelanggan || 'Pelanggan Umum'),
      channel: String(pg.channel || 'QRIS'),
      provider: String(pg.provider || 'QRIS Wisata Parfum'),
      ref_no: String(pg.refNo || ''),
      nominal_tagihan: Number(pg.nominalTagihan || 0),
      biaya_mdr: Number(pg.biayaMdr || 0),
      nominal_bersih: Number(pg.nominalBersih || 0),
      status: String(pg.status || 'SETTLED'),
      nama_sales: String(pg.namaSales || 'Kasir')
    }));
    await batchUpsert('payment_gateway_logs', pgRows, 'id_pg');
  }

  if (Array.isArray(payload.operationalExpenses) && payload.operationalExpenses.length > 0) {
    const expRows = payload.operationalExpenses.map((eo) => ({
      id: String(eo.id || ''),
      tanggal: String(eo.tanggal || ''),
      kategori: String(eo.kategori || 'Lain-lain'),
      keterangan: String(eo.keterangan || ''),
      sumber_dana: String(eo.sumberDana || 'Kas Tunai Laci'),
      nominal: Number(eo.nominal || 0),
      dicatat_oleh: String(eo.dicatatOleh || 'prassetiosh'),
      updated_at: String(eo.updatedAt || nowStr)
    }));
    await batchUpsert('operational_expenses', expRows, 'id');
  }

  if (Array.isArray(payload.receivables) && payload.receivables.length > 0) {
    const recRows = payload.receivables.map((ro) => ({
      id: String(ro.id || ''),
      no_nota: String(ro.noNota || '-'),
      tanggal: String(ro.tanggal || ''),
      jatuh_tempo: String(ro.jatuhTempo || ''),
      kode_pelanggan: String(ro.kodePelanggan || 'UMUM'),
      nama_pelanggan: String(ro.namaPelanggan || ''),
      telepon: String(ro.telepon || ''),
      total_tagihan: Number(ro.totalTagihan || 0),
      sudah_dibayar: Number(ro.sudahDibayar || 0),
      sisa_piutang: Number(ro.sisaPiutang || 0),
      status: String(ro.status || 'BELUM LUNAS'),
      riwayat_cicilan: Array.isArray(ro.riwayatCicilan) ? ro.riwayatCicilan : [],
      keterangan: String(ro.keterangan || '')
    }));
    await batchUpsert('receivables', recRows, 'id');
  }

  if (Array.isArray(payload.dailyClosings) && payload.dailyClosings.length > 0) {
    const clsRows = payload.dailyClosings.map((co) => ({
      id: String(co.id || ''),
      tanggal_buku: String(co.tanggalBuku || ''),
      waktu_closing: String(co.waktuClosing || nowStr),
      kas_awal: Number(co.kasAwal || 0),
      penjualan_tunai: Number(co.penjualanTunai || 0),
      penjualan_qris: Number(co.penjualanQris || 0),
      penjualan_transfer: Number(co.penjualanTransfer || 0),
      penjualan_ewallet: Number(co.penjualanEwallet || 0),
      penjualan_edc: Number(co.penjualanEdc || 0),
      penjualan_piutang: Number(co.penjualanPiutang || 0),
      pelunasan_piutang_tunai: Number(co.pelunasanPiutangTunai || 0),
      pelunasan_piutang_non_tunai: Number(co.pelunasanPiutangNonTunai || 0),
      total_biaya_ops: Number(co.totalBiayaOps || 0),
      total_omzet: Number(co.totalOmzet || 0),
      kas_seharusnya: Number(co.kasSeharusnya || 0),
      kas_aktual_laci: Number(co.kasAktualLaci || 0),
      selisih_kas: Number(co.selisihKas || 0),
      status_selisih: String(co.statusSelisih || 'BALANCE'),
      catatan: String(co.catatan || ''),
      ditutup_oleh: String(co.ditutupOleh || '')
    }));
    await batchUpsert('daily_closings', clsRows, 'id');
  }

  await appendActivityLog(
    'CLOUD_MASTER_SYNC',
    payload.username || 'prassetiosh',
    'ALL_TABLES',
    'Sinkronisasi penuh 15 tabel database master ke Supabase'
  );

  return { status: 'success', message: 'Seluruh tabel database Supabase berhasil disinkronkan!' };
}

/**
 * 2. SERVER-SIDE PAGINATION & FILTERING (Setara querySheetPaginatedV91 di code.gs)
 */
async function querySheetPaginatedV91(params) {
  const sheetToTable = {
    Products: 'products',
    Price_Variants: 'price_variants',
    'data privacy': 'privacy_data',
    'data pelanggan': 'customers',
    Pemasok: 'suppliers',
    Sales: 'sales_staff',
    Transactions: 'transactions',
    Archives: 'archives',
    Payment_Gateway_Logs: 'payment_gateway_logs',
    Operational_Expenses: 'operational_expenses',
    Receivables: 'receivables',
    Daily_Closings: 'daily_closings',
    Activity_Logs: 'activity_logs'
  };

  const sheetName = String((params && params.sheetName) || 'Products');
  const tableName = sheetToTable[sheetName] || sheetName;
  const query = String((params && params.query) || '').trim().toLowerCase();
  const category = String((params && params.category) || 'ALL').trim().toUpperCase();
  const gender = String((params && params.gender) || 'ALL').trim();
  const offset = Math.max(0, parseInt((params && params.offset) || 0, 10));
  const limit = Math.max(1, Math.min(500, parseInt((params && params.limit) || 100, 10)));

  let q = supabase.from(tableName).select('*', { count: 'exact' });

  if (tableName === 'products') {
    if (category !== 'ALL') q = q.eq('kategori', category);
    if (gender !== 'ALL') q = q.eq('gender', gender);
    if (query) {
      q = q.or(
        `kode.ilike.%${query}%,nama.ilike.%${query}%,notes_dominan.ilike.%${query}%,top_notes.ilike.%${query}%,lokasi_rak.ilike.%${query}%`
      );
    }
  } else if (tableName === 'customers' && query) {
    q = q.or(`kode.ilike.%${query}%,nama.ilike.%${query}%,telepon.ilike.%${query}%,email.ilike.%${query}%`);
  }

  const { data, count, error } = await q.range(offset, offset + limit - 1);
  if (error) return { status: 'error', message: error.message };

  return {
    status: 'success',
    sheetName,
    totalMatched: count || (data ? data.length : 0),
    offset,
    limit,
    rows: data || []
  };
}

module.exports = {
  getAppBootstrapDataV91,
  syncFullMasterToSheetV91,
  querySheetPaginatedV91
};

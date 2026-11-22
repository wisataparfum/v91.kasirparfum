-- ============================================================================
-- FILE: supabase_schema.sql
-- PROYEK: v91.kasirparfum — Sistem POS Kasir, Keuangan, Piutang & Database
-- DATABASE: Supabase (PostgreSQL 15+)
-- ARSITEKTUR: 15 Tabel Terintegrasi + 4 Atomic PL/pgSQL RPC Functions
--             (Pengganti LockService & 15 Sheet Google Apps Script)
-- ============================================================================

-- Ekstensi standar
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- HELPER FUNCTION: FORMAT WAKTU ASIA/JAKARTA (dd/MM/yyyy HH:mm:ss & yyyyMMdd)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.now_jakarta_text()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'DD/MM/YYYY HH24:MI:SS');
$$;

CREATE OR REPLACE FUNCTION public.today_compact_jakarta()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD');
$$;

-- ============================================================================
-- 1. TABEL PRODUCTS (Sheet: Products)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  kode TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  kategori TEXT NOT NULL DEFAULT 'PREMIUM',
  gender TEXT NOT NULL DEFAULT 'Unisex',
  notes_dominan TEXT DEFAULT '',
  top_notes TEXT DEFAULT '',
  middle_notes TEXT DEFAULT '',
  base_notes TEXT DEFAULT '',
  tahun INTEGER DEFAULT 2024,
  link TEXT DEFAULT '',
  keterangan TEXT DEFAULT '',
  image TEXT DEFAULT '',
  stok_ml NUMERIC(14,2) NOT NULL DEFAULT 0,
  min_stok_ml NUMERIC(14,2) NOT NULL DEFAULT 100,
  harga_dasar NUMERIC(14,2) NOT NULL DEFAULT 2500,
  lokasi_rak TEXT DEFAULT 'RAK-A01',
  updated_at TEXT DEFAULT public.now_jakarta_text()
);

CREATE INDEX IF NOT EXISTS idx_products_kategori ON public.products (kategori);
CREATE INDEX IF NOT EXISTS idx_products_gender ON public.products (gender);

-- ============================================================================
-- 2. TABEL PRICE_VARIANTS (Sheet: Price_Variants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.price_variants (
  id TEXT PRIMARY KEY,
  kategori TEXT NOT NULL DEFAULT 'CLASSIC',
  nama TEXT NOT NULL,
  grade TEXT DEFAULT '',
  volume_ml NUMERIC(14,2) NOT NULL DEFAULT 1,
  harga NUMERIC(14,2) NOT NULL DEFAULT 0,
  harga_modal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tipe TEXT NOT NULL DEFAULT 'PAKET',
  urutan INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'AKTIF',
  keterangan TEXT DEFAULT '',
  updated_at TEXT DEFAULT public.now_jakarta_text()
);

CREATE INDEX IF NOT EXISTS idx_price_variants_kategori ON public.price_variants (kategori, urutan);

-- ============================================================================
-- 3. TABEL PRIVACY_DATA (Sheet: data privacy — Khusus Pemilik)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.privacy_data (
  kode_produk TEXT PRIMARY KEY,
  brand_pabrikan TEXT NOT NULL DEFAULT 'LUZI',
  varian_bibit TEXT DEFAULT '',
  inspired_by TEXT DEFAULT '',
  kategori TEXT DEFAULT 'PREMIUM',
  rasio_vip TEXT DEFAULT '65% Bibit : 35% Absolute',
  rasio_vvip TEXT DEFAULT '85% Bibit : 15% Absolute',
  harga_modal_ml NUMERIC(14,2) NOT NULL DEFAULT 1500,
  harga_modal_varian_json JSONB DEFAULT '{}'::jsonb,
  pemasok TEXT DEFAULT 'PT Luzi Fragrance Indonesia',
  lokasi_rak TEXT DEFAULT 'RAK-PRE-01',
  updated_at TEXT DEFAULT public.now_jakarta_text()
);

-- ============================================================================
-- 4. TABEL CUSTOMERS (Sheet: data pelanggan)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  kode TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  telepon TEXT DEFAULT '',
  email TEXT DEFAULT '',
  tanggal_bergabung TEXT DEFAULT '',
  alamat TEXT DEFAULT '',
  keterangan TEXT DEFAULT 'Member Reguler'
);

CREATE INDEX IF NOT EXISTS idx_customers_nama ON public.customers (nama);
CREATE INDEX IF NOT EXISTS idx_customers_telepon ON public.customers (telepon);

-- ============================================================================
-- 5. TABEL SUPPLIERS (Sheet: Pemasok — Khusus Pemilik)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  kode TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  brand TEXT DEFAULT '',
  telepon TEXT DEFAULT '',
  email TEXT DEFAULT '',
  alamat TEXT DEFAULT '',
  estimasi_po NUMERIC(16,2) NOT NULL DEFAULT 0,
  keterangan TEXT DEFAULT '',
  updated_at TEXT DEFAULT public.now_jakarta_text()
);

-- ============================================================================
-- 6. TABEL SALES_STAFF (Sheet: Sales)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sales_staff (
  kode TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  jabatan TEXT DEFAULT '',
  telepon TEXT DEFAULT '',
  email TEXT DEFAULT '',
  target NUMERIC(16,2) NOT NULL DEFAULT 0,
  komisi_pct NUMERIC(6,2) NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'AKTIF',
  updated_at TEXT DEFAULT public.now_jakarta_text()
);

-- ============================================================================
-- 7. TABEL TRANSACTIONS (Sheet: Transactions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  no_nota TEXT PRIMARY KEY,
  waktu TEXT NOT NULL,
  kode_pelanggan TEXT DEFAULT 'UMUM',
  nama_pelanggan TEXT DEFAULT 'Pelanggan Umum',
  telepon_pelanggan TEXT DEFAULT '',
  email_pelanggan TEXT DEFAULT '',
  kode_sales TEXT DEFAULT 'SLS-001',
  nama_sales TEXT DEFAULT 'Kasir',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_qty INTEGER NOT NULL DEFAULT 0,
  total_ml NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(16,2) NOT NULL DEFAULT 0,
  diskon NUMERIC(16,2) NOT NULL DEFAULT 0,
  total_bayar NUMERIC(16,2) NOT NULL DEFAULT 0,
  uang_diterima NUMERIC(16,2) NOT NULL DEFAULT 0,
  kembalian NUMERIC(16,2) NOT NULL DEFAULT 0,
  total_modal NUMERIC(16,2) NOT NULL DEFAULT 0,
  laba_kotor NUMERIC(16,2) NOT NULL DEFAULT 0,
  metode_bayar TEXT NOT NULL DEFAULT 'Tunai',
  catatan TEXT DEFAULT '-',
  pg_id TEXT DEFAULT '',
  pg_status TEXT DEFAULT 'SETTLED',
  pg_ref_no TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_pg_id ON public.transactions (pg_id);
CREATE INDEX IF NOT EXISTS idx_transactions_kode_pelanggan ON public.transactions (kode_pelanggan);

-- ============================================================================
-- 8. TABEL ARCHIVES (Sheet: Archives)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.archives (
  id BIGSERIAL PRIMARY KEY,
  batch_kode TEXT NOT NULL,
  batch_label TEXT NOT NULL DEFAULT 'Arsip Lama',
  archived_at TEXT NOT NULL,
  no_nota TEXT NOT NULL,
  waktu TEXT NOT NULL,
  kode_pelanggan TEXT DEFAULT 'UMUM',
  nama_pelanggan TEXT DEFAULT 'Pelanggan Umum',
  telepon_pelanggan TEXT DEFAULT '',
  email_pelanggan TEXT DEFAULT '',
  kode_sales TEXT DEFAULT 'SLS-001',
  nama_sales TEXT DEFAULT 'Kasir',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_qty INTEGER NOT NULL DEFAULT 0,
  total_ml NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(16,2) NOT NULL DEFAULT 0,
  diskon NUMERIC(16,2) NOT NULL DEFAULT 0,
  total_bayar NUMERIC(16,2) NOT NULL DEFAULT 0,
  metode_bayar TEXT NOT NULL DEFAULT 'Tunai',
  total_modal NUMERIC(16,2) NOT NULL DEFAULT 0,
  laba_kotor NUMERIC(16,2) NOT NULL DEFAULT 0,
  catatan TEXT DEFAULT '-',
  pg_id TEXT DEFAULT '',
  pg_status TEXT DEFAULT 'SETTLED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archives_batch_kode ON public.archives (batch_kode);
CREATE INDEX IF NOT EXISTS idx_archives_no_nota ON public.archives (no_nota);

-- ============================================================================
-- 9. TABEL PAYMENT_GATEWAY_LOGS (Sheet: Payment_Gateway_Logs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_gateway_logs (
  id_pg TEXT PRIMARY KEY,
  no_nota TEXT NOT NULL DEFAULT '',
  waktu TEXT NOT NULL,
  kode_pelanggan TEXT DEFAULT 'UMUM',
  nama_pelanggan TEXT DEFAULT 'Pelanggan Umum',
  channel TEXT DEFAULT 'QRIS',
  provider TEXT DEFAULT 'QRIS Wisata Parfum',
  ref_no TEXT DEFAULT '',
  nominal_tagihan NUMERIC(16,2) NOT NULL DEFAULT 0,
  biaya_mdr NUMERIC(16,2) NOT NULL DEFAULT 0,
  nominal_bersih NUMERIC(16,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'TERVERIFIKASI',
  nama_sales TEXT DEFAULT 'Kasir',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pg_logs_no_nota ON public.payment_gateway_logs (no_nota);
CREATE INDEX IF NOT EXISTS idx_pg_logs_created_at ON public.payment_gateway_logs (created_at DESC);

-- ============================================================================
-- 10. TABEL OPERATIONAL_EXPENSES (Sheet: Operational_Expenses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.operational_expenses (
  id TEXT PRIMARY KEY,
  tanggal TEXT NOT NULL,
  kategori TEXT NOT NULL DEFAULT 'Lain-lain',
  keterangan TEXT DEFAULT '',
  sumber_dana TEXT DEFAULT 'Kas Tunai Laci',
  nominal NUMERIC(16,2) NOT NULL DEFAULT 0,
  dicatat_oleh TEXT DEFAULT 'prassetiosh',
  updated_at TEXT DEFAULT public.now_jakarta_text(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 11. TABEL RECEIVABLES (Sheet: Receivables)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.receivables (
  id TEXT PRIMARY KEY,
  no_nota TEXT DEFAULT '-',
  tanggal TEXT NOT NULL,
  jatuh_tempo TEXT DEFAULT '',
  kode_pelanggan TEXT DEFAULT 'UMUM',
  nama_pelanggan TEXT NOT NULL,
  telepon TEXT DEFAULT '',
  total_tagihan NUMERIC(16,2) NOT NULL DEFAULT 0,
  sudah_dibayar NUMERIC(16,2) NOT NULL DEFAULT 0,
  sisa_piutang NUMERIC(16,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'BELUM LUNAS',
  riwayat_cicilan JSONB NOT NULL DEFAULT '[]'::jsonb,
  keterangan TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 12. TABEL DAILY_CLOSINGS (Sheet: Daily_Closings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_closings (
  id TEXT PRIMARY KEY,
  tanggal_buku TEXT NOT NULL,
  waktu_closing TEXT NOT NULL,
  kas_awal NUMERIC(16,2) NOT NULL DEFAULT 0,
  penjualan_tunai NUMERIC(16,2) NOT NULL DEFAULT 0,
  penjualan_qris NUMERIC(16,2) NOT NULL DEFAULT 0,
  penjualan_transfer NUMERIC(16,2) NOT NULL DEFAULT 0,
  penjualan_ewallet NUMERIC(16,2) NOT NULL DEFAULT 0,
  penjualan_edc NUMERIC(16,2) NOT NULL DEFAULT 0,
  penjualan_piutang NUMERIC(16,2) NOT NULL DEFAULT 0,
  pelunasan_piutang_tunai NUMERIC(16,2) NOT NULL DEFAULT 0,
  pelunasan_piutang_non_tunai NUMERIC(16,2) NOT NULL DEFAULT 0,
  total_biaya_ops NUMERIC(16,2) NOT NULL DEFAULT 0,
  total_omzet NUMERIC(16,2) NOT NULL DEFAULT 0,
  kas_seharusnya NUMERIC(16,2) NOT NULL DEFAULT 0,
  kas_aktual_laci NUMERIC(16,2) NOT NULL DEFAULT 0,
  selisih_kas NUMERIC(16,2) NOT NULL DEFAULT 0,
  status_selisih TEXT NOT NULL DEFAULT 'BALANCE',
  catatan TEXT DEFAULT '',
  ditutup_oleh TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 13. TABEL ADMIN_USERS (Sheet: Admin_Users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  pin_hash TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'Kasir' CHECK (role IN ('Pemilik', 'Administrator', 'Kasir')),
  nama_lengkap TEXT NOT NULL,
  updated_at TEXT DEFAULT public.now_jakarta_text()
);

-- ============================================================================
-- 14. TABEL ACTIVITY_LOGS (Sheet: Activity_Logs)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public.activity_logs_seq START 1;

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id TEXT PRIMARY KEY,
  waktu TEXT NOT NULL DEFAULT public.now_jakarta_text(),
  username TEXT NOT NULL DEFAULT 'SYSTEM',
  aksi TEXT NOT NULL,
  kode_produk TEXT DEFAULT '-',
  detail TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);

-- ============================================================================
-- 15. TABEL APP_CONFIG (Sheet: App_Config + PropertiesService Secret Storage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_config (
  config_key TEXT PRIMARY KEY,
  config_value TEXT DEFAULT '',
  is_secret BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TEXT DEFAULT public.now_jakarta_text()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — HANYA BACKEND SERVICE_ROLE YANG AKSES LANGSUNG
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'products', 'price_variants', 'privacy_data', 'customers', 'suppliers',
    'sales_staff', 'transactions', 'archives', 'payment_gateway_logs',
    'operational_expenses', 'receivables', 'daily_closings', 'admin_users',
    'activity_logs', 'app_config'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END $$;

-- ============================================================================
-- ATOMIC RPC FUNCTIONS (PENGGANTI LOCKSERVICE GAS UNTUK MULTI-KASIR AMAN)
-- ============================================================================

-- Helper internal untuk insert log aktivitas dari dalam RPC
CREATE OR REPLACE FUNCTION public.internal_append_log(
  p_aksi TEXT,
  p_username TEXT,
  p_kode_produk TEXT,
  p_detail TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq BIGINT;
  v_id TEXT;
BEGIN
  v_seq := nextval('public.activity_logs_seq');
  v_id := 'LOG-' || LPAD(v_seq::TEXT, 4, '0');
  INSERT INTO public.activity_logs (id, waktu, username, aksi, kode_produk, detail)
  VALUES (
    v_id,
    public.now_jakarta_text(),
    COALESCE(NULLIF(p_username, ''), 'SYSTEM'),
    p_aksi,
    COALESCE(NULLIF(p_kode_produk, ''), '-'),
    COALESCE(p_detail, '')
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC 1: SIMPAN TRANSAKSI POS ATOMIK (INV-YYYYMMDD-XXX + POTONG STOK + PG LOG)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_save_pos_transaction(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TEXT := public.now_jakarta_text();
  v_today_prefix TEXT := substring(v_now FROM 1 FOR 10);
  v_compact_date TEXT := public.today_compact_jakarta();
  v_daily_count INTEGER;
  v_trx_id TEXT;
  v_pg_count INTEGER;
  v_pg_id TEXT;
  v_pg_status TEXT;
  v_pg_ref_no TEXT;
  v_stock_mode TEXT;
  v_items JSONB;
  v_item JSONB;
  v_total_bayar NUMERIC(16,2);
  v_mdr_fee NUMERIC(16,2);
  v_net_amt NUMERIC(16,2);
BEGIN
  -- Advisory lock setara LockService GAS agar 2 kasir tidak tabrakan nomor nota & stok
  PERFORM pg_advisory_xact_lock(910001);

  -- 1. Generate nomor nota harian sekuensial (INV-YYYYMMDD-001)
  SELECT COUNT(*) INTO v_daily_count
  FROM public.transactions
  WHERE waktu LIKE (v_today_prefix || '%');

  v_trx_id := 'INV-' || v_compact_date || '-' || LPAD((v_daily_count + 1)::TEXT, 3, '0');
  WHILE EXISTS (SELECT 1 FROM public.transactions WHERE no_nota = v_trx_id) LOOP
    v_daily_count := v_daily_count + 1;
    v_trx_id := 'INV-' || v_compact_date || '-' || LPAD((v_daily_count + 1)::TEXT, 3, '0');
  END LOOP;

  -- 2. Potong stok jika Mode WITH_STOCK
  v_stock_mode := COALESCE(p_payload->>'stockMode', 'WITH_STOCK');
  v_items := COALESCE(p_payload->'items', '[]'::jsonb);

  IF v_stock_mode = 'WITH_STOCK' AND jsonb_array_length(v_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
      UPDATE public.products
      SET stok_ml = GREATEST(0, stok_ml - COALESCE((v_item->>'volumeMl')::NUMERIC, 0)),
          updated_at = v_now
      WHERE kode = TRIM(COALESCE(v_item->>'kodeProduk', ''));
    END LOOP;
  END IF;

  -- 3. Generate ID Payment Gateway (PG-YYYYMMDD-XXXX)
  SELECT COUNT(*) INTO v_pg_count FROM public.payment_gateway_logs;
  v_pg_id := 'PG-' || v_compact_date || '-' || LPAD((v_pg_count + 1)::TEXT, 4, '0');
  WHILE EXISTS (SELECT 1 FROM public.payment_gateway_logs WHERE id_pg = v_pg_id) LOOP
    v_pg_count := v_pg_count + 1;
    v_pg_id := 'PG-' || v_compact_date || '-' || LPAD((v_pg_count + 1)::TEXT, 4, '0');
  END LOOP;

  v_pg_status := COALESCE(NULLIF(p_payload->>'pgStatus', ''), 'SETTLED');
  v_pg_ref_no := COALESCE(NULLIF(p_payload->>'pgRefNo', ''), 'REF-' || v_trx_id);
  v_total_bayar := COALESCE((p_payload->>'totalBayar')::NUMERIC, 0);
  v_mdr_fee := COALESCE((p_payload->>'pgMdrFee')::NUMERIC, 0);
  v_net_amt := v_total_bayar - v_mdr_fee;

  -- 4. Insert ke tabel transactions
  INSERT INTO public.transactions (
    no_nota, waktu, kode_pelanggan, nama_pelanggan, telepon_pelanggan, email_pelanggan,
    kode_sales, nama_sales, items, total_qty, total_ml, subtotal, diskon, total_bayar,
    uang_diterima, kembalian, total_modal, laba_kotor, metode_bayar, catatan,
    pg_id, pg_status, pg_ref_no
  ) VALUES (
    v_trx_id,
    v_now,
    COALESCE(NULLIF(p_payload->>'kodePelanggan', ''), 'UMUM'),
    COALESCE(NULLIF(p_payload->>'namaPelanggan', ''), 'Pelanggan Umum'),
    COALESCE(p_payload->>'teleponPelanggan', ''),
    COALESCE(p_payload->>'emailPelanggan', ''),
    COALESCE(NULLIF(p_payload->>'kodeSales', ''), 'SLS-001'),
    COALESCE(NULLIF(p_payload->>'namaSales', ''), 'Kasir'),
    v_items,
    COALESCE((p_payload->>'totalQty')::INTEGER, 0),
    COALESCE((p_payload->>'totalMl')::NUMERIC, 0),
    COALESCE((p_payload->>'subtotal')::NUMERIC, 0),
    COALESCE((p_payload->>'diskon')::NUMERIC, 0),
    v_total_bayar,
    COALESCE((p_payload->>'uangDiterima')::NUMERIC, 0),
    COALESCE((p_payload->>'kembalian')::NUMERIC, 0),
    COALESCE((p_payload->>'totalModal')::NUMERIC, 0),
    COALESCE((p_payload->>'labaKotor')::NUMERIC, 0),
    COALESCE(NULLIF(p_payload->>'metodeBayar', ''), 'Tunai'),
    COALESCE(NULLIF(p_payload->>'catatan', ''), '-'),
    v_pg_id,
    v_pg_status,
    v_pg_ref_no
  );

  -- 5. Insert ke tabel payment_gateway_logs
  INSERT INTO public.payment_gateway_logs (
    id_pg, no_nota, waktu, kode_pelanggan, nama_pelanggan, channel, provider,
    ref_no, nominal_tagihan, biaya_mdr, nominal_bersih, status, nama_sales
  ) VALUES (
    v_pg_id,
    v_trx_id,
    v_now,
    COALESCE(NULLIF(p_payload->>'kodePelanggan', ''), 'UMUM'),
    COALESCE(NULLIF(p_payload->>'namaPelanggan', ''), 'Pelanggan Umum'),
    COALESCE(NULLIF(p_payload->>'metodeBayar', ''), 'Tunai'),
    COALESCE(NULLIF(p_payload->>'pgProvider', ''), 'QRIS Dinamis Wisata Parfum'),
    v_pg_ref_no,
    v_total_bayar,
    v_mdr_fee,
    v_net_amt,
    v_pg_status,
    COALESCE(NULLIF(p_payload->>'namaSales', ''), 'Kasir')
  );

  -- 6. Catat Activity Log
  PERFORM public.internal_append_log(
    'POS_SALE_SAVED',
    COALESCE(p_payload->>'username', 'KASIR'),
    v_trx_id,
    'Simpan transaksi ' || v_trx_id || ' (' || COALESCE(p_payload->>'metodeBayar', 'Tunai') || ' / ' || v_pg_id || ') Rp ' || v_total_bayar::TEXT
  );

  RETURN jsonb_build_object(
    'status', 'success',
    'noNota', v_trx_id,
    'pgId', v_pg_id,
    'waktu', v_now
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC 2: HAPUS TRANSAKSI + ROLLBACK STOK & HAPUS LOG PAYMENT GATEWAY OTOMATIS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_delete_transaction_with_rollback(
  p_no_nota TEXT,
  p_is_archive BOOLEAN DEFAULT FALSE,
  p_stock_mode TEXT DEFAULT 'WITH_STOCK',
  p_username TEXT DEFAULT 'prassetiosh'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_items JSONB;
  v_item JSONB;
  v_now TEXT := public.now_jakarta_text();
BEGIN
  PERFORM pg_advisory_xact_lock(910001);

  IF p_is_archive THEN
    DELETE FROM public.archives WHERE no_nota = p_no_nota;
    PERFORM public.internal_append_log('DELETE_TRANSACTION', p_username, p_no_nota, 'Menghapus data ' || p_no_nota || ' dari Archives');
  ELSE
    SELECT items INTO v_items FROM public.transactions WHERE no_nota = p_no_nota;
    IF FOUND THEN
      IF p_stock_mode <> 'NO_STOCK' AND v_items IS NOT NULL AND jsonb_array_length(v_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
        LOOP
          UPDATE public.products
          SET stok_ml = stok_ml + COALESCE((v_item->>'volumeMl')::NUMERIC, 0),
              updated_at = v_now
          WHERE kode = TRIM(COALESCE(v_item->>'kodeProduk', ''));
        END LOOP;
      END IF;

      DELETE FROM public.payment_gateway_logs WHERE no_nota = p_no_nota;
      DELETE FROM public.transactions WHERE no_nota = p_no_nota;
      PERFORM public.internal_append_log('DELETE_TRANSACTION', p_username, p_no_nota, 'Menghapus data ' || p_no_nota || ' dari Transactions (+ rollback stok & PG log)');
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'success', 'deletedKey', p_no_nota);
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC 3: PENGARSIPAN TRANSAKSI KE ARCHIVES & RESET BUKU TRANSAKSI BARU
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_archive_transactions(
  p_period_label TEXT DEFAULT 'Arsip Periode Berjalan',
  p_username TEXT DEFAULT 'prassetiosh'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TEXT := public.now_jakarta_text();
  v_batch_code TEXT := 'ARSIP-' || to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD-HH24MI');
  v_moved INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(910002);

  SELECT COUNT(*) INTO v_moved FROM public.transactions;
  IF v_moved = 0 THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Tidak ada transaksi aktif untuk diarsipkan.');
  END IF;

  INSERT INTO public.archives (
    batch_kode, batch_label, archived_at, no_nota, waktu, kode_pelanggan, nama_pelanggan,
    telepon_pelanggan, email_pelanggan, kode_sales, nama_sales, items, total_qty, total_ml,
    subtotal, diskon, total_bayar, metode_bayar, total_modal, laba_kotor, catatan, pg_id, pg_status
  )
  SELECT
    v_batch_code, COALESCE(NULLIF(p_period_label, ''), 'Arsip Periode Berjalan'), v_now,
    no_nota, waktu, kode_pelanggan, nama_pelanggan,
    telepon_pelanggan, email_pelanggan, kode_sales, nama_sales, items, total_qty, total_ml,
    subtotal, diskon, total_bayar, metode_bayar, total_modal, laba_kotor, catatan, pg_id, pg_status
  FROM public.transactions;

  DELETE FROM public.transactions;

  PERFORM public.internal_append_log(
    'ARCHIVE_DATABASE',
    p_username,
    v_batch_code,
    'Mengarsipkan ' || v_moved::TEXT || ' transaksi ke ' || v_batch_code
  );

  RETURN jsonb_build_object('status', 'success', 'batchCode', v_batch_code, 'movedCount', v_moved);
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC 4: SETTING MASSAL STOK (DENGAN STOK / TANPA STOK + SET / ADD MASSAL)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_bulk_update_stock(
  p_stock_mode TEXT DEFAULT 'WITH_STOCK',
  p_target_category TEXT DEFAULT 'ALL',
  p_action_type TEXT DEFAULT 'NONE',
  p_value_ml NUMERIC DEFAULT 0,
  p_username TEXT DEFAULT 'prassetiosh'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TEXT := public.now_jakarta_text();
  v_cat TEXT := UPPER(COALESCE(p_target_category, 'ALL'));
  v_act TEXT := UPPER(COALESCE(p_action_type, 'NONE'));
  v_val NUMERIC := GREATEST(0, COALESCE(p_value_ml, 0));
  v_updated INTEGER := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(910003);

  INSERT INTO public.app_config (config_key, config_value, is_secret, updated_at)
  VALUES ('STOCK_MODE', p_stock_mode, FALSE, v_now)
  ON CONFLICT (config_key) DO UPDATE
    SET config_value = EXCLUDED.config_value,
        updated_at = EXCLUDED.updated_at;

  IF v_act = 'SET' THEN
    UPDATE public.products
    SET stok_ml = v_val, updated_at = v_now
    WHERE v_cat = 'ALL' OR UPPER(kategori) = v_cat;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSIF v_act = 'ADD' THEN
    UPDATE public.products
    SET stok_ml = stok_ml + v_val, updated_at = v_now
    WHERE v_cat = 'ALL' OR UPPER(kategori) = v_cat;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  PERFORM public.internal_append_log(
    'BULK_STOCK_UPDATE',
    p_username,
    v_cat,
    'Mode: ' || p_stock_mode || ', Diperbarui: ' || v_updated::TEXT || ' produk'
  );

  RETURN jsonb_build_object('status', 'success', 'stockMode', p_stock_mode, 'updatedCount', v_updated);
END;
$$;

-- ============================================================================
-- INITIAL SEED DATA (NON-DESTRUKTIF: ON CONFLICT DO NOTHING — SETARA setup.gs)
-- ============================================================================

-- Akun Default (Password & PIN di-hash dengan bcrypt via pgcrypto crypt/bf)
INSERT INTO public.admin_users (username, password_hash, pin_hash, role, nama_lengkap)
VALUES
  ('prassetiosh', crypt('cobasandi123', gen_salt('bf', 10)), crypt('9191', gen_salt('bf', 10)), 'Pemilik', 'Prassetio Sapto Harjo'),
  ('kasir01', crypt('kasir123', gen_salt('bf', 10)), crypt('1234', gen_salt('bf', 10)), 'Kasir', 'Rizky Pratama (Kasir)')
ON CONFLICT (username) DO NOTHING;

-- 24 Varian Harga Default
INSERT INTO public.price_variants (id, kategori, nama, grade, volume_ml, harga, harga_modal, tipe, urutan, status, keterangan)
VALUES
  ('CLS_ML', 'CLASSIC', 'Per ml CLASSIC', 'ECERAN PER ML', 1, 2500, 1000, 'PER_ML', 1, 'AKTIF', 'Harga eceran per ml Classic'),
  ('CLS_10_EKS', 'CLASSIC', '10ml EKS CLASSIC', 'EKSKLUSIF (75:25)', 10, 30000, 12500, 'PAKET', 2, 'AKTIF', 'Paket botol 10ml Eksklusif Classic'),
  ('CLS_20_VIP', 'CLASSIC', '20ml VIP CLASSIC', 'VIP (65:35)', 20, 38000, 16000, 'PAKET', 3, 'AKTIF', 'Paket botol 20ml VIP Classic'),
  ('CLS_20_VVIP', 'CLASSIC', '20ml VVIP CLASSIC', 'VVIP (85:15)', 20, 48000, 20000, 'PAKET', 4, 'AKTIF', 'Paket botol 20ml VVIP Classic'),
  ('CLS_30_VIP', 'CLASSIC', '30ml VIP CLASSIC', 'VIP (65:35)', 30, 53000, 22500, 'PAKET', 5, 'AKTIF', 'Paket botol 30ml VIP Classic'),
  ('CLS_30_VVIP', 'CLASSIC', '30ml VVIP CLASSIC', 'VVIP (85:15)', 30, 68000, 28500, 'PAKET', 6, 'AKTIF', 'Paket botol 30ml VVIP Classic'),
  ('CLS_50_VIP', 'CLASSIC', '50ml VIP CLASSIC', 'VIP (65:35)', 50, 98000, 41000, 'PAKET', 7, 'AKTIF', 'Paket botol 50ml VIP Classic'),
  ('CLS_50_VVIP', 'CLASSIC', '50ml VVIP CLASSIC', 'VVIP (85:15)', 50, 110000, 46000, 'PAKET', 8, 'AKTIF', 'Paket botol 50ml VVIP Classic'),
  ('CLS_100_VIP', 'CLASSIC', '100ml VIP CLASSIC', 'VIP (65:35)', 100, 160000, 67000, 'PAKET', 9, 'AKTIF', 'Paket botol 100ml VIP Classic'),
  ('CLS_100_VVIP', 'CLASSIC', '100ml VVIP CLASSIC', 'VVIP (85:15)', 100, 210000, 88000, 'PAKET', 10, 'AKTIF', 'Paket botol 100ml VVIP Classic'),
  ('PRE_ML', 'PREMIUM', 'Per ml PREMIUM', 'ECERAN PER ML', 1, 4000, 1500, 'PER_ML', 1, 'AKTIF', 'Harga eceran per ml Premium'),
  ('PRE_10_EKS', 'PREMIUM', '10ml EKS PREMIUM', 'EKSKLUSIF (75:25)', 10, 45000, 19000, 'PAKET', 2, 'AKTIF', 'Paket botol 10ml Eksklusif Premium'),
  ('PRE_20_VIP', 'PREMIUM', '20ml - Premium - VIP', 'VIP (65:35)', 20, 56000, 23500, 'PAKET', 3, 'AKTIF', 'Paket botol 20ml VIP Premium'),
  ('PRE_20_VVIP', 'PREMIUM', '20ml - Premium - VVIP', 'VVIP (85:15)', 20, 72000, 30000, 'PAKET', 4, 'AKTIF', 'Paket botol 20ml VVIP Premium'),
  ('PRE_30_VIP', 'PREMIUM', '30ml VIP PREMIUM', 'VIP (65:35)', 30, 80000, 33500, 'PAKET', 5, 'AKTIF', 'Paket botol 30ml VIP Premium'),
  ('PRE_30_VVIP', 'PREMIUM', '30ml VVIP PREMIUM', 'VVIP (85:15)', 30, 104000, 43500, 'PAKET', 6, 'AKTIF', 'Paket botol 30ml VVIP Premium'),
  ('PRE_50_VIP', 'PREMIUM', '50ml VIP PREMIUM', 'VIP (65:35)', 50, 130000, 54500, 'PAKET', 7, 'AKTIF', 'Paket botol 50ml VIP Premium'),
  ('PRE_50_VVIP', 'PREMIUM', '50ml VVIP PREMIUM', 'VVIP (85:15)', 50, 170000, 71500, 'PAKET', 8, 'AKTIF', 'Paket botol 50ml VVIP Premium'),
  ('PRE_100_VIP', 'PREMIUM', '100ml VIP PREMIUM', 'VIP (65:35)', 100, 250000, 105000, 'PAKET', 9, 'AKTIF', 'Paket botol 100ml VIP Premium'),
  ('PRE_100_VVIP', 'PREMIUM', '100ml VVIP PREMIUM', 'VVIP (85:15)', 100, 330000, 138500, 'PAKET', 10, 'AKTIF', 'Paket botol 100ml VVIP Premium'),
  ('LND_STD', 'LAUNDRY', 'LAUNDRY', 'STANDAR LAUNDRY', 250, 20000, 8500, 'PAKET', 1, 'AKTIF', 'Varian standar parfum Laundry'),
  ('LND_500ML', 'LAUNDRY', '500ml Botol Spray Laundry', 'GRADE A LAUNDRY', 500, 35000, 15000, 'PAKET', 2, 'AKTIF', 'Kemasan botol spray 500ml siap pakai'),
  ('LND_1L', 'LAUNDRY', '1 Liter Jerigen Laundry', 'SUPER LAUNDRY', 1000, 65000, 28000, 'PAKET', 3, 'AKTIF', 'Kemasan jerigen 1 Liter usaha laundry'),
  ('LND_5L', 'LAUNDRY', '5 Liter Grosir Laundry', 'GROSIR LAUNDRY', 5000, 290000, 125000, 'PAKET', 4, 'AKTIF', 'Kemasan jerigen 5 Liter grosir')
ON CONFLICT (id) DO NOTHING;

-- Konfigurasi Awal App_Config
INSERT INTO public.app_config (config_key, config_value, is_secret)
VALUES
  ('STOCK_MODE', 'WITH_STOCK', FALSE),
  ('DEFAULT_THEME', 'light', FALSE),
  ('APP_NAME', 'v91.kasirparfum', FALSE),
  ('STORE_NAME', 'WISATA PARFUM', FALSE),
  ('STORE_ADDRESS', 'Jl. Raya Cipayung, Jakarta Timur • Telp/WA: 085692009910', FALSE),
  ('WA_PHONE', '085692009910', FALSE),
  ('EMAIL_SENDER', 'wisataparfum10@gmail.com', FALSE),
  ('PG_PROVIDER_MODE', 'STANDALONE_QRIS', FALSE),
  ('PG_MERCHANT_NAME', 'WISATA PARFUM', FALSE),
  ('PG_NMID', 'ID1026000091910', FALSE),
  ('PG_MDR_PCT', '0.7', FALSE)
ON CONFLICT (config_key) DO NOTHING;

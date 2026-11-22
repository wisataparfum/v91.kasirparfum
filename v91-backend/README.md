# v91.kasirparfum — Backend Node.js & Database Supabase

Migrasi 1:1 dari Google Apps Script (`code.gs` & `setup.gs`) ke **Node.js (Express)** + **Supabase (PostgreSQL)** dengan alur, logika bisnis, proteksi concurrency, dan format JSON yang identik dengan `index.html`.

## 1. Setup Database Supabase

1. Buat project baru di [Supabase](https://supabase.com/).
2. Buka **SQL Editor** di dashboard Supabase.
3. Jalankan seluruh isi file `supabase/schema.sql` (membuat **15 tabel**, index, RLS, **4 fungsi PL/pgSQL RPC atomik**, serta data awal default `admin_users`, 24 `price_variants`, dan `app_config`).
4. Ambil **Project URL** dan **Service Role Key** dari *Project Settings -> API*.

## 2. Setup Backend Node.js

```bash
npm install
cp .env.example .env
# Isi SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, dan SMTP_* di file .env
npm start
```

Server berjalan di `http://localhost:3000` (cek `GET /health`).

## 3. Pemetaan 1:1 Fitur GAS ke Node.js + Supabase

| Fungsi GAS (`code.gs`) | Endpoint REST | Endpoint RPC Bridge | Mekanisme Supabase |
| :--- | :--- | :--- | :--- |
| `authenticateUserV91` | `POST /api/auth/login` | `POST /api/rpc/authenticateUserV91` | Verifikasi `bcryptjs` (Password / PIN) + JWT Token |
| `getAppBootstrapDataV91` | `GET /api/bootstrap` | `POST /api/rpc/getAppBootstrapDataV91` | Query 15 tabel + filter RBAC (HPP & Privacy hanya untuk Pemilik) |
| `syncFullMasterToSheetV91` | `POST /api/sync/master` | `POST /api/rpc/syncFullMasterToSheetV91` | Batch upsert 500 baris/chunk ke 15 tabel |
| `querySheetPaginatedV91` | `POST /api/query/paginated` | `POST /api/rpc/querySheetPaginatedV91` | Filter `ilike` + `range(offset, limit)` |
| `savePosTransactionV91` | `POST /api/transactions` | `POST /api/rpc/savePosTransactionV91` | `rpc_save_pos_transaction` (`pg_advisory_xact_lock`, no nota `INV-YYYYMMDD-XXX`, potong stok, insert PG log) |
| `saveCrudRecordV91` | `POST /api/crud/save` | `POST /api/rpc/saveCrudRecordV91` | Upsert 12 entitas + sinkronisasi HPP varian & bcrypt akun |
| `deleteCrudRecordV91` | `POST /api/crud/delete` | `POST /api/rpc/deleteCrudRecordV91` | `rpc_delete_transaction_with_rollback` (kembalikan stok & hapus PG log) |
| `saveAppSettingsV91` | `POST /api/settings` | `POST /api/rpc/saveAppSettingsV91` | Upsert `app_config` + isolasi `is_secret = true` |
| `updateBulkStockV91` | `POST /api/stock/bulk` | `POST /api/rpc/updateBulkStockV91` | `rpc_bulk_update_stock` (mode `WITH_STOCK` / `NO_STOCK` + `SET`/`ADD`) |
| `archiveTransactionsV91` | `POST /api/archives` | `POST /api/rpc/archiveTransactionsV91` | `rpc_archive_transactions` (pindah atomik ke `archives`) |
| `verifyAndLoginEmailV91` | `POST /api/email/verify` | `POST /api/rpc/verifyAndLoginEmailV91` | Verifikasi koneksi SMTP `nodemailer` |
| `sendDigitalReceiptEmailV91` | `POST /api/email/send-receipt` | `POST /api/rpc/sendDigitalReceiptEmailV91` | Kirim email nota via `nodemailer` (`replyTo` & `cc`) |
| `sendWhatsAppAutoV91` | `POST /api/whatsapp/send-auto` | `POST /api/rpc/sendWhatsAppAutoV91` | Forward `POST` ke WA Gateway URL dengan token rahasia |
| `doPost` (Webhook) | `POST /api/webhook/payment-gateway` | — | Update status `SETTLED`/`FAILED`/`PENDING` di `transactions` & `payment_gateway_logs` |

## 4. Menghubungkan `index.html`

Letakkan `index.html` ke dalam folder `public/` lalu ganti implementasi `callGasBackend` dengan kode dari `frontend-bridge.js`. Akun login awal bawaan dari `setup.gs`:
- Pemilik: `prassetiosh` (password `cobasandi123` atau PIN `9191`)
- Kasir: `kasir01` (password `kasir123` atau PIN `1234`)

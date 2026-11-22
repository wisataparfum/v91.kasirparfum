const express = require('express');
const { requireAuth, optionalAuth, requireOwner } = require('../middleware/auth');
const { authenticateUserV91 } = require('../services/authService');
const {
  getAppBootstrapDataV91,
  syncFullMasterToSheetV91,
  querySheetPaginatedV91
} = require('../services/bootstrapService');
const {
  savePosTransactionV91,
  updateBulkStockV91,
  archiveTransactionsV91,
  handlePaymentGatewayWebhook
} = require('../services/posService');
const { saveCrudRecordV91, deleteCrudRecordV91 } = require('../services/crudService');
const { saveAppSettingsV91 } = require('../services/settingsService');
const {
  verifyAndLoginEmailV91,
  sendDigitalReceiptEmailV91,
  sendWhatsAppAutoV91
} = require('../services/notificationService');

const router = express.Router();

// Helper RBAC untuk tipe CRUD yang hanya boleh diakses Pemilik
const OWNER_ONLY_CRUD_SAVE_TYPES = new Set([
  'PRODUCT',
  'VARIANT',
  'PRIVACY',
  'SUPPLIER',
  'SALES',
  'TRANSACTION',
  'USER_ACCOUNT',
  'PAYMENT_MANUAL_VERIFY'
]);

function checkCrudSavePermission(req, res, next) {
  const type = String((req.body && req.body.type) || '').toUpperCase();
  const isEdit = Boolean(req.body && req.body.isEdit);
  const role = req.user && req.user.role;
  const isOwner = role === 'Pemilik' || role === 'Administrator';

  // Kasir hanya boleh tambah CUSTOMER, EXPENSE, RECEIVABLE (atau update cicilan RECEIVABLE), dan DAILY_CLOSING
  if (!isOwner) {
    if (OWNER_ONLY_CRUD_SAVE_TYPES.has(type)) {
      return res.status(403).json({ status: 'error', message: `Akses ditolak. Kelola ${type} khusus untuk Pemilik.` });
    }
    if ((type === 'CUSTOMER' || type === 'EXPENSE') && isEdit) {
      return res.status(403).json({ status: 'error', message: `Akses ditolak. Edit ${type} khusus untuk Pemilik.` });
    }
  }
  return next();
}

// ============================================================================
// 1. ENDPOINT REST STANDAR
// ============================================================================

// Login (Password atau PIN) -> mengembalikan { status, user, token }
router.post('/auth/login', async (req, res, next) => {
  try {
    const result = await authenticateUserV91(req.body);
    return res.status(result.status === 'success' ? 200 : 401).json(result);
  } catch (err) {
    return next(err);
  }
});

// Bootstrap 15 tabel (opsional auth: jika Pemilik login, data privacy & HPP ikut dimuat)
router.get('/bootstrap', optionalAuth, async (req, res, next) => {
  try {
    const result = await getAppBootstrapDataV91(req.user || null);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// Sync Master Penuh (Khusus Pemilik)
router.post('/sync/master', requireAuth, requireOwner, async (req, res, next) => {
  try {
    const result = await syncFullMasterToSheetV91({
      ...req.body,
      username: req.user.username
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// Query Paginated Server-Side
router.post('/query/paginated', requireAuth, async (req, res, next) => {
  try {
    const result = await querySheetPaginatedV91(req.body);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// Simpan Transaksi POS Atomik (Potong Stok + No Nota Sekuensial + Log PG)
router.post('/transactions', requireAuth, async (req, res, next) => {
  try {
    const result = await savePosTransactionV91({
      ...req.body,
      username: req.user.username
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// CRUD Universal Save (12 Tipe)
router.post('/crud/save', requireAuth, checkCrudSavePermission, async (req, res, next) => {
  try {
    const result = await saveCrudRecordV91({
      ...req.body,
      username: req.user.username
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// CRUD Universal Delete + Stock Rollback (Khusus Pemilik)
router.post('/crud/delete', requireAuth, requireOwner, async (req, res, next) => {
  try {
    const result = await deleteCrudRecordV91({
      ...req.body,
      username: req.user.username
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// Simpan Pengaturan Aplikasi & Secret Keys (Khusus Pemilik)
router.post('/settings', requireAuth, requireOwner, async (req, res, next) => {
  try {
    const result = await saveAppSettingsV91({
      ...req.body,
      username: req.user.username
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// Setting Massal Stok (Khusus Pemilik)
router.post('/stock/bulk', requireAuth, requireOwner, async (req, res, next) => {
  try {
    const result = await updateBulkStockV91({
      ...req.body,
      username: req.user.username
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// Pengarsipan Transaksi & Buku Baru (Khusus Pemilik)
router.post('/archives', requireAuth, requireOwner, async (req, res, next) => {
  try {
    const result = await archiveTransactionsV91({
      ...req.body,
      username: req.user.username
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// Verifikasi Login SMTP Email (Khusus Pemilik)
router.post('/email/verify', requireAuth, requireOwner, async (req, res, next) => {
  try {
    const result = await verifyAndLoginEmailV91({
      ...req.body,
      username: req.user.username
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// Kirim Nota Digital via Email
router.post('/email/send-receipt', requireAuth, async (req, res, next) => {
  try {
    const result = await sendDigitalReceiptEmailV91(req.body);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// Kirim Nota Digital via WhatsApp Gateway
router.post('/whatsapp/send-auto', requireAuth, async (req, res, next) => {
  try {
    const result = await sendWhatsAppAutoV91(req.body);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// Webhook Payment Gateway (Midtrans / Xendit / Tripay / Duitku — Publik untuk callback server PG)
router.post('/webhook/payment-gateway', async (req, res, next) => {
  try {
    const result = await handlePaymentGatewayWebhook(req.body);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// ============================================================================
// 2. COMPATIBILITY RPC DISPATCHER (/api/rpc/:funcName)
//    Memungkinkan frontend index.html mengganti google.script.run secara 1:1
// ============================================================================
router.post('/rpc/:funcName', optionalAuth, async (req, res, next) => {
  try {
    const { funcName } = req.params;
    const payload = req.body || {};

    if (funcName === 'authenticateUserV91') {
      const result = await authenticateUserV91(payload);
      return res.status(result.status === 'success' ? 200 : 401).json(result);
    }

    if (funcName === 'getAppBootstrapDataV91') {
      const result = await getAppBootstrapDataV91(req.user || null);
      return res.json(result);
    }

    // Semua fungsi mutasi/query lain wajib autentikasi JWT
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Sesi login diperlukan untuk menjalankan aksi ini.' });
    }

    const isOwner = req.user.role === 'Pemilik' || req.user.role === 'Administrator';
    const ownerOnlyFuncs = new Set([
      'syncFullMasterToSheetV91',
      'deleteCrudRecordV91',
      'saveAppSettingsV91',
      'updateBulkStockV91',
      'archiveTransactionsV91',
      'verifyAndLoginEmailV91'
    ]);

    if (ownerOnlyFuncs.has(funcName) && !isOwner) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak. Fitur ini khusus untuk Pemilik.' });
    }

    const enrichedPayload = { ...payload, username: req.user.username };

    switch (funcName) {
      case 'syncFullMasterToSheetV91':
        return res.json(await syncFullMasterToSheetV91(enrichedPayload));
      case 'querySheetPaginatedV91':
        return res.json(await querySheetPaginatedV91(enrichedPayload));
      case 'savePosTransactionV91':
        return res.json(await savePosTransactionV91(enrichedPayload));
      case 'saveCrudRecordV91':
        return checkCrudSavePermission(req, res, async () => {
          return res.json(await saveCrudRecordV91(enrichedPayload));
        });
      case 'deleteCrudRecordV91':
        return res.json(await deleteCrudRecordV91(enrichedPayload));
      case 'saveAppSettingsV91':
        return res.json(await saveAppSettingsV91(enrichedPayload));
      case 'updateBulkStockV91':
        return res.json(await updateBulkStockV91(enrichedPayload));
      case 'archiveTransactionsV91':
        return res.json(await archiveTransactionsV91(enrichedPayload));
      case 'verifyAndLoginEmailV91':
        return res.json(await verifyAndLoginEmailV91(enrichedPayload));
      case 'sendDigitalReceiptEmailV91':
        return res.json(await sendDigitalReceiptEmailV91(enrichedPayload));
      case 'sendWhatsAppAutoV91':
        return res.json(await sendWhatsAppAutoV91(enrichedPayload));
      default:
        return res.status(404).json({ status: 'error', message: `Fungsi RPC tidak ditemukan: ${funcName}` });
    }
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

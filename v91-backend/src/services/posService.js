const { supabase } = require('../config/supabase');
const { appendActivityLog } = require('../utils/activityLogger');

/**
 * 5. SIMPAN TRANSAKSI PENJUALAN BARU & LOG PAYMENT GATEWAY (ATOMIC RPC)
 * (Setara savePosTransactionV91 di code.gs)
 */
async function savePosTransactionV91(payload) {
  const { data, error } = await supabase.rpc('rpc_save_pos_transaction', {
    p_payload: payload || {}
  });
  if (error) {
    return { status: 'error', message: error.message };
  }
  return data;
}

/**
 * 7. SETTING MASSAL STOK (DENGAN STOK / TANPA STOK + SET/ADD MASSAL)
 * (Setara updateBulkStockV91 di code.gs)
 */
async function updateBulkStockV91(payload) {
  const { data, error } = await supabase.rpc('rpc_bulk_update_stock', {
    p_stock_mode: String((payload && payload.stockMode) || 'WITH_STOCK'),
    p_target_category: String((payload && payload.targetCategory) || 'ALL'),
    p_action_type: String((payload && payload.actionType) || 'NONE'),
    p_value_ml: Math.max(0, Number((payload && payload.valueMl) || 0)),
    p_username: String((payload && payload.username) || 'prassetiosh')
  });
  if (error) {
    return { status: 'error', message: error.message };
  }
  return data;
}

/**
 * 8. PENGARSIPAN TRANSAKSI KE ARCHIVES & RESET BUKU BARU (KHUSUS PEMILIK)
 * (Setara archiveTransactionsV91 di code.gs)
 */
async function archiveTransactionsV91(payload) {
  const { data, error } = await supabase.rpc('rpc_archive_transactions', {
    p_period_label: String((payload && payload.periodLabel) || 'Arsip Periode Berjalan'),
    p_username: String((payload && payload.username) || 'prassetiosh')
  });
  if (error) {
    return { status: 'error', message: error.message };
  }
  return data;
}

/**
 * WEBHOOK ENDPOINT OTOMATIS (Midtrans / Xendit / Tripay / Duitku)
 * (Setara doPost di code.gs)
 */
async function handlePaymentGatewayWebhook(data) {
  const orderId = String(
    (data && (data.order_id || data.external_id || data.merchant_ref || data.noNota)) || ''
  ).trim();
  const rawStatus = String((data && (data.transaction_status || data.status)) || 'SETTLED').toUpperCase();

  const settledStatus =
    ['SETTLEMENT', 'CAPTURE', 'PAID', 'SUCCEEDED', 'SETTLED'].includes(rawStatus)
      ? 'SETTLED'
      : ['EXPIRE', 'CANCEL', 'DENY', 'FAILED'].includes(rawStatus)
      ? 'FAILED'
      : 'PENDING';

  if (orderId) {
    await supabase
      .from('payment_gateway_logs')
      .update({ status: settledStatus })
      .or(`no_nota.eq.${orderId},id_pg.eq.${orderId}`);

    await supabase
      .from('transactions')
      .update({ pg_status: settledStatus })
      .or(`no_nota.eq.${orderId},pg_id.eq.${orderId}`);

    await appendActivityLog(
      'PG_WEBHOOK_UPDATE',
      'WEBHOOK',
      orderId,
      `Status Payment Gateway diperbarui otomatis: ${settledStatus}`
    );
  }

  return { status: 'ok', orderId, settledStatus };
}

module.exports = {
  savePosTransactionV91,
  updateBulkStockV91,
  archiveTransactionsV91,
  handlePaymentGatewayWebhook
};

const { supabase } = require('../config/supabase');

/**
 * Pencatatan Log Aktivitas ke tabel activity_logs (Setara appendActivityLog_ di code.gs)
 */
async function appendActivityLog(aksi, username, kodeProduk, detail) {
  try {
    await supabase.rpc('internal_append_log', {
      p_aksi: String(aksi || 'SYSTEM_EVENT'),
      p_username: String(username || 'SYSTEM'),
      p_kode_produk: String(kodeProduk || '-'),
      p_detail: String(detail || '')
    });
  } catch (err) {
    console.error('[activityLogger] Gagal mencatat log:', err.message);
  }
}

module.exports = { appendActivityLog };

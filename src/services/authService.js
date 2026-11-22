const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');
const { appendActivityLog } = require('../utils/activityLogger');
const { signUserToken } = require('../middleware/auth');

/**
 * Memverifikasi password atau PIN terhadap hash bcrypt (atau fallback plaintext saat migrasi)
 */
async function verifySecret(input, stored) {
  if (!stored || !input) return false;
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    return bcrypt.compare(input, stored);
  }
  return stored === input;
}

/**
 * 1. AUTENTIKASI LOGIN PENGGUNA SERVER-SIDE (Setara authenticateUserV91 di code.gs)
 */
async function authenticateUserV91(payload) {
  const uname = String((payload && payload.username) || '').trim().toLowerCase();
  const pass = String((payload && payload.password) || '').trim();

  if (!uname || !pass) {
    return { status: 'error', message: 'Username dan Password/PIN wajib diisi.' };
  }

  const { data: users, error } = await supabase
    .from('admin_users')
    .select('username, password_hash, pin_hash, role, nama_lengkap');

  if (error) {
    return { status: 'error', message: 'Gagal memproses login: ' + error.message };
  }

  const matched = (users || []).find(
    (u) => String(u.username || '').trim().toLowerCase() === uname
  );

  if (!matched) {
    return { status: 'error', message: 'Username atau Password/PIN tidak sesuai.' };
  }

  const passOk = await verifySecret(pass, matched.password_hash);
  const pinOk = matched.pin_hash ? await verifySecret(pass, matched.pin_hash) : false;

  if (!passOk && !pinOk) {
    return { status: 'error', message: 'Username atau Password/PIN tidak sesuai.' };
  }

  const normalizedRole =
    matched.role === 'Administrator' || matched.role === 'Pemilik' ? 'Pemilik' : 'Kasir';

  const user = {
    username: matched.username,
    role: normalizedRole,
    namaLengkap: matched.nama_lengkap || matched.username
  };

  await appendActivityLog('USER_LOGIN', uname, '-', `${matched.role} (${user.namaLengkap}) berhasil login`);

  const token = signUserToken(user);
  return {
    status: 'success',
    user,
    token
  };
}

module.exports = { authenticateUserV91 };

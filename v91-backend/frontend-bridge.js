/**
 * ============================================================================
 * FILE: frontend-bridge.js
 * FUNGSI: Pengganti drop-in untuk fungsi callGasBackend() & handleLoginSubmit()
 *         di index.html agar langsung terhubung ke Backend Node.js + Supabase
 *         tanpa mengubah alur UI maupun logika kasir sedikit pun.
 * ============================================================================
 */

const V91_API_BASE = window.V91_API_BASE || '/api';
const V91_TOKEN_KEY = 'v91_kasirparfum_jwt_token';

function getAuthToken() {
  return sessionStorage.getItem(V91_TOKEN_KEY) || '';
}

function setAuthToken(token) {
  if (token) sessionStorage.setItem(V91_TOKEN_KEY, token);
  else sessionStorage.removeItem(V91_TOKEN_KEY);
}

/**
 * Ganti fungsi callGasBackend(funcName, payload, onSuccess, onError) di index.html dengan fungsi ini
 */
function callGasBackend(funcName, payload, onSuccess, onError) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  fetch(V91_API_BASE + '/rpc/' + encodeURIComponent(funcName), {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload || {})
  })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (funcName === 'authenticateUserV91' && data && data.status === 'success' && data.token) {
        setAuthToken(data.token);
      }
      if (typeof onSuccess === 'function') onSuccess(data);
    })
    .catch(function (err) {
      if (typeof onError === 'function') onError(err);
    });
}

/**
 * Catatan integrasi di index.html:
 * 1. Pada handleLoginSubmit(): panggil langsung callGasBackend('authenticateUserV91', { username: u, password: p }, ...)
 *    lalu setelah sukses, panggil ulang initGasCloudBootstrap() agar data rahasia Pemilik (privacyData, suppliers, HPP) dimuat sesuai token JWT.
 * 2. Pada handleLogout(): panggil setAuthToken('') untuk menghapus token sesi.
 * 3. Pada initGasCloudBootstrap() & syncMasterDataWithCloud(): hapus pengecekan `typeof google === 'undefined' || !google.script`
 *    agar selalu berkomunikasi dengan backend Node.js + Supabase.
 */

const { supabase } = require('../config/supabase');
const { getNowJakarta } = require('../utils/dateHelper');
const { appendActivityLog } = require('../utils/activityLogger');

/**
 * Helper baca rahasia dari app_config (pengganti getSecretProp_ PropertiesService GAS)
 */
async function getSecretConfig(key) {
  const { data } = await supabase
    .from('app_config')
    .select('config_value')
    .eq('config_key', key)
    .maybeSingle();
  return (data && data.config_value) || '';
}

/**
 * 6C. SIMPAN PENGATURAN KE APP_CONFIG & PISAHKAN SECRET KEY
 * (Setara saveAppSettingsV91 di code.gs)
 */
async function saveAppSettingsV91(payload) {
  const settings = (payload && payload.settings) || {};
  const integ = settings.integration || {};
  const pg = settings.paymentGateway || {};
  const nowStr = getNowJakarta();

  const publicRows = [
    ['STOCK_MODE', String(settings.stockMode || 'WITH_STOCK')],
    ['DEFAULT_THEME', String(settings.theme || 'light')],
    ['APP_NAME', String(settings.appName || 'v91.kasirparfum')],
    ['STORE_NAME', String(settings.storeName || 'WISATA PARFUM')],
    ['STORE_ADDRESS', String(settings.storeAddress || '')],
    ['RECEIPT_FOOTER', String(settings.receiptFooter || '')],
    ['WA_PHONE', String(settings.waPhone || '085692009910')],
    ['WA_GREETING', String(settings.waGreeting || '')],
    ['WA_TEMPLATE', String(settings.waTemplate || '')],
    ['WA_CLOSING', String(settings.waClosing || '')],
    ['EMAIL_SENDER', String(settings.emailSender || 'wisataparfum10@gmail.com')],
    ['EMAIL_SUBJECT', String(settings.emailSubject || '')],
    ['EMAIL_TEMPLATE', String(settings.emailTemplate || '')],
    ['EMAIL_AUTH_STATUS', integ.emailLoggedIn ? 'CONNECTED' : 'DISCONNECTED'],
    ['EMAIL_AUTH_MODE', String(integ.emailAuthMode || 'GAS_NATIVE')],
    ['AUTO_SEND_EMAIL_POS', integ.autoSendEmailOnSave ? 'TRUE' : 'FALSE'],
    ['AUTO_CC_OWNER_EMAIL', integ.autoCcOwnerEmail ? 'TRUE' : 'FALSE'],
    ['WA_WEB_STATUS', integ.waLinked ? 'LINKED' : 'UNLINKED'],
    ['WA_GATEWAY_URL', String(integ.waGatewayUrl || '')],
    ['AUTO_SEND_WA_POS', integ.autoSendWaOnSave ? 'TRUE' : 'FALSE'],
    ['PG_PROVIDER_MODE', String(pg.providerMode || 'STANDALONE_QRIS')],
    ['PG_MERCHANT_NAME', String(pg.merchantName || 'WISATA PARFUM')],
    ['PG_NMID', String(pg.nmid || 'ID1026000091910')],
    ['PG_STATIC_QRIS', String(pg.staticQrisPayload || '')],
    ['PG_BANK_ACCOUNTS', String(pg.bankAccounts || '')],
    ['PG_EWALLET_ACCOUNT', String(pg.ewalletAccount || '085692009910')],
    ['PG_MDR_PCT', String(pg.mdrPct !== undefined ? pg.mdrPct : 0.7)],
    ['PG_UNIQUE_CODE', pg.useUniqueCode ? 'TRUE' : 'FALSE'],
    ['PG_API_MERCHANT_ID', String(pg.apiMerchantId || '')],
    ['PG_API_CLIENT_KEY', String(pg.apiClientKey || '')]
  ].map(([config_key, config_value]) => ({
    config_key,
    config_value,
    is_secret: false,
    updated_at: nowStr
  }));

  // Secret keys disimpan dengan is_secret = true agar tidak pernah bocor di bootstrap
  const secretPairs = [
    ['PG_API_SERVER_KEY', pg.apiServerKey],
    ['WA_GATEWAY_TOKEN', integ.waGatewayToken]
  ];

  for (const [key, val] of secretPairs) {
    const cleanVal = String(val || '').trim();
    if (cleanVal !== '' && cleanVal !== '********' && cleanVal !== 'STORED_IN_PROPERTIES') {
      publicRows.push({
        config_key: key,
        config_value: cleanVal,
        is_secret: true,
        updated_at: nowStr
      });
    }
  }

  const { error } = await supabase
    .from('app_config')
    .upsert(publicRows, { onConflict: 'config_key' });

  if (error) return { status: 'error', message: error.message };

  await appendActivityLog(
    'UPDATE_SETTINGS',
    (payload && payload.username) || 'prassetiosh',
    '-',
    'Memperbarui konfigurasi aplikasi, Payment Gateway & integrasi WA/Email'
  );

  return { status: 'success' };
}

module.exports = {
  getSecretConfig,
  saveAppSettingsV91
};

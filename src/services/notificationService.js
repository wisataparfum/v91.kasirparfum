const nodemailer = require('nodemailer');
const { getNowJakarta } = require('../utils/dateHelper');
const { appendActivityLog } = require('../utils/activityLogger');
const { getSecretConfig } = require('./settingsService');
const { supabase } = require('../config/supabase');

async function resolveSmtpCredentials(overrideEmail = '', overridePass = '') {
  const envHost = String(process.env.SMTP_HOST || '').trim();
  const envUser = String(process.env.SMTP_USER || '').trim();
  const envPass = String(process.env.SMTP_PASS || '').trim();

  const dbUser =
    (await getSecretConfig('EMAIL_SMTP_USER')) ||
    (await getSecretConfig('EMAIL_SENDER'));
  const dbPass = await getSecretConfig('EMAIL_SMTP_PASS');

  const cleanOverridePass =
    overridePass &&
    !['wp-oauth-v91-verified', 'oauth-session', '********'].includes(overridePass.trim())
      ? overridePass.trim()
      : '';

  const user = envUser || String(overrideEmail || '').trim() || String(dbUser || '').trim();
  const pass = envPass || cleanOverridePass || String(dbPass || '').trim();
  const host = envHost || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE ? String(process.env.SMTP_SECURE) === 'true' : port === 465;

  return { host, port, secure, user, pass };
}

function buildTransporter(creds) {
  if (!creds.host || !creds.user || !creds.pass) {
    return null;
  }
  return nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    auth: {
      user: creds.user,
      pass: creds.pass
    }
  });
}

/**
 * 9. LOGIN & VERIFIKASI OTORISASI EMAIL PENGIRIM OTOMATIS
 * (Setara verifyAndLoginEmailV91 di code.gs)
 */
async function verifyAndLoginEmailV91(payload) {
  const senderEmail = String(
    (payload && payload.email) || process.env.SMTP_USER || 'wisataparfum10@gmail.com'
  ).trim();
  const senderName = String(
    (payload && payload.senderName) || 'WISATA PARFUM (v91.kasirparfum)'
  ).trim();
  const authMode = String((payload && payload.authMode) || 'APP_PASSWORD');
  const rawPasskey = String((payload && payload.passkey) || '').trim();
  const nowStr = getNowJakarta();

  // Jika user memasukkan App Password baru dari UI, simpan aman ke app_config
  if (
    rawPasskey &&
    !['wp-oauth-v91-verified', 'oauth-session', '********'].includes(rawPasskey)
  ) {
    await supabase.from('app_config').upsert(
      [
        { config_key: 'EMAIL_SMTP_USER', config_value: senderEmail, is_secret: false, updated_at: nowStr },
        { config_key: 'EMAIL_SMTP_PASS', config_value: rawPasskey, is_secret: true, updated_at: nowStr }
      ],
      { onConflict: 'config_key' }
    );
  }

  const creds = await resolveSmtpCredentials(senderEmail, rawPasskey);
  const transporter = buildTransporter(creds);

  if (!transporter) {
    return {
      status: 'error',
      message:
        'Sandi Aplikasi Google (16 digit App Password) belum diisi. Masukkan App Password di kolom Sandi Aplikasi atau atur SMTP_PASS di Vercel Environment Variables.'
    };
  }

  try {
    await transporter.verify();
  } catch (err) {
    return {
      status: 'error',
      message: 'Verifikasi SMTP gagal: ' + (err && err.message ? err.message : String(err))
    };
  }

  await appendActivityLog(
    'EMAIL_AUTH_LOGIN',
    (payload && payload.username) || 'prassetiosh',
    senderEmail,
    `Otorisasi login pengiriman email otomatis aktif (${authMode})`
  );

  return {
    status: 'success',
    email: creds.user,
    senderName,
    remainingQuota: Number(process.env.EMAIL_DAILY_QUOTA) || 500,
    connectedAt: nowStr
  };
}

/**
 * 10. KIRIM NOTA DIGITAL VIA EMAIL OTOMATIS (Nodemailer SMTP)
 * (Setara sendDigitalReceiptEmailV91 di code.gs)
 */
async function sendDigitalReceiptEmailV91(payload) {
  const recipient = String((payload && payload.to) || '').trim();
  const ccOwner = String((payload && payload.cc) || '').trim();
  const subject = String((payload && payload.subject) || 'Nota Digital Pembelian - WISATA PARFUM');
  const body = String((payload && payload.body) || '');
  const senderName = String((payload && payload.senderName) || 'WISATA PARFUM (v91.kasirparfum)');
  const replyToAddr = String((payload && payload.replyTo) || '').trim();

  if (!recipient || !recipient.includes('@')) {
    return { status: 'error', message: 'Alamat email pelanggan belum diisi atau tidak valid.' };
  }

  const creds = await resolveSmtpCredentials();
  const transporter = buildTransporter(creds);

  if (!transporter) {
    return {
      status: 'error',
      message:
        'SMTP Email belum dikonfigurasi. Isi Sandi Aplikasi Google (16 digit App Password) di menu Panel Pemilik -> Login Email & Web WA, atau atur SMTP_USER & SMTP_PASS di Vercel.'
    };
  }

  const mailOpts = {
    from: `"${senderName}" <${creds.user}>`,
    to: recipient,
    replyTo: replyToAddr || creds.user,
    subject,
    text: body
  };
  if (ccOwner && ccOwner !== recipient && ccOwner.includes('@')) {
    mailOpts.cc = ccOwner;
  }

  try {
    await transporter.sendMail(mailOpts);
    await appendActivityLog(
      'SEND_EMAIL_NOTA',
      'SYSTEM',
      (payload && payload.noNota) || '-',
      `Kirim email nota digital otomatis ke ${recipient}`
    );

    return {
      status: 'success',
      message: `Nota digital berhasil dikirim otomatis ke ${recipient}`,
      remainingQuota: Number(process.env.EMAIL_DAILY_QUOTA) || 500
    };
  } catch (err) {
    const errMsg = err && err.message ? err.message : String(err);
    await appendActivityLog(
      'SEND_EMAIL_FAILED',
      'SYSTEM',
      (payload && payload.noNota) || '-',
      `Gagal kirim email ke ${recipient}: ${errMsg}`
    );
    return {
      status: 'error',
      message: 'Gagal mengirim email otomatis: ' + errMsg
    };
  }
}

/**
 * 11. KIRIM NOTA DIGITAL WHATSAPP OTOMATIS MELALUI GATEWAY / WEBHOOK
 * (Setara sendWhatsAppAutoV91 di code.gs)
 */
async function sendWhatsAppAutoV91(payload) {
  let targetPhone = String((payload && payload.phone) || '').replace(/\D/g, '');
  if (targetPhone.startsWith('0')) targetPhone = '62' + targetPhone.slice(1);
  else if (targetPhone.startsWith('8')) targetPhone = '62' + targetPhone;

  const message = String((payload && payload.message) || '');
  const gatewayUrl =
    String((payload && payload.gatewayUrl) || '').trim() ||
    (await getSecretConfig('WA_GATEWAY_URL'));
  const gatewayToken =
    String((payload && payload.gatewayToken) || '').trim() ||
    (await getSecretConfig('WA_GATEWAY_TOKEN'));

  if (!targetPhone || targetPhone.length < 9 || !message) {
    return { status: 'error', message: 'Nomor WhatsApp tujuan tidak valid atau pesan kosong.' };
  }

  if (gatewayUrl && (gatewayUrl.startsWith('https://') || gatewayUrl.startsWith('http://'))) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (gatewayToken) {
        headers.Authorization = gatewayToken;
      }

      const res = await fetch(gatewayUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          target: targetPhone,
          phone: targetPhone,
          message
        })
      });

      let resText = '';
      let resJson = null;
      try {
        resText = await res.text();
        resJson = JSON.parse(resText);
      } catch (_) {}

      const gatewayRejected =
        !res.ok ||
        (resJson && (resJson.status === false || resJson.success === false || resJson.error));

      if (gatewayRejected) {
        const reason =
          (resJson && (resJson.reason || resJson.message || resJson.error)) ||
          `HTTP ${res.status} ${resText.slice(0, 120)}`;
        await appendActivityLog(
          'SEND_WA_FAILED',
          'SYSTEM',
          (payload && payload.noNota) || '-',
          `Gagal kirim WA Gateway ke ${targetPhone}: ${reason}`
        );
        return {
          status: 'error',
          mode: 'API_GATEWAY',
          httpCode: res.status,
          message: `WhatsApp Gateway menolak pengiriman: ${reason}`
        };
      }

      await appendActivityLog(
        'SEND_WA_AUTO_API',
        'SYSTEM',
        (payload && payload.noNota) || '-',
        `Auto-Send WA Gateway ke ${targetPhone} (HTTP ${res.status})`
      );

      return {
        status: 'success',
        mode: 'API_GATEWAY',
        httpCode: res.status,
        phone: targetPhone
      };
    } catch (err) {
      const errMsg = err && err.message ? err.message : String(err);
      return {
        status: 'error',
        mode: 'API_GATEWAY',
        message: `Gagal menghubungi WhatsApp Gateway: ${errMsg}`
      };
    }
  }

  await appendActivityLog(
    'SEND_WA_WEB_SYNC',
    'SYSTEM',
    (payload && payload.noNota) || '-',
    `Kirim Nota WA via wa.me / Web ke ${targetPhone}`
  );

  return {
    status: 'success',
    mode: 'WA_WEB_SESSION',
    phone: targetPhone,
    waUrl: `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`
  };
}

module.exports = {
  verifyAndLoginEmailV91,
  sendDigitalReceiptEmailV91,
  sendWhatsAppAutoV91
};

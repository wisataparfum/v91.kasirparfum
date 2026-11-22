const nodemailer = require('nodemailer');
const { getNowJakarta } = require('../utils/dateHelper');
const { appendActivityLog } = require('../utils/activityLogger');
const { getSecretConfig } = require('./settingsService');

function createSmtpTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

/**
 * 9. LOGIN & VERIFIKASI OTORISASI EMAIL PENGIRIM OTOMATIS
 * (Setara verifyAndLoginEmailV91 di code.gs)
 */
async function verifyAndLoginEmailV91(payload) {
  const senderEmail = String((payload && payload.email) || process.env.SMTP_USER || 'wisataparfum10@gmail.com').trim();
  const senderName = String((payload && payload.senderName) || 'WISATA PARFUM (v91.kasirparfum)').trim();
  const authMode = String((payload && payload.authMode) || 'SMTP_NODE');

  const transporter = createSmtpTransporter();
  if (transporter) {
    try {
      await transporter.verify();
    } catch (err) {
      return { status: 'error', message: 'Verifikasi SMTP gagal: ' + err.message };
    }
  }

  await appendActivityLog(
    'EMAIL_AUTH_LOGIN',
    (payload && payload.username) || 'prassetiosh',
    senderEmail,
    `Otorisasi login pengiriman email otomatis aktif (${authMode})`
  );

  return {
    status: 'success',
    email: senderEmail,
    senderName,
    remainingQuota: Number(process.env.EMAIL_DAILY_QUOTA) || 500,
    connectedAt: getNowJakarta()
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
  const replyToAddr = String((payload && payload.replyTo) || process.env.SMTP_USER || 'wisataparfum10@gmail.com');

  if (!recipient) {
    return { status: 'error', message: 'Alamat email pelanggan belum diisi.' };
  }

  const transporter = createSmtpTransporter();
  if (!transporter) {
    return {
      status: 'error',
      message: 'Konfigurasi SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS) belum diisi di server .env.'
    };
  }

  const mailOpts = {
    from: `"${senderName}" <${process.env.SMTP_USER}>`,
    to: recipient,
    replyTo: replyToAddr,
    subject,
    text: body
  };
  if (ccOwner && ccOwner !== recipient) {
    mailOpts.cc = ccOwner;
  }

  await transporter.sendMail(mailOpts);
  await appendActivityLog('SEND_EMAIL_NOTA', 'SYSTEM', (payload && payload.noNota) || '-', `Kirim email nota digital otomatis ke ${recipient}`);

  return {
    status: 'success',
    message: `Nota digital berhasil dikirim otomatis ke ${recipient}`,
    remainingQuota: Number(process.env.EMAIL_DAILY_QUOTA) || 500
  };
}

/**
 * 11. KIRIM NOTA DIGITAL WHATSAPP OTOMATIS MELALUI GATEWAY / WEBHOOK
 * (Setara sendWhatsAppAutoV91 di code.gs)
 */
async function sendWhatsAppAutoV91(payload) {
  let targetPhone = String((payload && payload.phone) || '').replace(/\D/g, '');
  if (targetPhone.startsWith('0')) targetPhone = '62' + targetPhone.slice(1);
  const message = String((payload && payload.message) || '');
  const gatewayUrl = String((payload && payload.gatewayUrl) || '').trim();
  const gatewayToken =
    String((payload && payload.gatewayToken) || '').trim() ||
    (await getSecretConfig('WA_GATEWAY_TOKEN'));

  if (!targetPhone || !message) {
    return { status: 'error', message: 'Nomor tujuan atau pesan WhatsApp kosong.' };
  }

  if (gatewayUrl && gatewayUrl.startsWith('https://')) {
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
  }

  await appendActivityLog(
    'SEND_WA_WEB_SYNC',
    'SYSTEM',
    (payload && payload.noNota) || '-',
    `Antrean Auto-Send WA Web ke ${targetPhone}`
  );

  return {
    status: 'success',
    mode: 'WA_WEB_SESSION',
    phone: targetPhone
  };
}

module.exports = {
  verifyAndLoginEmailV91,
  sendDigitalReceiptEmailV91,
  sendWhatsAppAutoV91
};

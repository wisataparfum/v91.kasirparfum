require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(
  helmet({
    contentSecurityPolicy: false // Mengizinkan CDN Chart.js, XLSX, QRCodejs & Google Fonts jika index.html disajikan langsung
  })
);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN === '*' ? true : (process.env.CORS_ORIGIN || '').split(','),
    credentials: true
  })
);
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Health Check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'v91.kasirparfum-backend', timestamp: new Date().toISOString() });
});

// Mount API routes
app.use('/api', apiRoutes);

// Opsional: Sajikan file frontend index.html jika diletakkan di folder /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// Global Error Handler
app.use((err, _req, res, _next) => {
  console.error('[ServerError]', err);
  res.status(500).json({
    status: 'error',
    message: err && err.message ? err.message : 'Terjadi kesalahan internal pada server.'
  });
});

app.listen(PORT, () => {
  console.log(`[v91.kasirparfum] Backend Node.js berjalan di http://localhost:${PORT}`);
});

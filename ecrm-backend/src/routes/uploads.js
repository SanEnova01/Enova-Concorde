const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { verificarToken } = require('../middleware/auth');

// Logos de tiendas. La carpeta está montada como volumen en Railway (/app/src/public/assets).
// Se monta en la raíz (index.js): sirve /assets y recibe /api/upload y /upload.

// ==========================================
// CREACIÓN AUTOMÁTICA DE CARPETAS Y MULTER
// ==========================================
const uploadDirectory = path.join(__dirname, '..', 'public', 'assets');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}
router.use('/assets', express.static(uploadDirectory));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDirectory),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Solo se admiten formatos de imagen (JPG, PNG, WEBP).'));
  }
});

router.post(['/api/upload', '/upload'], verificarToken, upload.single('logo'), (req, res) => {
  try {
    const fileUrl = `/assets/${req.file.filename}`;
    res.status(200).json({ success: true, url: fileUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al procesar la imagen.' });
  }
});

module.exports = router;

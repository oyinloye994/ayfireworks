const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'images');
const ROOT_IMAGES_DIR = path.join(__dirname, 'images');

// Ensure necessary directories exist
[DATA_DIR, PUBLIC_DIR, UPLOADS_DIR, ROOT_IMAGES_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Generate clean safe filename: timestamp-sanitizedname.ext
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e4);
    const filename = `${base || 'product'}-${uniqueSuffix}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /\.(jpg|jpeg|png|webp|gif|svg)$/i;
  if (!allowed.test(path.extname(file.originalname))) {
    return cb(new Error('Only image files (JPG, PNG, WEBP, GIF, SVG) are allowed!'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter,
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets
app.use('/images', express.static(UPLOADS_DIR));
app.use('/images', express.static(ROOT_IMAGES_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(PUBLIC_DIR));
app.use(express.static(__dirname)); // Fallback for root files

// Helper: copy uploaded image to root images/ as well for offline file:// support
function mirrorImageToRoot(filename) {
  try {
    const src = path.join(UPLOADS_DIR, filename);
    const dest = path.join(ROOT_IMAGES_DIR, filename);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  } catch (err) {
    console.warn('Could not mirror image to root images directory:', err.message);
  }
}

// Helper: Read products
function readProducts() {
  if (!fs.existsSync(PRODUCTS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading products.json:', err);
    return [];
  }
}

// Helper: Save products
function writeProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');

  // Sync fallback array to HTML files so offline/file:// usage always shows the latest images
  try {
    const compact = products.map((p) => ({
      id: p.id,
      name: p.name,
      cat: p.cat,
      status: p.status,
      image: p.image || '',
    }));
    const fallbackBlock = `/* Fallback default products if offline or backend is unreachable */\nconst DEFAULT_PRODUCTS = ${JSON.stringify(compact, null, 2)};`;

    [
      path.join(PUBLIC_DIR, 'index.html'),
      path.join(__dirname, 'index.html'),
      path.join(__dirname, 'index (1).html'),
    ].forEach((filePath) => {
      if (fs.existsSync(filePath)) {
        let html = fs.readFileSync(filePath, 'utf-8');
        html = html.replace(
          /\/\* Fallback default products if offline or backend is unreachable \*\/[\s\S]*?const DEFAULT_PRODUCTS = \[[\s\S]*?\];/,
          fallbackBlock
        );
        fs.writeFileSync(filePath, html, 'utf-8');
      }
    });
  } catch (err) {
    console.warn('Could not sync HTML fallback products:', err.message);
  }
}

// Helper: Slugify ID
function makeId(name) {
  const slug = (name || 'product')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${slug}-${Date.now().toString().slice(-4)}`;
}

/* =====================================================
   AUTHENTICATION & SECURITY
===================================================== */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'oyinloye994@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Emaxbaba112.';
const AUTH_SECRET = 'ay-fireworks-auth-secret-key-2026';

function createToken(email) {
  const payload = {
    email,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days valid
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  if (signature !== expectedSignature) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Please login to continue.' });
  }
  req.user = payload;
  next();
}

/* =====================================================
   AUTH ROUTES
===================================================== */
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  const isEmailMatch = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isPassMatch = password === ADMIN_PASSWORD;

  if (!isEmailMatch || !isPassMatch) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }

  const token = createToken(ADMIN_EMAIL);
  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: { email: ADMIN_EMAIL },
  });
});

app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, authenticated: false });
  }
  res.json({ success: true, authenticated: true, user: { email: payload.email } });
});

/* =====================================================
   API ROUTES
===================================================== */

// 1. GET ALL PRODUCTS
app.get('/api/products', (req, res) => {
  const products = readProducts();
  const { cat, status, search } = req.query;
  let filtered = products;

  if (cat && cat !== 'All') {
    filtered = filtered.filter((p) => p.cat && p.cat.toLowerCase() === cat.toLowerCase());
  }
  if (status) {
    filtered = filtered.filter((p) => p.status === status);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.cat && p.cat.toLowerCase().includes(q))
    );
  }

  res.json({
    success: true,
    count: filtered.length,
    data: filtered,
  });
});

// 2. GET SINGLE PRODUCT
app.get('/api/products/:id', (req, res) => {
  const products = readProducts();
  const product = products.find((p) => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.json({ success: true, data: product });
});

// 3. GET CATEGORIES
app.get('/api/categories', (req, res) => {
  const products = readProducts();
  const categories = Array.from(new Set(products.map((p) => p.cat).filter(Boolean)));
  res.json({ success: true, data: categories });
});

// 4. CREATE NEW PRODUCT (Supports multipart/form-data with image OR json)
app.post('/api/products', requireAuth, upload.single('image'), (req, res) => {
  try {
    const { name, cat, status, price, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Product name is required' });
    }

    let imageName = '';
    if (req.file) {
      imageName = req.file.filename;
      mirrorImageToRoot(imageName);
    } else if (req.body.image) {
      imageName = req.body.image.trim();
    }

    const products = readProducts();
    const newProduct = {
      id: makeId(name),
      name: name.trim(),
      cat: (cat && cat.trim()) || 'Novelty and singles',
      status: ['ok', 'low', 'out'].includes(status) ? status : 'ok',
      image: imageName,
      price: price ? price.trim() : '',
      description: description ? description.trim() : '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add to top of list
    products.unshift(newProduct);
    writeProducts(products);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: newProduct,
    });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// 5. UPDATE PRODUCT DETAILS (Name, category, status, optional image)
app.put('/api/products/:id', requireAuth, upload.single('image'), (req, res) => {
  try {
    const products = readProducts();
    const index = products.findIndex((p) => p.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const current = products[index];
    const { name, cat, status, price, description } = req.body;

    let imageName = current.image;
    if (req.file) {
      imageName = req.file.filename;
      mirrorImageToRoot(imageName);
    } else if (req.body.image !== undefined && req.body.image !== '') {
      imageName = req.body.image.trim();
    }

    const updated = {
      ...current,
      name: name !== undefined ? name.trim() : current.name,
      cat: cat !== undefined ? cat.trim() : current.cat,
      status: ['ok', 'low', 'out'].includes(status) ? status : current.status,
      price: price !== undefined ? price.trim() : current.price,
      description: description !== undefined ? description.trim() : current.description,
      image: imageName,
      updatedAt: new Date().toISOString(),
    };

    products[index] = updated;
    writeProducts(products);

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: updated,
    });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// 6. UPLOAD / REPLACE IMAGE FOR A SPECIFIC PRODUCT
app.post('/api/products/:id/image', requireAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please choose an image file to upload' });
    }

    const products = readProducts();
    const index = products.findIndex((p) => p.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const filename = req.file.filename;
    mirrorImageToRoot(filename);

    products[index].image = filename;
    products[index].updatedAt = new Date().toISOString();
    writeProducts(products);

    res.json({
      success: true,
      message: 'Product image updated successfully',
      image: filename,
      imageUrl: `/images/${filename}`,
      data: products[index],
    });
  } catch (err) {
    console.error('Error uploading product image:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// 7. DELETE PRODUCT
app.delete('/api/products/:id', requireAuth, (req, res) => {
  try {
    const products = readProducts();
    const index = products.findIndex((p) => p.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const deleted = products.splice(index, 1)[0];
    writeProducts(products);

    res.json({
      success: true,
      message: `Product "${deleted.name}" deleted successfully`,
      data: deleted,
    });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

/* =====================================================
   ADMIN & STOREFRONT ROUTES
===================================================== */
app.get('/admin', (req, res) => {
  const adminFile = path.join(PUBLIC_DIR, 'admin.html');
  if (fs.existsSync(adminFile)) {
    res.sendFile(adminFile);
  } else {
    res.status(404).send('Admin page not found');
  }
});

app.get('/download-logo', (req, res) => {
  const logoPath = path.join(PUBLIC_DIR, 'images', 'logo.jpg');
  if (fs.existsSync(logoPath)) {
    return res.download(logoPath, 'ay-fireworks-logo.jpg');
  }
  res.status(404).send('Logo file not found');
});

app.get('/', (req, res) => {
  const indexPublic = path.join(PUBLIC_DIR, 'index.html');
  const indexRoot = path.join(__dirname, 'index.html');
  const indexOld = path.join(__dirname, 'index (1).html');

  if (fs.existsSync(indexPublic)) {
    return res.sendFile(indexPublic);
  }
  if (fs.existsSync(indexRoot)) {
    return res.sendFile(indexRoot);
  }
  if (fs.existsSync(indexOld)) {
    return res.sendFile(indexOld);
  }
  res.send('Storefront index file not found');
});

// Multer error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  next();
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`💥 AY FIREWORKS BACKEND RUNNING!`);
  console.log(`📍 Storefront:   http://localhost:${PORT}`);
  console.log(`⚙️  Admin Panel:  http://localhost:${PORT}/admin`);
  console.log(`📦 Products API: http://localhost:${PORT}/api/products`);
  console.log(`==================================================\n`);
});

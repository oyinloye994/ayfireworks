# 💥 Ay Fireworks And Events — Backend & Admin Manager

A modern backend and management system for **Ay Fireworks And Events**, enabling live image uploads, product creation, catalog management, and seamless WhatsApp ordering.

---

## 🚀 Quick Start

### 1. Start the Server
In this folder, open PowerShell or terminal and run:
```bash
npm start
```
*(Or during development with auto-reload: `npm run dev`)*

### 2. Open in your browser:
- 🛒 **Storefront (Customer Website):** [http://localhost:3000](http://localhost:3000)
- ⚙️ **Admin Dashboard (Product & Image Manager):** [http://localhost:3000/admin](http://localhost:3000/admin)

### 🔐 Admin Login Credentials:
- **Email:** `oyinloye994@gmail.com`
- **Password:** `Emaxbaba112.`

---

## 📸 How to Upload Images & Add Products

### Option A: Upload / Replace Picture for an Existing Product
1. Open [http://localhost:3000/admin](http://localhost:3000/admin).
2. Hover over any product card in the catalog (or tap the **📷 Pic** button).
3. Select your image file (`.jpg`, `.png`, `.webp`, `.gif`).
4. The image is uploaded immediately, saved into `public/images/`, and shown live across both the Admin Panel and the customer Storefront!

### Option B: Add a Brand-New Product (Picture + Name + Category + Status)
1. On the left side of the Admin Panel, fill out:
   - **Product Name** *(e.g., "50 Shot Golden Willow")*
   - **Category** *(select existing like "Cakes", "Display shots", or type a new custom category)*
   - **Stock Status** *("Available", "Few left", or "Sold out")*
   - **Product Image** *(drag & drop or click to choose from your computer or phone)*
2. Click **➕ Add Product to Catalog**.
3. It appears instantly at the top of the catalogue on the website!

### Option C: Edit Existing Product Details
1. Click **✏️ Edit** on any product card.
2. Update the name, category, or status.
3. Optionally select a new image to replace the current one.
4. Click **Save Changes**.

---

## 🗄️ Project Structure

```
AY FIREWORKS/
├── data/
│   └── products.json          # Persistent JSON database of all products
├── public/
│   ├── index.html             # Storefront with dynamic API loader & offline fallback
│   ├── admin.html             # Full Admin Dashboard (Image Uploader + Product Manager)
│   └── images/                # Storage directory for uploaded product photos
├── images/                    # Mirrored folder for offline/file:// protocol support
├── server.js                  # Express.js REST API & static file server
├── package.json               # Dependencies (express, multer, cors)
├── test_backend.js            # Automated test suite
└── README.md                  # Documentation
```

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products` | Retrieve all products (supports `?cat=`, `?status=`, `?search=`) |
| `GET` | `/api/products/:id` | Get details for a single product |
| `POST` | `/api/products` | Add new product (supports multipart/form-data with image) |
| `PUT` | `/api/products/:id` | Update product name, category, status, or image |
| `POST` | `/api/products/:id/image` | Upload / replace image for an existing product |
| `DELETE` | `/api/products/:id` | Delete product from catalog |
| `GET` | `/api/categories` | Retrieve list of all unique product categories |

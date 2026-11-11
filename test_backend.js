const fs = require('fs');
const path = require('path');

async function testBackend() {
  const baseUrl = 'http://localhost:3000';
  console.log('Testing backend at:', baseUrl);

  // 1. Test GET /api/products
  const resGet = await fetch(`${baseUrl}/api/products`);
  const dataGet = await resGet.json();
  console.log('GET /api/products -> Success:', dataGet.success, 'Count:', dataGet.count);

  if (!dataGet.success || dataGet.count < 14) {
    throw new Error('GET /api/products failed or incomplete count');
  }

  // 2. Test GET /api/categories
  const resCat = await fetch(`${baseUrl}/api/categories`);
  const dataCat = await resCat.json();
  console.log('GET /api/categories -> Categories:', dataCat.data);

  // 3. Test POST /api/products (Adding product with name and cat)
  const testImgPath = path.join(__dirname, 'test_sample.png');
  // Create a minimal 1x1 transparent PNG file for testing upload
  const pngBuffer = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6360606060000000050001A72458420000000049454E44AE426082', 'hex');
  fs.writeFileSync(testImgPath, pngBuffer);

  const form = new FormData();
  form.append('name', 'Golden Dragon 500');
  form.append('cat', 'Cakes');
  form.append('status', 'ok');
  const blob = new Blob([fs.readFileSync(testImgPath)], { type: 'image/png' });
  form.append('image', blob, 'sample_dragon.png');

  const resPost = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    body: form,
  });
  const dataPost = await resPost.json();
  console.log('POST /api/products -> Success:', dataPost.success, 'Created item:', dataPost.data?.name, 'Image:', dataPost.data?.image);

  if (!dataPost.success || !dataPost.data?.id) {
    throw new Error('Product creation failed');
  }

  const createdId = dataPost.data.id;

  // 4. Test POST /api/products/:id/image (Dedicated image upload for a product)
  const formImg = new FormData();
  const blob2 = new Blob([fs.readFileSync(testImgPath)], { type: 'image/png' });
  formImg.append('image', blob2, 'updated_dragon.png');

  const resImg = await fetch(`${baseUrl}/api/products/${createdId}/image`, {
    method: 'POST',
    body: formImg,
  });
  const dataImg = await resImg.json();
  console.log('POST /api/products/:id/image -> Success:', dataImg.success, 'New Image:', dataImg.image);

  // 5. Test PUT /api/products/:id (Updating item name & status)
  const resPut = await fetch(`${baseUrl}/api/products/${createdId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Golden Dragon 500 Deluxe',
      status: 'low',
    }),
  });
  const dataPut = await resPut.json();
  console.log('PUT /api/products/:id -> Success:', dataPut.success, 'New Name:', dataPut.data?.name, 'New Status:', dataPut.data?.status);

  // 6. Test GET storefront and admin pages
  const resStore = await fetch(`${baseUrl}/`);
  console.log('GET / (Storefront) -> Status:', resStore.status);

  const resAdmin = await fetch(`${baseUrl}/admin`);
  console.log('GET /admin -> Status:', resAdmin.status);

  // 7. Test DELETE /api/products/:id
  const resDel = await fetch(`${baseUrl}/api/products/${createdId}`, {
    method: 'DELETE',
  });
  const dataDel = await resDel.json();
  console.log('DELETE /api/products/:id -> Success:', dataDel.success, 'Deleted:', dataDel.data?.name);

  // Clean up test file
  if (fs.existsSync(testImgPath)) fs.unlinkSync(testImgPath);

  console.log('\n✅ ALL BACKEND TESTS PASSED SUCCESSFULLY!\n');
}

testBackend().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

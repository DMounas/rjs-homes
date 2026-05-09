/* ============================================
   RJS FURNITURE SHOP — Core Engine
   Fully connected to Supabase backend
   ============================================ */

import {
  getCurrentUser,
  getCurrentProfile,
  signIn,
  signUpCustomer,
  signOut,
  getProducts,
  getCategories,
  getProductById,
  placeOrder,
  getMyOrders,
  subscribeToMyOrders,
} from './supabase.js';

// ── SHOP STATE ──
const SHOP = {
  currentPage: 'shop-home',
  shopUser: null,
  shopProfile: null,
  cart: JSON.parse(localStorage.getItem('rjs_shop_cart')) || [],
  wishlist: JSON.parse(localStorage.getItem('rjs_shop_wishlist')) || [],
  orders: [],
  categories: [],
  products: [],
  activeCategory: 'All',
  editingProductId: null,
  unsubOrders: null,
};

// ── HELPERS ──
function formatPrice(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

function shopToast(icon, msg) {
  const t = document.getElementById('s-toast');
  if (!t) return;
  t.querySelector('.s-toast-icon').textContent = icon;
  t.querySelector('.s-toast-text').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function setLoading(gridId, show) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  if (show) {
    grid.innerHTML = `
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    `;
  }
}


// ============================================
// NAVIGATION
// ============================================
function navigateShop(page) {
  document.querySelectorAll('.shop-page').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });
  const target = document.getElementById('page-' + page);
  if (target) {
    target.style.display = 'block';
    void target.offsetWidth;
    target.classList.add('active');
  }
  SHOP.currentPage = page;
  window.scrollTo({ top: 0, behavior: 'instant' });

  if (page === 'shop-home') initShopHome();
  if (page === 'shop-checkout') initCheckoutPage();
  if (page === 'shop-orders') initOrdersPage();
  if (page === 'shop-wishlist') {
    renderWishlistPage();
  }
  if (page === 'shop-admin') initShopAdmin();
}

function scrollToShopSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function toggleShopMenu() {
  document.getElementById('shop-nav-links')?.classList.toggle('open');
}


// ============================================
// SHOP HOME — load products + categories
// ============================================
async function initShopHome() {
  await loadCategories();
  await loadAndRenderProducts();
  updateCartBadge();
}

async function loadCategories() {
  try {
    SHOP.categories = await getCategories();
    renderCategoryPills();
  } catch (err) {
    console.error('Categories error:', err);
  }
}

function renderCategoryPills() {
  const container = document.getElementById('category-pills');
  if (!container) return;

  const allBtn = `<button class="cat-pill ${SHOP.activeCategory === 'All' ? 'active' : ''}"
    data-cat="All" onclick="filterByCategory('All', this)">All</button>`;

  const pills = SHOP.categories.map(cat => `
    <button class="cat-pill ${SHOP.activeCategory === cat.name ? 'active' : ''}"
      data-cat="${cat.name}" onclick="filterByCategory('${cat.name}', this)">
      ${cat.name}
    </button>`).join('');

  container.innerHTML = allBtn + pills;
}

async function loadAndRenderProducts() {
  setLoading('products-grid', true);
  try {
    const filters = getActiveFilters();
    SHOP.products = await getProducts(filters);
    renderProducts();
  } catch (err) {
    console.error('Products error:', err);
    shopToast('❌', 'Failed to load products');
  }
}

function getActiveFilters() {
  const filters = {};

  const search = document.getElementById('shop-search')?.value?.trim();
  if (search) filters.search = search;

  if (SHOP.activeCategory && SHOP.activeCategory !== 'All') {
    filters.category = SHOP.activeCategory;
  }

  const minPrice = parseInt(document.getElementById('price-min')?.value || 0);
  const maxPrice = parseInt(document.getElementById('price-max')?.value || 500000);
  filters.minPrice = minPrice;
  filters.maxPrice = maxPrice;

  const checked = [...document.querySelectorAll('.filter-check input:checked')].map(c => c.value);
  if (checked.length > 0) filters.material = checked[0]; // can extend for multi

  const sort = document.getElementById('sort-by')?.value || 'popular';
  filters.sort = sort;

  return filters;
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  const empty = document.getElementById('shop-empty');
  if (!grid) return;

  // Update price labels
  const minVal = document.getElementById('price-min')?.value;
  const maxVal = document.getElementById('price-max')?.value;
  if (minVal) document.getElementById('price-min-label').textContent = formatPrice(minVal);
  if (maxVal) document.getElementById('price-max-label').textContent = formatPrice(maxVal);

  if (!SHOP.products || SHOP.products.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  grid.style.display = 'grid';
  empty.style.display = 'none';

  grid.innerHTML = SHOP.products.map(p => {
    const primaryPhoto = p.product_photos?.find(ph => ph.is_primary)?.photo_url;
    const categoryName = p.furniture_categories?.name || '';
    const imgHtml = primaryPhoto
      ? `<img src="${primaryPhoto}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover"
             onerror="this.parentElement.innerHTML='<span style=font-size:64px>🛋️</span>'">`
      : `<span style="font-size:64px">🛋️</span>`;

    const isWishlisted = SHOP.wishlist.includes(p.id);
    const heartSvg = isWishlisted 
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="var(--gold)" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;

    return `
      <div class="product-card" onclick="openProductModal('${p.id}')">
        <div class="product-img">
          <span class="material-tag">${(p.material || '').toUpperCase()}</span>
          <button class="wishlist-toggle-btn" onclick="toggleWishlist('${p.id}', event)">
            ${heartSvg}
          </button>
          ${imgHtml}
        </div>
        <div class="product-info">
          <div class="product-name">${p.name}</div>
          <div class="product-meta">${categoryName}</div>
          <div class="product-price">${formatPrice(p.price)}</div>
          <button class="btn-gold-shop"
            onclick="event.stopPropagation(); addToCart('${p.id}')">
            ADD TO CART
          </button>
        </div>
      </div>`;
  }).join('');
}

function filterByCategory(cat, btn) {
  SHOP.activeCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  btn?.classList.add('active');
  loadAndRenderProducts();
}

function applyFilters() {
  loadAndRenderProducts();
}

function resetFilters() {
  SHOP.activeCategory = 'All';
  document.getElementById('price-min').value = 0;
  document.getElementById('price-max').value = 500000;
  document.getElementById('sort-by').value = 'popular';
  document.getElementById('shop-search').value = '';
  document.querySelectorAll('.filter-check input').forEach(c => c.checked = false);
  renderCategoryPills();
  loadAndRenderProducts();
}


// ============================================
// PRODUCT MODAL
// ============================================
async function openProductModal(productId) {
  const modal = document.getElementById('product-modal');
  const overlayEl = document.getElementById('product-modal-overlay');
  modal.innerHTML = '<div style="padding:40px;text-align:center;color:#888">Loading...</div>';
  modal.classList.add('show');
  overlayEl.classList.add('show');

  try {
    const p = await getProductById(productId);
    const related = SHOP.products.filter(x =>
      x.furniture_categories?.name === p.furniture_categories?.name && x.id !== p.id
    ).slice(0, 4);

    const primaryPhoto = p.product_photos?.find(ph => ph.is_primary)?.photo_url;
    const allPhotos = p.product_photos || [];

    const mainImgHtml = primaryPhoto
      ? `<img src="${primaryPhoto}" alt="${p.name}"
             style="width:100%;height:100%;object-fit:cover;border-radius:8px">`
      : `<div style="font-size:80px;display:flex;align-items:center;justify-content:center;height:100%">🛋️</div>`;

    modal.innerHTML = `
      <button class="modal-close" onclick="closeProductModal()">✕</button>
      <div class="modal-layout">
        <div class="modal-gallery">
          <div class="modal-main-img" id="modal-main-img">${mainImgHtml}</div>
          <div class="modal-thumbs">
            ${allPhotos.map((ph, i) => `
              <div class="modal-thumb ${i === 0 ? 'active' : ''}"
                   onclick="switchModalPhoto('${ph.photo_url}', this)">
                <img src="${ph.photo_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:4px">
              </div>`).join('') || '<div class="modal-thumb active">🛋️</div>'}
          </div>
        </div>
        <div class="modal-info">
          <h2>${p.name}</h2>
          <div class="modal-price">${formatPrice(p.price)}</div>
          <div class="modal-desc">${p.description || ''}</div>
          ${p.dimensions ? `<div class="modal-dims">📏 Dimensions: ${p.dimensions}</div>` : ''}
          <div class="qty-selector">
            <button class="qty-btn" onclick="changeModalQty(-1)">−</button>
            <input class="qty-val" id="modal-qty" value="1" readonly>
            <button class="qty-btn" onclick="changeModalQty(1)">+</button>
          </div>
          <div class="modal-btns">
            <button class="btn-gold-shop" onclick="addToCartFromModal('${p.id}')">ADD TO CART</button>
            <button class="btn-outline-shop" onclick="shopToast('❤️','Added to wishlist')">♡ WISHLIST</button>
          </div>
          <div class="modal-delivery">
            🚚 Estimated delivery: <strong>${p.delivery_days || 7} days</strong><br>
            Delivery by: <strong>${p.delivery_partner || 'In-House Delivery Team'}</strong>
          </div>
          ${p.stock <= 5 && p.stock > 0 ? `<div style="color:#ff9f43;font-size:13px;margin-top:8px">⚠️ Only ${p.stock} left in stock!</div>` : ''}
          ${p.stock === 0 ? `<div style="color:#ff6b6b;font-size:13px;margin-top:8px">❌ Out of stock</div>` : ''}
        </div>
      </div>
      ${related.length ? `
      <div class="related-row">
        <h3>RELATED PRODUCTS</h3>
        <div class="related-grid">
          ${related.map(r => {
      const rPhoto = r.product_photos?.find(ph => ph.is_primary)?.photo_url;
      return `
              <div class="related-card"
                   onclick="closeProductModal(); setTimeout(()=>openProductModal('${r.id}'),300)">
                <div class="r-emoji">
                  ${rPhoto ? `<img src="${rPhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">` : '🛋️'}
                </div>
                <div class="r-name">${r.name}</div>
                <div class="r-price">${formatPrice(r.price)}</div>
              </div>`;
    }).join('')}
        </div>
      </div>` : ''}
    `;
  } catch (err) {
    modal.innerHTML = '<div style="padding:40px;text-align:center;color:#ff6b6b">Failed to load product.</div>';
    console.error(err);
  }
}

function switchModalPhoto(url, thumb) {
  document.getElementById('modal-main-img').innerHTML =
    `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;
  document.querySelectorAll('.modal-thumb').forEach(t => t.classList.remove('active'));
  thumb?.classList.add('active');
}

function closeProductModal() {
  document.getElementById('product-modal')?.classList.remove('show');
  document.getElementById('product-modal-overlay')?.classList.remove('show');
}

function changeModalQty(delta) {
  const input = document.getElementById('modal-qty');
  let val = parseInt(input.value) + delta;
  if (val < 1) val = 1;
  if (val > 20) val = 20;
  input.value = val;
}

function addToCartFromModal(id) {
  const qty = parseInt(document.getElementById('modal-qty')?.value || 1);
  addToCart(id, qty);
  closeProductModal();
}


// ============================================
// CART
// ============================================
function addToCart(productId, qty = 1) {
  const product = SHOP.products.find(p => p.id === productId);
  if (!product) return;

  if (product.stock === 0) {
    shopToast('❌', 'This item is out of stock');
    return;
  }

  const photo = product.product_photos?.find(ph => ph.is_primary)?.photo_url || null;

  const existing = SHOP.cart.find(c => c.id === productId);
  if (existing) {
    existing.qty += qty;
  } else {
    SHOP.cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      photo,
      qty,
    });
  }

  saveCart();
  updateCartBadge();
  shopToast('🛒', `${product.name} added to cart!`);
}

function removeFromCart(id) {
  SHOP.cart = SHOP.cart.filter(c => c.id !== id);
  saveCart();
  updateCartBadge();
  renderCartSidebar();
}

function updateCartQty(id, delta) {
  const item = SHOP.cart.find(c => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty < 1) return removeFromCart(id);
  saveCart();
  renderCartSidebar();
  updateCartBadge();
}

function saveCart() {
  localStorage.setItem('rjs_shop_cart', JSON.stringify(SHOP.cart));
}

// ── WISHLIST LOGIC ──
function toggleWishlist(id, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const index = SHOP.wishlist.indexOf(id);
  if (index === -1) {
    SHOP.wishlist.push(id);
    shopToast('❤️', 'Added to wishlist!');
  } else {
    SHOP.wishlist.splice(index, 1);
    shopToast('💔', 'Removed from wishlist');
  }
  saveWishlist();
  renderProducts(); // re-render to update heart icons
  
  // If we are on the wishlist page, re-render it
  if (SHOP.currentPage === 'shop-wishlist') {
    renderWishlistPage();
  }
}

function saveWishlist() {
  localStorage.setItem('rjs_shop_wishlist', JSON.stringify(SHOP.wishlist));
}

function renderWishlistPage() {
  const grid = document.getElementById('wishlist-grid');
  const empty = document.getElementById('wishlist-empty');
  if (!grid || !empty) return;

  const items = SHOP.products.filter(p => SHOP.wishlist.includes(p.id));

  if (items.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
  } else {
    grid.style.display = 'grid';
    empty.style.display = 'none';

    grid.innerHTML = items.map(p => {
      const primaryPhoto = p.product_photos?.find(ph => ph.is_primary)?.photo_url;
      const categoryName = p.furniture_categories?.name || '';
      const imgHtml = primaryPhoto
        ? `<img src="${primaryPhoto}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<span style=font-size:64px>🛋️</span>'">`
        : `<span style="font-size:64px">🛋️</span>`;
        
      return `
        <div class="product-card" onclick="openProductModal('${p.id}')">
          <div class="product-img">
            <span class="material-tag">${(p.material || '').toUpperCase()}</span>
            <button class="wishlist-toggle-btn" onclick="toggleWishlist('${p.id}', event)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--gold)" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
            ${imgHtml}
          </div>
          <div class="product-info">
            <div class="product-name">${p.name}</div>
            <div class="product-meta">${categoryName}</div>
            <div class="product-price">${formatPrice(p.price)}</div>
            <button class="btn-gold-shop" onclick="event.stopPropagation(); addToCart('${p.id}')">
              ADD TO CART
            </button>
          </div>
        </div>`;
    }).join('');
  }
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  const total = SHOP.cart.reduce((s, c) => s + c.qty, 0);
  if (badge) {
    badge.textContent = total;
    badge.classList.remove('bounce');
    void badge.offsetWidth;
    badge.classList.add('bounce');
  }
}

function getCartSubtotal() {
  return SHOP.cart.reduce((s, c) => s + c.price * c.qty, 0);
}

function openCart() {
  renderCartSidebar();
  document.getElementById('cart-sidebar')?.classList.add('show');
  document.getElementById('cart-overlay')?.classList.add('show');
}

function closeCart() {
  document.getElementById('cart-sidebar')?.classList.remove('show');
  document.getElementById('cart-overlay')?.classList.remove('show');
}

function renderCartSidebar() {
  const container = document.getElementById('cart-sidebar-items');
  const footer = document.getElementById('cart-sidebar-footer');
  if (!container) return;

  if (SHOP.cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty-state">
        <div class="empty-icon">🪑</div>
        <h3>Your space is waiting to be furnished.</h3>
        <p>Add items to get started.</p>
      </div>`;
    if (footer) footer.innerHTML = '';
    return;
  }

  container.innerHTML = SHOP.cart.map(c => `
    <div class="cart-item">
      <div class="cart-item-img">
        ${c.photo
      ? `<img src="${c.photo}" alt="${c.name}" style="width:100%;height:100%;object-fit:cover;border-radius:6px">`
      : '🛋️'}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${c.name}</div>
        <div class="cart-item-price">${formatPrice(c.price)}</div>
        <div class="cart-item-qty">
          <button onclick="updateCartQty('${c.id}', -1)">−</button>
          <span>${c.qty}</span>
          <button onclick="updateCartQty('${c.id}', 1)">+</button>
        </div>
      </div>
      <button class="cart-remove" onclick="removeFromCart('${c.id}')">✕</button>
    </div>`).join('');

  if (footer) {
    footer.innerHTML = `
      <div class="cart-total-row">
        <span>Subtotal</span>
        <span class="cart-total-val">${formatPrice(getCartSubtotal())}</span>
      </div>
      <div class="cart-footer-btns">
        <button class="btn-gold-shop"
          onclick="closeCart(); proceedToCheckout()">
          PROCEED TO CHECKOUT
        </button>
        <button class="btn-outline-shop" onclick="closeCart()">Continue Shopping</button>
      </div>`;
  }
}


// ============================================
// PROFILE & LOGOUT
// ============================================
async function openProfile() {
  const user = await getCurrentUser();
  if (!user) {
    showAuthModal();
    return;
  }
  
  navigateShop('shop-profile');
  
  // Load profile data
  const profileName = document.getElementById('profile-name');
  const profilePhone = document.getElementById('profile-phone');
  const profileAddress = document.getElementById('profile-address');
  
  if (profileName) profileName.value = SHOP.shopProfile?.full_name || user.user_metadata?.full_name || '';
  if (profilePhone) profilePhone.value = SHOP.shopProfile?.phone || '';
  if (profileAddress) profileAddress.value = SHOP.shopProfile?.address || '';
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const btn = document.getElementById('profile-save-btn');
  if (btn) btn.textContent = 'Saving...';
  
  try {
    const full_name = document.getElementById('profile-name').value;
    const phone = document.getElementById('profile-phone').value;
    const address = document.getElementById('profile-address').value;
    
    // We need to import supabase to update profile
    const { supabase } = await import('./supabase.js');
    const user = await getCurrentUser();
    
    const { error } = await supabase
      .from('profiles')
      .update({ full_name, phone, address })
      .eq('id', user.id);
      
    if (error) throw error;
    
    // Also update auth metadata if needed
    await supabase.auth.updateUser({ data: { full_name } });
    
    SHOP.shopProfile = await getCurrentProfile();
    shopToast('✅', 'Profile updated successfully!');
  } catch (err) {
    console.error(err);
    shopToast('❌', 'Failed to update profile.');
  } finally {
    if (btn) btn.textContent = 'Save Changes';
  }
}

async function handleShopLogout() {
  try {
    const { supabase } = await import('./supabase.js');
    await supabase.auth.signOut();
    SHOP.shopUser = null;
    SHOP.shopProfile = null;
    shopToast('👋', 'You have been signed out');
    navigateShop('shop-home');
  } catch (err) {
    shopToast('❌', 'Logout failed');
  }
}

// ============================================
// CHECKOUT
// ============================================
async function proceedToCheckout() {
  try {
    const user = await getCurrentUser();
    if (user) {
      navigateShop('shop-checkout');
    } else {
      showAuthModal();
    }
  } catch {
    showAuthModal();
  }
}

async function initCheckoutPage() {
  // Set min delivery date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateInput = document.getElementById('del-date');
  if (dateInput) dateInput.min = tomorrow.toISOString().split('T')[0];

  // Check if user is logged in
  try {
    const user = await getCurrentUser();
    if (user) {
      SHOP.shopUser = user;
      SHOP.shopProfile = await getCurrentProfile();
      showCheckoutForm();
      populateCheckoutSummary();
    } else {
      showAuthModal();
      document.getElementById('checkout-form-view').style.display = 'none'; // hide checkout explicitly
    }
  } catch {
    showAuthModal();
    document.getElementById('checkout-form-view').style.display = 'none';
  }
}

function showAuthModal() {
  const modal = document.getElementById('global-auth-modal');
  if (modal) modal.style.display = 'flex';
}

function closeAuthModal() {
  const modal = document.getElementById('global-auth-modal');
  if (modal) modal.style.display = 'none';
}

function showCheckoutForm() {
  document.getElementById('checkout-auth-gate').style.display = 'none';
  document.getElementById('checkout-form-view').style.display = 'block';

  // Pre-fill name from profile (never email)
  const delName = document.getElementById('del-name');
  if (delName && !delName.value) {
    const name = SHOP.shopProfile?.full_name
      || SHOP.shopUser?.user_metadata?.full_name
      || SHOP.shopUser?.user_metadata?.display_name
      || '';
    // Only set if it looks like a real name (not an email)
    if (name && !name.includes('@')) {
      delName.value = name;
    }
  }

  // Phone: digits only, max 10
  const phoneInput = document.getElementById('del-phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', function() {
      this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10);
    });
  }

  // Init payment selection highlighting
  updatePaymentSelection();
}

function updatePaymentSelection() {
  document.querySelectorAll('#payment-options .payment-option').forEach(label => {
    const radio = label.querySelector('input[type="radio"]');
    if (radio && radio.checked) {
      label.classList.add('selected');
    } else {
      label.classList.remove('selected');
    }
  });
}

function populateCheckoutSummary() {
  const container = document.getElementById('checkout-items');
  if (!container) return;

  const subtotal = getCartSubtotal();
  const deliveryFee = 499;
  const total = subtotal + deliveryFee;

  container.innerHTML = SHOP.cart.map(c => `
    <div class="checkout-item-row">
      <span>${c.name} × ${c.qty}</span>
      <span>${formatPrice(c.price * c.qty)}</span>
    </div>`).join('');

  document.getElementById('checkout-subtotal').textContent = formatPrice(subtotal);
  document.getElementById('checkout-delivery-fee').textContent = formatPrice(deliveryFee);
  document.getElementById('checkout-total').textContent = formatPrice(total);
}

// ============================================
// MODAL AUTH LOGIC
// ============================================
function switchModalAuthTab(tab) {
  const loginTab = document.getElementById('modal-tab-login');
  const signupTab = document.getElementById('modal-tab-signup');
  const nameField = document.getElementById('modal-signup-name-field');

  if (tab === 'login') {
    loginTab?.classList.add('active');
    signupTab?.classList.remove('active');
    if (nameField) nameField.style.display = 'none';
  } else {
    signupTab?.classList.add('active');
    loginTab?.classList.remove('active');
    if (nameField) nameField.style.display = 'block';
  }
}

async function handleModalAuth(e) {
  e.preventDefault();
  const isLogin = document.getElementById('modal-tab-login')?.classList.contains('active');
  const email = document.getElementById('modal-auth-email').value.trim();
  const password = document.getElementById('modal-auth-password').value;
  const name = document.getElementById('modal-auth-name')?.value.trim();
  const btn = document.getElementById('modal-auth-btn');

  if (btn) {
    btn.textContent = 'Please wait...';
    btn.disabled = true;
  }

  try {
    if (isLogin) {
      await signIn(email, password);
    } else {
      await signUpCustomer(email, password, name);
    }
    SHOP.shopUser = await getCurrentUser();
    SHOP.shopProfile = await getCurrentProfile();
    closeAuthModal();
    
    // If we're on the checkout page, resume checkout
    if (document.getElementById('page-shop-checkout')?.style.display !== 'none') {
      showCheckoutForm();
      populateCheckoutSummary();
    }
    
    shopToast('✅', isLogin ? 'Welcome back!' : 'Account created!');
  } catch (err) {
    shopToast('❌', err.message || 'Authentication failed');
    console.error(err);
  } finally {
    if (btn) {
      btn.textContent = 'Continue →';
      btn.disabled = false;
    }
  }
}

async function signInWithProvider(provider) {
  try {
    // We dynamically import supabase instance to call OAuth
    const { supabase } = await import('./supabase.js');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: window.location.origin + '/shop.html'
      }
    });
    if (error) throw error;
  } catch (err) {
    console.error(err);
    alert(`Backend Setup Required: To use ${provider} sign in, you must enable it in your Supabase Dashboard -> Authentication -> Providers section. Once enabled with your Client IDs, this button will work automatically.`);
  }
}

// ── Razorpay Config ──
// Step 1: Sign up at https://razorpay.com
// Step 2: Go to Dashboard → Settings → API Keys → Generate Key
// Step 3: Paste your Key ID below (starts with 'rzp_test_' or 'rzp_live_')
const RAZORPAY_KEY_ID = 'YOUR_RAZORPAY_KEY_ID';

async function placeOrderHandler() {
  if (SHOP.cart.length === 0) {
    shopToast('❌', 'Your cart is empty!');
    return;
  }

  // Validate form fields
  const required = ['del-name', 'del-phone', 'del-addr1', 'del-city', 'del-pin'];
  for (const id of required) {
    if (!document.getElementById(id)?.value.trim()) {
      shopToast('❌', 'Please fill in all delivery details');
      return;
    }
  }

  const subtotal = getCartSubtotal();
  const deliveryFee = 499;
  const total = subtotal + deliveryFee;

  const orderData = {
    subtotal,
    delivery_fee: deliveryFee,
    total,
    delivery_name: document.getElementById('del-name').value.trim(),
    delivery_phone: document.getElementById('del-phone').value.trim(),
    delivery_address1: document.getElementById('del-addr1').value.trim(),
    delivery_address2: document.getElementById('del-addr2')?.value.trim() || '',
    delivery_city: document.getElementById('del-city').value.trim(),
    delivery_pincode: document.getElementById('del-pin').value.trim(),
    delivery_date: document.getElementById('del-date').value,
    payment_method: document.querySelector('input[name="payment"]:checked')?.value || 'cod',
  };

  const paymentMethod = orderData.payment_method;

  if (paymentMethod === 'online') {
    // ── Razorpay Online Payment Flow ──
    initiateRazorpayPayment(orderData);
  } else {
    // ── COD Flow (existing) ──
    await finalizeCODOrder(orderData);
  }
}

function initiateRazorpayPayment(orderData) {
  const btn = document.getElementById('place-order-btn');
  btn.textContent = '⏳ Opening Payment...';
  btn.disabled = true;

  const amountInPaise = Math.round(orderData.total * 100);

  const options = {
    key: RAZORPAY_KEY_ID,
    amount: amountInPaise,
    currency: 'INR',
    name: 'RJS Furniture',
    description: `${SHOP.cart.length} item${SHOP.cart.length > 1 ? 's' : ''} — RJS Homes Furniture`,
    image: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><rect width="100" height="40" rx="4" fill="#d4af37"/><text x="50" y="28" font-family="serif" font-size="22" font-weight="bold" fill="#000" text-anchor="middle">RJS</text></svg>'),
    prefill: {
      name: orderData.delivery_name,
      contact: orderData.delivery_phone,
      email: SHOP.shopUser?.email || '',
    },
    theme: {
      color: '#d4af37',
      backdrop_color: 'rgba(0,0,0,0.85)',
    },
    handler: async function (response) {
      // Payment successful — save order to DB
      btn.textContent = '⏳ Confirming Order...';
      try {
        orderData.payment_status = 'paid';
        orderData.razorpay_payment_id = response.razorpay_payment_id;

        const order = await placeOrder(orderData, SHOP.cart);

        SHOP.cart = [];
        saveCart();
        updateCartBadge();
        showOrderConfirmation(order);
        shopToast('✅', 'Payment successful!');
      } catch (err) {
        shopToast('❌', 'Payment received but order failed. Contact support.');
        console.error('Order save after payment error:', err);
      } finally {
        btn.textContent = '⚡ Place Order';
        btn.disabled = false;
      }
    },
    modal: {
      ondismiss: function () {
        btn.textContent = '⚡ Place Order';
        btn.disabled = false;
        shopToast('ℹ️', 'Payment cancelled');
      },
    },
  };

  try {
    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function (response) {
      btn.textContent = '⚡ Place Order';
      btn.disabled = false;
      shopToast('❌', `Payment failed: ${response.error.description || 'Please try again'}`);
      console.error('Razorpay payment failed:', response.error);
    });
    rzp.open();
  } catch (err) {
    btn.textContent = '⚡ Place Order';
    btn.disabled = false;
    shopToast('❌', 'Could not initialize payment. Check your connection.');
    console.error('Razorpay init error:', err);
  }
}

async function finalizeCODOrder(orderData) {
  const btn = document.getElementById('place-order-btn');
  btn.textContent = '⏳ Placing Order...';
  btn.disabled = true;

  try {
    orderData.payment_status = 'pending';
    const order = await placeOrder(orderData, SHOP.cart);

    SHOP.cart = [];
    saveCart();
    updateCartBadge();
    showOrderConfirmation(order);
  } catch (err) {
    shopToast('❌', 'Failed to place order. Please try again.');
    console.error(err);
  } finally {
    btn.textContent = '⚡ Place Order';
    btn.disabled = false;
  }
}

function showOrderConfirmation(order) {
  navigateShop('shop-orders');

  const confirmView = document.getElementById('order-confirm-view');
  const myOrdersView = document.getElementById('my-orders-view');

  if (confirmView) confirmView.style.display = 'flex';
  if (myOrdersView) myOrdersView.style.display = 'none';

  document.getElementById('confirm-order-id').textContent = order.order_code;

  // Send Order Confirmation Email
  try {
    if (window.emailjs && SHOP.shopUser?.email) {
      emailjs.send(
        'YOUR_SERVICE_ID', // Replace with EmailJS Service ID
        'YOUR_TEMPLATE_ID', // Replace with EmailJS Template ID for orders
        {
          to_email: SHOP.shopUser.email,
          to_name: order.delivery_name || SHOP.shopProfile?.full_name || 'Customer',
          order_id: order.order_code,
          order_total: formatPrice(order.total),
          delivery_eta: '7-10 business days',
          payment_method: order.payment_method.toUpperCase()
        }
      ).catch(e => console.error("EmailJS error:", e));
    }
  } catch (err) {
    console.error("Failed to send confirmation email", err);
  }

  const eta = new Date();
  eta.setDate(eta.getDate() + 7);
  document.getElementById('confirm-eta').textContent =
    eta.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  // Animate the checkmark SVG
  setTimeout(() => {
    const circle = document.querySelector('.check-circle');
    const mark = document.querySelector('.check-mark');
    const circumference = 2 * Math.PI * 45;
    if (circle) {
      circle.style.strokeDasharray = circumference;
      circle.style.strokeDashoffset = circumference;
      circle.style.transition = 'stroke-dashoffset 0.8s ease';
      setTimeout(() => { circle.style.strokeDashoffset = 0; }, 100);
    }
    if (mark) {
      mark.style.strokeDasharray = 100;
      mark.style.strokeDashoffset = 100;
      mark.style.transition = 'stroke-dashoffset 0.6s ease 0.6s';
      setTimeout(() => { mark.style.strokeDashoffset = 0; }, 100);
    }
  }, 200);
}


// ============================================
// MY ORDERS
// ============================================
async function initOrdersPage() {
  document.getElementById('order-confirm-view').style.display = 'none';
  document.getElementById('my-orders-view').style.display = 'block';
  await renderMyOrders();

  // Subscribe to live order status changes
  const user = await getCurrentUser();
  if (user) {
    if (SHOP.unsubOrders) SHOP.unsubOrders();
    SHOP.unsubOrders = subscribeToMyOrders(user.id, (updatedOrder) => {
      updateOrderStatusLive(updatedOrder);
      shopToast('📦', `Order ${updatedOrder.order_code} is now ${updatedOrder.status}`);
    });
  }
}

async function renderMyOrders() {
  const listEl = document.getElementById('orders-list');
  const emptyEl = document.getElementById('orders-empty');
  if (!listEl) return;

  listEl.innerHTML = '<p style="color:#888;padding:16px">Loading orders...</p>';

  try {
    SHOP.orders = await getMyOrders();

    if (SHOP.orders.length === 0) {
      listEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }

    listEl.style.display = 'block';
    emptyEl.style.display = 'none';

    const statusColors = {
      'Confirmed': '#f0b429',
      'Dispatched': '#54a0ff',
      'Out for Delivery': '#ff9f43',
      'Delivered': '#26de81',
    };

    listEl.innerHTML = SHOP.orders.map(order => {
      const date = new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const color = statusColors[order.status] || '#888';
      const items = order.order_items?.map(i => `${i.product_name} × ${i.quantity}`).join(', ') || '';

      return `
        <div class="order-card" id="order-card-${order.id}">
          <div class="order-card-header">
            <div>
              <div class="order-code">${order.order_code}</div>
              <div class="order-date" style="color:#888;font-size:13px">${date}</div>
            </div>
            <span class="order-status-badge" id="order-status-${order.id}"
                  style="background:${color}22;color:${color};padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600">
              ${order.status}
            </span>
          </div>
          <div class="order-items-summary" style="color:#aaa;font-size:13px;margin:8px 0">${items}</div>
          <div class="order-card-footer">
            <span style="color:#D4A017;font-weight:600">${formatPrice(order.total)}</span>
            <span style="color:#888;font-size:12px">
              📅 ${order.delivery_date || 'TBD'} · ${order.delivery_slot || ''}
            </span>
          </div>
        </div>`;
    }).join('');

  } catch (err) {
    listEl.innerHTML = '<p style="color:#ff6b6b;padding:16px">Failed to load orders.</p>';
    console.error(err);
  }
}

function showMyOrders() {
  document.getElementById('order-confirm-view').style.display = 'none';
  document.getElementById('my-orders-view').style.display = 'block';
  renderMyOrders();
}

function updateOrderStatusLive(updatedOrder) {
  const badge = document.getElementById(`order-status-${updatedOrder.id}`);
  if (badge) {
    const statusColors = {
      'Confirmed': '#f0b429',
      'Dispatched': '#54a0ff',
      'Out for Delivery': '#ff9f43',
      'Delivered': '#26de81',
    };
    const color = statusColors[updatedOrder.status] || '#888';
    badge.textContent = updatedOrder.status;
    badge.style.background = `${color}22`;
    badge.style.color = color;
  }
}


// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is already logged in
  try {
    const user = await getCurrentUser();
    if (user) {
      SHOP.shopUser = user;
      SHOP.shopProfile = await getCurrentProfile();
    }
  } catch { /* not logged in */ }

  // Load shop home by default
  await initShopHome();

  // Set today's date as default for delivery
  const dateInput = document.getElementById('del-date');
  if (dateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.value = tomorrow.toISOString().split('T')[0];
  }
});

// Expose to HTML onclick attributes
window.navigateShop = navigateShop;
window.scrollToShopSection = scrollToShopSection;
window.toggleShopMenu = toggleShopMenu;
window.filterByCategory = filterByCategory;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.switchModalPhoto = switchModalPhoto;
window.changeModalQty = changeModalQty;
window.addToCartFromModal = addToCartFromModal;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartQty = updateCartQty;
window.openCart = openCart;
window.closeCart = closeCart;
window.initCheckoutPage = initCheckoutPage;
window.switchModalAuthTab = switchModalAuthTab;
window.handleModalAuth = handleModalAuth;
window.signInWithProvider = signInWithProvider;
window.closeAuthModal = closeAuthModal;
window.proceedToCheckout = proceedToCheckout;
window.placeOrder = placeOrderHandler;
window.showMyOrders = showMyOrders;
window.shopToast = shopToast;
window.toggleWishlist = toggleWishlist;
window.openProfile = openProfile;
window.handleProfileUpdate = handleProfileUpdate;
window.handleShopLogout = handleShopLogout;
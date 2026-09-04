// storage key used for persisted products (admin edits)
const PRODUCT_STORAGE_KEY = 'products_v1';

// hero storage for the homepage hero component
const HERO_STORAGE_KEY = 'hero_v1';
const HERO_SETTINGS_COLLECTION = 'settings';
const HERO_SETTINGS_DOCUMENT = 'hero';
const HERO_IMAGES_COLLECTION = 'heroImages';
const DEFAULT_HERO_INTERVAL = 4500;

const DEFAULT_HERO = {
    title: 'Discover great deals\nbevery day at Hawa Dennis',
    subtitle: 'Quality fashion and accessories at affordable prices — fast delivery, easy returns.',
    image: 'WhatsApp Image 2025-12-01 at 21.42.01_c32f26da.jpg',
    images: ['WhatsApp Image 2025-12-01 at 21.42.01_c32f26da.jpg'],
    slideDuration: DEFAULT_HERO_INTERVAL
};

let heroCarouselTimer = null;
let activeHeroImageIndex = 0;

function getHeroImages(hero) {
    const images = Array.isArray(hero.images) ? hero.images : [];
    const uniqueImages = [...new Set(images.filter(image => String(image || '').trim()))];
    if (!uniqueImages.length && hero.image) uniqueImages.push(hero.image);
    return uniqueImages.length ? uniqueImages : DEFAULT_HERO.images.slice();
}

function getHeroSlideDuration(hero) {
    const duration = Number(hero.slideDuration);
    return Number.isFinite(duration) ? Math.min(Math.max(duration, 2000), 30000) : DEFAULT_HERO_INTERVAL;
}

function loadHeroFromStorage() {
    try {
        const raw = localStorage.getItem(HERO_STORAGE_KEY);
        if (!raw) return Object.assign({}, DEFAULT_HERO);
        const parsed = JSON.parse(raw);
        return Object.assign({}, DEFAULT_HERO, parsed || {});
    } catch (e) { return Object.assign({}, DEFAULT_HERO); }
}

function saveHeroToStorage(hero) {
    try {
        localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(hero));
        return true;
    } catch (e) {
        return false;
    }
    // notify other windows via storage event (happens automatically on setItem)
}

async function saveHeroToFirebase(hero) {
    const images = getHeroImages(hero);
    const batch = db.batch();
    const settingsRef = db.collection(HERO_SETTINGS_COLLECTION).doc(HERO_SETTINGS_DOCUMENT);
    const existingImages = await db.collection(HERO_IMAGES_COLLECTION).get();
    existingImages.forEach(document => batch.delete(document.ref));
    images.forEach((image, index) => {
        batch.set(db.collection(HERO_IMAGES_COLLECTION).doc(), { image, position: index });
    });
    batch.set(settingsRef, {
        title: hero.title || '',
        subtitle: hero.subtitle || '',
        slideDuration: getHeroSlideDuration(hero),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await batch.commit();
}

function applyHeroToPage() {
    const hero = loadHeroFromStorage();
    try {
        const t = document.getElementById('hero-title');
        const s = document.getElementById('hero-sub');
        const img = document.getElementById('hero-image');
        const dots = document.getElementById('hero-carousel-dots');
        const images = getHeroImages(hero);
        if (t) t.innerHTML = hero.title ? hero.title.replace(/\n/g, '<br>') : '';
        if (s) s.textContent = hero.subtitle || '';
        if (!img) return;

        if (heroCarouselTimer) clearInterval(heroCarouselTimer);
        activeHeroImageIndex = 0;
        const showImage = index => {
            activeHeroImageIndex = (index + images.length) % images.length;
            img.src = images[activeHeroImageIndex];
            if (dots) {
                dots.innerHTML = images.map((image, imageIndex) => `<button type="button" class="hero-dot${imageIndex === activeHeroImageIndex ? ' active' : ''}" aria-label="Show hero image ${imageIndex + 1}"></button>`).join('');
                dots.querySelectorAll('.hero-dot').forEach((dot, dotIndex) => dot.addEventListener('click', () => showImage(dotIndex)));
            }
        };
        showImage(0);
        if (images.length > 1) heroCarouselTimer = setInterval(() => showImage(activeHeroImageIndex + 1), getHeroSlideDuration(hero));
    } catch (e) { /* ignore */ }
}

// auto-apply hero on load for any page
try { applyHeroToPage(); } catch (e) { /* harmless if elements missing */ }

// keep hero in sync across tabs
window.addEventListener('storage', (e) => {
    if (e.key === HERO_STORAGE_KEY) applyHeroToPage();
});

function subscribeToHeroSettings() {
    let heroSettings = null;
    let heroImages = null;
    const applySharedHero = () => {
        if (!heroSettings || !heroImages) return;
        const savedHero = Object.assign({}, DEFAULT_HERO, heroSettings, { images: heroImages });
        savedHero.image = heroImages[0] || DEFAULT_HERO.image;
        saveHeroToStorage(savedHero);
        applyHeroToPage();
    };

    db.collection(HERO_SETTINGS_COLLECTION).doc(HERO_SETTINGS_DOCUMENT).onSnapshot(snapshot => {
        if (!snapshot.exists) return;
        heroSettings = snapshot.data() || {};
        applySharedHero();
    }, error => console.error('Firestore hero settings error:', error));

    db.collection(HERO_IMAGES_COLLECTION).orderBy('position').onSnapshot(snapshot => {
        heroImages = snapshot.docs.map(document => document.data().image).filter(Boolean);
        applySharedHero();
    }, error => console.error('Firestore hero images error:', error));
}

window.addEventListener('DOMContentLoaded', subscribeToHeroSettings);

// categories storage
const CATEGORIES_STORAGE_KEY = 'categories_v1';

const DEFAULT_CATEGORIES = ['Men', 'Women', 'Shorts', 'T-Shirts', 'Sweatpants', 'Shoes', 'Dress', 'Tops', 'Footwear', 'Accessories', 'Sportswear', 'Outerwear', 'Underwear', 'Others'];

function loadCategoriesFromStorage() {
    try {
        const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
        if (!raw) return DEFAULT_CATEGORIES.slice();
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_CATEGORIES.slice();
    } catch (e) { return DEFAULT_CATEGORIES.slice(); }
}

function saveCategoriesToStorage(categories) {
    try { localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories || [])); } catch (e) { }
}

function addCategory(name) {
    name = String(name || '').trim();
    if (!name) return;
    let categories = loadCategoriesFromStorage();
    if (categories.includes(name)) return; // already exists
    categories.push(name);
    saveCategoriesToStorage(categories);
    renderCategoryList();
    renderCategoryPills();
    showToast(`Category "${name}" added`);
}

function removeCategory(name) {
    let categories = loadCategoriesFromStorage();
    categories = categories.filter(c => c !== name);
    saveCategoriesToStorage(categories);
    renderCategoryList();
    renderCategoryPills();
    showToast(`Category "${name}" removed`);
}

function renderCategoryList() {
    const listEl = document.getElementById('admin-category-list');
    if (!listEl) return;
    const categories = loadCategoriesFromStorage();
    listEl.innerHTML = categories.map(cat => `<div class="category-item">${cat} <button onclick="removeCategory('${cat}')">Remove</button></div>`).join('');
}

function renderCategoryPills() {
    const listEl = document.getElementById('p-category-list');
    if (!listEl) return;
    const categories = loadCategoriesFromStorage();
    listEl.innerHTML = categories.map(cat => `<button type="button" class="category-pill" onclick="selectCategory('${cat}', this)">${cat}</button>`).join('');
    // also render top list if exists
    const topListEl = document.getElementById('p-category-list-top');
    if (topListEl) topListEl.innerHTML = listEl.innerHTML;
}

function selectCategory(cat, btn) {
    document.getElementById('p-category').value = cat;
    // highlight the selected pill
    const listEl = btn.closest('.category-list');
    if (listEl) {
        listEl.querySelectorAll('.category-pill').forEach(p => p.classList.remove('selected'));
        btn.classList.add('selected');
    }
}

// Firestore is the sole product catalog. Local storage is used only for the cart.
async function loadProductsFromStorage() {
    try {
        const snapshot = await db.collection("products").get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Firebase products error:", error);
        return [];
    }
}
function saveProductsToStorage(list) {
    // Keep this legacy function name for existing callers; the database is authoritative.
    saveProductsToFirestore(list);
}

// start with empty products; we'll populate from Firestore when available
let products = [];
// ======================================================
// FIRESTORE PRODUCT DATABASE
// ======================================================

async function saveProductsToFirestore(list) {
    try {
        const batch = db.batch();

        const productsRef = db.collection("products");

        // Get existing Firestore products
        const snapshot = await productsRef.get();

        // Delete old Firestore products
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Add current products
        list.forEach(product => {
            const id = String(product.id);

            batch.set(productsRef.doc(id), {
                id: product.id,
                name: product.name || "",
                price: Number(product.price) || 0,
                category: product.category || "",
                image: product.image || "",
                description: product.description || "",
                stock: Number(product.stock) || 0
            });
        });

        await batch.commit();

        console.log("Products saved to Firestore");
    } catch (error) {
        console.error("Firestore save error:", error);
        showToast("Database save failed");
    }
}


async function loadProductsFromFirestore() {
    try {
        const snapshot = await db
            .collection("products")
            .get();

        const firestoreProducts = [];

        snapshot.forEach(doc => {
            const productData = doc.data();
            firestoreProducts.push({
                ...productData,
                id: productData.id || doc.id,
                firestoreId: doc.id,
                price: Number(productData.price) || 0,
                stock: Number(productData.stock) || 0
            });
        });

        // Sort by ID
        firestoreProducts.sort((a, b) =>
            Number(a.id) - Number(b.id)
        );

        products = firestoreProducts;

        // Keep a local cache too
        localStorage.setItem(
            PRODUCT_STORAGE_KEY,
            JSON.stringify(products)
        );

        console.log(
            "Products loaded from Firestore:",
            products
        );

        return products;

    } catch (error) {
        console.error("Firestore load error:", error);
        try {
            const cachedProducts = JSON.parse(localStorage.getItem(PRODUCT_STORAGE_KEY) || '[]');
            return Array.isArray(cachedProducts) ? cachedProducts : [];
        } catch (cacheError) {
            return [];
        }
    }
}


const container = document.getElementById("product-list");

// ensure every product has a unique id (so we can reliably add to cart)
products.forEach((p, i) => {
    if (!p.id) p.id = i + 1;
    // default stock for any product without explicit stock
    if (typeof p.stock === 'undefined') p.stock = 30;
});

// admin helpers
function nextProductId() {
    const max = products.reduce((m, p) => Math.max(m, p.id || 0), 0);
    return max + 1;
}

function addProductFromAdmin(payload) {
    const p = Object.assign({}, payload);
    if (!p.name) return;
    p.id = nextProductId();
    if (typeof p.stock === 'undefined') p.stock = 30;
    if (!p.image) p.image = 'https://via.placeholder.com/420x320?text=Product';
    products.push(p);
    saveProductsToStorage(products);
    // refresh UI
    renderCart();
    if (container) applyFilters();
    showToast(`${p.name} added`);
        if (typeof window.renderAdminList === 'function') window.renderAdminList();
}

function deleteProduct(id) {
    const idx = products.findIndex(p => String(p.id) === String(id));
    if (idx === -1) return;
    if (!confirm('Delete this product?')) return;
    products.splice(idx, 1);
    saveProductsToStorage(products);
    cart = cart.filter(it => String(it.id) !== String(id));
    saveCart();
    renderCart();
    if (container) applyFilters();
    if (typeof window.renderAdminList === 'function') window.renderAdminList();
}

function editProduct(id) {
    const p = products.find(x => String(x.id) === String(id));
    if (!p) return;
    // if we're on the admin page and the admin form exists, prefill the form for inline edit
    const adminForm = document.getElementById('admin-form');
    if (adminForm) {
        adminForm.setAttribute('data-edit-id', String(id));
        document.getElementById('p-name').value = p.name || '';
        document.getElementById('p-price').value = p.price || 0;
        document.getElementById('p-category').value = p.category || '';
        // highlight matching pill if admin category pills exist
        try {
            const list = document.getElementById('p-category-list-top') || document.getElementById('p-category-list');
            if (list && p.category) {
                const target = Array.from(list.children).find(ch => ch.textContent && ch.textContent.trim() === p.category.trim());
                if (target) {
                    Array.from(list.children).forEach(ch => { ch.style.boxShadow = 'none'; ch.style.opacity = '1'; });
                    target.style.boxShadow = 'inset 0 0 0 2px rgba(255,255,255,0.08), 0 4px 10px rgba(0,0,0,0.12)';
                    target.style.opacity = '0.95';
                }
            }
        } catch (e) { /* ignore */ }
        document.getElementById('p-image').value = p.image || '';
        document.getElementById('p-stock').value = p.stock || 30;
        // show preview
        const preview = document.getElementById('image-preview');
        const img = document.getElementById('image-preview-img');
        if (p.image) { img.src = p.image; preview.style.display = 'block'; } else { img.src = ''; preview.style.display = 'none'; }
        document.getElementById('cancel-edit').style.display = 'inline-block';
        document.getElementById('add-product').textContent = 'Save changes';
        // clear any file input selection
        const fileIn = document.getElementById('p-image-file'); if (fileIn) fileIn.value = '';
        // scroll form into view so admin doesn't need to manually scroll
        try { adminForm.scrollIntoView({ behavior: 'smooth', block: 'center' }); const first = adminForm.querySelector('input,select,button'); if (first && typeof first.focus === 'function') first.focus(); } catch (e) { /* ignore */ }
        return;
    }

    // fallback: prompt-based edit (non-admin pages)
    const name = prompt('Product name', p.name) || p.name;
    const price = parseFloat(prompt('Price (Ksh)', p.price) || p.price) || p.price;
    const category = prompt('Category', p.category || '') || p.category;
    const image = prompt('Image URL (relative or absolute)', p.image || '') || p.image;
    const stock = parseInt(prompt('Stock', p.stock || 30), 10) || p.stock;
    p.name = name; p.price = price; p.category = category; p.image = image; p.stock = stock;
    saveProductsToStorage(products);
    renderCart();
    if (container) applyFilters();
    if (typeof window.renderAdminList === 'function') window.renderAdminList();
}

function resetProductsToDefaults() {
    products = [];
    saveProductsToStorage(products);
    renderCart();
    if (container) applyFilters();
    showToast('Product catalog cleared');
}

// helper: available stock = product stock minus qty already in the cart
function getAvailableStock(productId) {
    const prod = products.find(p => String(p.id) === String(productId));
    if (!prod) return 0;
    const inCartQty = cart.reduce((sum, it) => (it.id === productId ? sum + it.qty : sum), 0);
    return Math.max(0, (prod.stock || 0) - inCartQty);
}

let currentSort = 'default';

// Active filters
let currentCategory = 'All';
let currentSearch = '';

// Show products
function displayProducts(list) {
    container.innerHTML = "";
    if (!list.length) {
        container.innerHTML = '<div class="no-results">No products found</div>';
        return;
    }
    list.forEach(p => {
        // simple deterministic rating for display (3..5)
        const rating = 3 + (Number(p.id) % 3 || 0);
        const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
        const available = getAvailableStock(p.id);
        const stockText = available <= 0 ? 'Out of stock' : `${available} remaining`;
            container.innerHTML += `
            <div class="product-card" onclick="openProduct('${p.id}')" role="button" tabindex="0">
                <img src="${p.image}" alt="${p.name}">
                <div class="product-name">${p.name}</div>
                <div class="product-meta">
                    <div class="product-price">${p.price ? 'Ksh ' + p.price : 'Ask owner for price'}</div>
                    <div class="product-rating">${stars}</div>
                </div>
                <div class="stock-info ${available<=0 ? 'out' : (available<=5 ? 'low' : '')}">${stockText}</div>
                        <div class="product-actions">
                            <button class="add-btn" onclick="addToCartFromCard(event, '${p.id}')" ${available<=0 ? 'disabled': ''}>Add to Cart</button>
                            <button class="view-btn" onclick="(event.stopPropagation(), window.location.href='product.html?id=${encodeURIComponent(p.id)}')">View</button>
                            ${ (new URLSearchParams(window.location.search).get('admin') === '1') ? `<button class='view-btn' onclick="(event.stopPropagation(), window.open('admin.html?edit=${p.id}','_blank'))">Edit</button>` : '' }
                        </div>
            </div>
        `;
    });
}

// CART state
let cart = [];

function loadCart() {
    try {
        const raw = localStorage.getItem('cart_v1');
        cart = raw ? JSON.parse(raw) : [];
        // normalize older cart entries that didn't include product id
        cart = cart.map(item => {
            if (!item.id) {
                // try to find matching product by name & price
                const found = products.find(p => p.name === item.name && p.price === item.price);
                if (found) return { id: found.id, name: found.name, price: found.price, qty: item.qty || 1 };
            }
            return item;
        });
    } catch (e) {
        cart = [];
    }
}

function saveCart() {
    localStorage.setItem('cart_v1', JSON.stringify(cart));
}

function addToCart(productId) {
    const prod = products.find(x => String(x.id) === String(productId));
    if (!prod) return;

    // check available stock vs current quantity in cart
    const available = getAvailableStock(productId);
    if (available <= 0) { showToast('This item is out of stock'); return; }

    // if item exists increase qty, otherwise push new
    const found = cart.find(i => i.id === prod.id || (i.name === prod.name && i.price === prod.price));
    if (found) {
        if (found.qty < prod.stock) {
            // ensure we don't exceed available stock
            if (getAvailableStock(productId) <= 0) { showToast('Not enough stock left'); return; }
            found.qty += 1;
        } else {
            showToast('Not enough stock left');
            return;
        }
    } else {
        cart.push({ id: prod.id, name: prod.name, price: prod.price, qty: 1 });
    }

    saveCart();
    renderCart();
    if (container) applyFilters();
    showToast(`${prod.name} added to cart`);
}

// handler used from product cards to stop click propagation and add to cart
function addToCartFromCard(e, productId) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    addToCart(productId);
}

// open a product — if on product page, render in place, otherwise navigate
function openProduct(productId) {
    const isProductPage = window.location.pathname && window.location.pathname.toLowerCase().includes('product.html');
    if (isProductPage && typeof window.openProductInPlace === 'function') {
        window.openProductInPlace(productId);
    } else {
        window.location.href = `product.html?id=${encodeURIComponent(productId)}`;
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    renderCart();
    if (container) applyFilters();
}

function changeQty(index, delta) {
    const item = cart[index];
    if (!item) return;
    // when increasing quantity, check stock
    if (delta > 0) {
        const avail = getAvailableStock(item.id);
        if (avail <= 0) { showToast('No more stock'); return; }
    }
    item.qty += delta;
    if (item.qty <= 0) {
        cart.splice(index, 1);
    }
    saveCart();
    renderCart();
    if (container) applyFilters();
}

function cartTotal() {
    return cart.reduce((s, it) => s + it.price * it.qty, 0);
}

function renderCart() {
    const list = document.getElementById('cart-list');
    const totalEl = document.getElementById('cart-total');
    if (list) list.innerHTML = '';

    if (!cart.length) {
        if (list) list.innerHTML = '<div class="cart-empty">Cart is empty</div>';
        if (totalEl) totalEl.textContent = '0';
        // still update count in header
        const countEl2 = document.getElementById('cart-count');
        if (countEl2) countEl2.textContent = '0';
        return;
    }

    cart.forEach((it, idx) => {
        // try to find product metadata if we have id
        const meta = products.find(p => String(p.id) === String(it.id));
        const thumb = meta ? meta.image : null;
        const el = document.createElement('div');
        el.className = 'cart-item';
        el.innerHTML = `
            <div class="cart-item-row">
                <div class="mini-thumb" onclick="showProductFromCart(event, ${idx})" role="button" tabindex="0" title="Open ${it.name}">${thumb ? `<img src="${thumb}" alt="${it.name}">` : ''}</div>
                <div class="cart-item-body">
                    <div class="cart-item-name"><a href="#" onclick="showProductFromCart(event, ${idx})">${it.name}</a></div>
                    <div class="cart-item-controls">
                        <button onclick="changeQty(${idx}, -1)">-</button>
                        <span class="qty">${it.qty}</span>
                        <button onclick="changeQty(${idx}, 1)">+</button>
                        <div class="cart-item-price">Ksh ${it.price * it.qty}</div>
                        <button class="remove" onclick="removeFromCart(${idx})">Remove</button>
                    </div>
                </div>
            </div>
        `;
        if (list) list.appendChild(el);
    });

    if (totalEl) totalEl.textContent = cartTotal();

    // update cart count in top bar (total qty)
    const countEl = document.getElementById('cart-count');
    if (countEl) {
        const totalQty = cart.reduce((s, it) => s + it.qty, 0);
        countEl.textContent = totalQty;
    }
    // update product page stock UI (if present)
    if (typeof updatePageStockUI === 'function') updatePageStockUI();
}

// Show product quick-view from mini-cart; idx is index in cart
function showProductFromCart(evt, idx) {
    evt.preventDefault();
    const it = cart[idx];
    if (!it) return;
    // if cart item has product id, open modal for that id - otherwise try to find by name
    let pid = it.id;
    if (!pid) {
        const p = products.find(x => x.name === it.name && x.price === it.price);
        pid = p ? p.id : null;
    }
    if (pid) {
        // if we're already on product page and there's an in-place loader available, use it
        const isProductPage = window.location.pathname && window.location.pathname.toLowerCase().includes('product.html');
        if (isProductPage && typeof window.openProductInPlace === 'function') {
            window.openProductInPlace(pid);
            return;
        }

        window.location.href = `product.html?id=${pid}`;
    }
    // keep mini-cart open — user may add quantity from modal
}

function clearCart() {
    cart = [];
    saveCart();
    renderCart();
    if (container) applyFilters();
}

function checkout() {
    if (!cart.length) {
        alert('Your cart is empty. Add items before checking out.');
        return;
    }

    // simple demo checkout flow
    (async () => {
        try {
            const items = cart.map(it => {
                const prod = products.find(p => String(p.id) === String(it.id));
                const price = prod ? prod.price : it.price;
                return { productId: String(it.id), name: it.name, qty: it.qty, price };
            });
            const total = items.reduce((s, it) => s + (it.price || 0) * it.qty, 0);
            if (!confirm(`Proceed to checkout? Total: Ksh ${total}`)) return;

            cart = [];
            saveCart();
            renderCart();
            if (container) applyFilters();
            showToast('Thanks! Your order has been placed (demo).');
            const mini = document.getElementById('mini-cart');
            if (mini) mini.setAttribute('aria-hidden', 'true');
            const toggle = document.getElementById('cart-toggle');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('mini-cart-open');
        } catch (err) {
            console.error('Checkout failed', err);
            showToast('Checkout failed');
        }
    })();
}

// toggle mini cart dropdown in header
function toggleMiniCart() {
    const mini = document.getElementById('mini-cart');
    const toggle = document.getElementById('cart-toggle');
    if (!mini || !toggle) return;
    const open = mini.getAttribute('aria-hidden') === 'false';
    if (open) {
        mini.setAttribute('aria-hidden', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        // remove mobile open state
        document.body.classList.remove('mini-cart-open');
    } else {
        mini.setAttribute('aria-hidden', 'false');
        toggle.setAttribute('aria-expanded', 'true');
        // also ensure the cart list is rendered and scrolled
        renderCart();
        setTimeout(() => { const c = document.getElementById('cart-list'); if (c) c.scrollTop = 0; }, 60);
        // on mobile/tablet, prevent background scroll while mini-cart is open
        if (window.matchMedia('(max-width: 900px)').matches) {
            document.body.classList.add('mini-cart-open');
        }
    }
}

// close mini-cart when clicking outside
document.addEventListener('click', (e) => {
    const mini = document.getElementById('mini-cart');
    const toggle = document.getElementById('cart-toggle');
    if (!mini || !toggle) return;
    const isOpen = mini.getAttribute('aria-hidden') === 'false';
    if (!isOpen) return;
    // if click is inside mini or toggle — ignore
    if (mini.contains(e.target) || toggle.contains(e.target)) return;
    mini.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    // remove any locked scroll state
    document.body.classList.remove('mini-cart-open');
});

function showToast(message, duration = 2200) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = message;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration);
}

// send product-specific WhatsApp message (product page or anywhere)
function contactWhatsAppForProduct(productId) {
    const p = products.find(x => String(x.id) === String(productId));
    const phone = getPhoneIntlNoPlus(); // international format without plus
    if (p) {
        // build a proper absolute product URL
        const baseUrl = location.origin.startsWith('file://') ? 'http://localhost:8000' : location.origin;
        const productUrl = new URL(`product.html?id=${p.id}`, baseUrl).href;
        // send message with product name and clickable URL separated
        const message = `${p.name}\n\n${productUrl}`;
        const encodedMessage = encodeURIComponent(message);
        const url = `https://wa.me/${phone}?text=${encodedMessage}`;
        window.open(url, '_blank', 'noopener');
    }
}

// open generic chat (header link already opens WA directly, but helper available)
function contactWhatsAppGeneral() {
    const phone = getPhoneIntlNoPlus();
    window.open(`https://wa.me/${phone}`, '_blank', 'noopener');
}

// Contact phone helpers. Local storage keeps the most recent value available
// while Firestore is loading; Firestore is the shared source of truth.
const CONTACT_PHONE_KEY = 'contact_phone_v1';
const DEFAULT_CONTACT_PHONE = '0768770090';
const CONTACT_SETTINGS_COLLECTION = 'settings';
const CONTACT_SETTINGS_DOCUMENT = 'contact';
function getStoredPhoneRaw() { return localStorage.getItem(CONTACT_PHONE_KEY) || '0768770090'; }
function setStoredPhoneRaw(v) { if (v === null) localStorage.removeItem(CONTACT_PHONE_KEY); else localStorage.setItem(CONTACT_PHONE_KEY, String(v || '').trim()); }
function getPhoneDigits(raw) { return String(raw || '').replace(/\D/g, ''); }
function getPhoneIntlNoPlus() {
    const raw = getStoredPhoneRaw();
    let d = getPhoneDigits(raw);
    if (!d) return '254768770090';
    if (d.startsWith('0')) d = '254' + d.slice(1);
    if (d.startsWith('+')) d = d.replace(/^\+/, '');
    return d;
}
function getPhoneDisplay() { return getStoredPhoneRaw() || '0768770090'; }

async function saveContactPhone(phone) {
    const value = String(phone || '').trim();
    if (getPhoneDigits(value).length < 7) throw new Error('Enter a valid contact phone number.');
    await db.collection(CONTACT_SETTINGS_COLLECTION).doc(CONTACT_SETTINGS_DOCUMENT).set({
        phone: value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function deleteContactPhone() {
    await db.collection(CONTACT_SETTINGS_COLLECTION).doc(CONTACT_SETTINGS_DOCUMENT).delete();
}

// Update any DOM elements that show the contact phone
function applyContactPhoneToDOM() {
    const display = getPhoneDisplay();
    const intl = getPhoneIntlNoPlus();
    // update elements with class contact-number
    document.querySelectorAll('.contact-number').forEach(el => {
        el.textContent = display;
        if (el.tagName === 'A') {
            el.href = `tel:+${intl}`;
        }
    });
    // update phone-link anchors
    document.querySelectorAll('.phone-link').forEach(a => {
        try { a.href = `tel:+${intl}`; a.textContent = `Call: ${display}`; } catch (e) {}
    });
    document.querySelectorAll('.phone-action').forEach(a => {
        try { a.href = `tel:+${intl}`; } catch (e) {}
    });
    // update whatsapp-link text
    document.querySelectorAll('.whatsapp-link').forEach(a => {
        try { a.textContent = `WhatsApp: ${display}`; } catch (e) {}
    });
    const adminInput = document.getElementById('admin-phone-input');
    if (adminInput && document.activeElement !== adminInput) adminInput.value = display;
}

function subscribeToContactPhone() {
    db.collection(CONTACT_SETTINGS_COLLECTION).doc(CONTACT_SETTINGS_DOCUMENT).onSnapshot(snapshot => {
        const contact = snapshot.exists ? snapshot.data() : null;
        setStoredPhoneRaw(contact && contact.phone ? contact.phone : null);
        applyContactPhoneToDOM();
    }, error => {
        console.error('Firestore contact settings error:', error);
        applyContactPhoneToDOM();
    });
}

window.addEventListener('DOMContentLoaded', () => {
    applyContactPhoneToDOM();
    subscribeToContactPhone();
});

// Show a small admin confirmation popup (modal) with a message and OK button
function showAdminPopup(message) {
        let modal = document.getElementById('admin-popup');
        if (!modal) {
                modal = document.createElement('div');
                modal.id = 'admin-popup';
                modal.className = 'modal';
                modal.setAttribute('aria-hidden', 'true');
                modal.innerHTML = `
                        <div class="modal-overlay"></div>
                        <div class="modal-dialog" role="dialog" aria-modal="true">
                            <button class="modal-close" aria-label="Close">✕</button>
                            <div class="modal-body">
                                <div style="padding:12px 6px; max-width:420px;"></div>
                            </div>
                            <div style="display:flex; justify-content:center; padding:12px;">
                                <button id="admin-popup-ok" class="add-btn">OK</button>
                            </div>
                        </div>`;
                document.body.appendChild(modal);
                modal.querySelector('.modal-close').addEventListener('click', () => { modal.setAttribute('aria-hidden', 'true'); document.body.classList.remove('modal-open'); });
                modal.querySelector('#admin-popup-ok').addEventListener('click', () => { modal.setAttribute('aria-hidden', 'true'); document.body.classList.remove('modal-open'); });
        }
        const body = modal.querySelector('.modal-body > div');
        if (body) body.textContent = message;
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
}

// Determine a product id if the user is currently viewing one
function getCurrentViewedProductId() {
    // priority: quick-view modal -> product page URL / history
    if (typeof modalCurrentId !== 'undefined' && modalCurrentId) return modalCurrentId;

    try {
        // check history state
        if (history.state && history.state.id) return history.state.id;
        // fallback to url query
        const search = new URLSearchParams(window.location.search);
        const idStr = search.get('id');
        if (idStr) return parseInt(idStr, 10);
    } catch (e) { /* ignore */ }

    return null;
}

// header/context-aware WhatsApp button — if viewing a product, open product chat with details
function contactWhatsAppAuto() {
    const pid = getCurrentViewedProductId();
    if (pid) return contactWhatsAppForProduct(pid);
    return contactWhatsAppGeneral();
}

// Contact popover toggle + helpers
function toggleContactPopover() {
    const pop = document.getElementById('contact-popover');
    if (!pop) return;
    const open = pop.getAttribute('aria-hidden') === 'false';
    pop.setAttribute('aria-hidden', open ? 'true' : 'false');
}

// copy phone or whatsapp number to clipboard
function copyContact(type, btnEl) {
    const phone = getPhoneDisplay();
    let text = phone;
    if (type === 'whatsapp') text = `WhatsApp: ${phone}`;
    try {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard');
            // show quick visual feedback on the button
            if (btnEl && btnEl.classList) {
                btnEl.classList.add('copy-ok');
                const orig = btnEl.textContent;
                btnEl.textContent = 'Copied';
                setTimeout(() => {
                    btnEl.classList.remove('copy-ok');
                    btnEl.textContent = orig;
                }, 1400);
            }
        });
    } catch (e) {
        // fallback: prompt
        window.prompt('Copy contact', text);
    }
}

// close popover when clicking outside
document.addEventListener('click', (e) => {
    const pop = document.getElementById('contact-popover');
    if (!pop) return;
    const isOpen = pop.getAttribute('aria-hidden') === 'false';
    if (!isOpen) return;
    // if click inside popover or on any contact-link, ignore
    if (pop.contains(e.target) || (e.target.closest && e.target.closest('.contact-link'))) return;
    pop.setAttribute('aria-hidden', 'true');
});

// Set the product main image (used on product page)
function setProductMainImage(url) {
    const main = document.getElementById('main-img');
    if (main) main.src = url;
    // update active thumb highlight
    const thumbs = document.querySelectorAll('.thumb');
    thumbs.forEach(t => {
        if (t.getAttribute('data-src') === url) t.classList.add('active'); else t.classList.remove('active');
    });
}

// Add multiple items to cart at once
function addMultipleToCart(productId, qty) {
    qty = parseInt(qty || 1, 10) || 1;
    // add up to available stock in a single operation
    const available = getAvailableStock(productId);
    const toAdd = Math.min(qty, available);
    if (toAdd <= 0) { showToast('This item is out of stock'); return; }

    const prod = products.find(x => String(x.id) === String(productId));
    if (!prod) return;

    const found = cart.find(i => i.id === prod.id);
    if (found) {
        found.qty = Math.min(prod.stock, found.qty + toAdd);
    } else {
        cart.push({ id: prod.id, name: prod.name, price: prod.price, qty: toAdd });
    }

    saveCart();
    renderCart();
    if (container) applyFilters();
    showToast(`Added ${toAdd} item${toAdd>1?'s':''}`);
}

// update product page stock UI if visible
function updatePageStockUI() {
    try {
        const pid = getCurrentViewedProductId();
        if (!pid) return;
        const pageStockEl = document.getElementById('page-stock');
        if (pageStockEl) pageStockEl.textContent = getAvailableStock(pid);
        // update the product page add button availability
        const addBtn = document.querySelector('#product-detail .add-btn');
        if (addBtn) addBtn.disabled = getAvailableStock(pid) <= 0;
    } catch (e) { /* ignore */ }
}

// small helper to modify quantity inputs by id
function modQty(delta, inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    let v = parseInt(el.value || '1', 10) + delta;
    if (v < 1) v = 1;
    el.value = v;
}

// Update user status in the header from Firebase Authentication and Firestore.
async function updateUserStatus() {
    const userStatusEl = document.getElementById('user-status');
    if (!userStatusEl) return;

    const user = auth.currentUser;
    const profile = await getCurrentUserProfile();

    if (user && profile) {
        const label = (profile.name || user.email || 'My Account').split('@')[0];
        userStatusEl.innerHTML = `<a href="user-account.html" class="user-link" aria-label="Open account for ${label}"><span class="user-link-label">My account</span><span class="user-link-name">${label}</span></a>`;
    } else {
        userStatusEl.innerHTML = '<a href="user-auth.html" class="icon-btn">Account</a>';
    }
}

// Initial display: load cart and product catalog from local storage.
loadCart();
renderCart();

async function initializeStore() {
    products = await loadProductsFromFirestore();

    products.forEach((p, i) => {
        if (!p.id) p.id = i + 1;
        if (typeof p.stock === "undefined") {
            p.stock = 30;
        }
    });

    if (container && typeof applyFilters === "function") {
        applyFilters();
    }

    if (typeof renderCart === "function") {
        renderCart();
    }

    db.collection('products').onSnapshot(snapshot => {
        products = snapshot.docs.map(doc => {
            const productData = doc.data();
            return {
                ...productData,
                id: productData.id || doc.id,
                firestoreId: doc.id,
                price: Number(productData.price) || 0,
                stock: Number(productData.stock) || 0
            };
        });
        products.sort((a, b) => Number(a.id) - Number(b.id));
        if (container) applyFilters();
        renderCart();
    }, error => console.error('Firestore product listener error:', error));
}

window.storeReady = initializeStore();

// Update user status on page load and when the local account changes.
auth.onAuthStateChanged(() => updateUserStatus());

// if storefront opened with ?admin=1 show quick admin hints (category-edit icons)
try {
    const qs = new URLSearchParams(location.search);
    if (qs.get('admin') === '1') {
        const header = document.querySelector('.site-header');
        if (header) header.classList.add('admin-mode');
    }
} catch (e) { /* ignore */ }

// keep multiple tabs/windows in sync when an admin edits products
window.addEventListener('storage', (e) => {
    if (e.key === PRODUCT_STORAGE_KEY) console.warn('Ignoring obsolete local product cache');
});

function sortProducts(value) {
    currentSort = value;
    applyFilters();
}

// Mobile navigation toggle
function toggleMobileNav() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    header.classList.toggle('nav-open');
}

// --- Quick view modal functions ---
let modalCurrentId = null;
function showProductModal(productId) {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    modalCurrentId = productId;

    const modal = document.getElementById('quick-view');
    modal.setAttribute('aria-hidden', 'false');
    // lock background scroll while modal is open
    document.body.classList.add('modal-open');

    document.getElementById('modal-image').src = p.image || 'https://via.placeholder.com/360x320?text=Product';
    document.getElementById('modal-image').alt = p.name;
    document.getElementById('modal-title').textContent = p.name;
    document.getElementById('modal-category').textContent = p.category || '';
    const modalPriceContainer = document.getElementById('modal-price-container');
    if (modalPriceContainer) {
        modalPriceContainer.innerHTML = p.price ? 'Ksh <span id="modal-price">' + p.price + '</span>' : 'Ask owner for price';
    }
    document.getElementById('modal-desc').textContent = p.description || 'Nice product from Hawa Dennis — available in multiple sizes and colors.';

    // reset qty
    const qty = document.getElementById('modal-qty');
    if (qty) qty.value = 1;

    // trap focus lightly by focusing dialog first focusable
    setTimeout(() => {
        const closeBtn = document.querySelector('.modal-close');
        if (closeBtn) closeBtn.focus();
    }, 50);
}

function closeProductModal() {
    const modal = document.getElementById('quick-view');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modalCurrentId = null;

    // restore page scroll
    document.body.classList.remove('modal-open');
}

function modalChangeQty(delta) {
    const el = document.getElementById('modal-qty');
    if (!el) return;
    let v = parseInt(el.value || '1', 10) + delta;
    if (v < 1) v = 1;
    el.value = v;
}

function modalAddToCart() {
    const qty = parseInt(document.getElementById('modal-qty').value || '1', 10);
    if (!modalCurrentId) return;

    const prod = products.find(x => String(x.id) === String(modalCurrentId));
    if (!prod) return;

    // add multiple qty with stock checks
    addMultipleToCart(prod.id, qty);
    // keep the modal open briefly then close
    setTimeout(closeProductModal, 450);
}

// close modal on Escape as well
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('quick-view');
        if (modal && modal.getAttribute('aria-hidden') === 'false') closeProductModal();
    }
});

// close mobile nav with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const header = document.querySelector('.site-header');
        if (header && header.classList.contains('nav-open')) header.classList.remove('nav-open');
    }
});

// FILTER BY CATEGORY
function filterCategory(category) {
    currentCategory = category;
    applyFilters();
    document.querySelectorAll('.category-scroll .cat-item').forEach(item => {
        const itemCategory = item.childNodes[0] && item.childNodes[0].textContent.trim();
        item.classList.toggle('selected', itemCategory === category);
    });
    const productsSection = document.getElementById('products');
    if (productsSection) productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function searchProducts() {
    const q = document.getElementById('search-bar').value || '';
    currentSearch = q.trim().toLowerCase();
    applyFilters();
}

function applyFilters() {
    let filtered = products.slice();

    if (currentCategory && currentCategory !== 'All') {
        filtered = filtered.filter(p => p.category === currentCategory);
    }

    if (currentSearch) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(currentSearch) || (p.category && p.category.toLowerCase().includes(currentSearch)) );
    }

    // apply sorting
    if (currentSort === 'price-low') filtered.sort((a,b) => a.price - b.price);
    if (currentSort === 'price-high') filtered.sort((a,b) => b.price - a.price);

displayProducts(filtered);
}

// Local account flow:
// registration/login/logout uses browser localStorage so the storefront can
// keep working as a static app without any backend service.

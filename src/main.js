import { createAdminController } from './admin.js';
import { createOrder, fetchProducts } from './api.js';
import { CATEGORY_LABELS, formatPriceUZS } from './data.js';

function el(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = String(text);
  return node;
}

const state = {
  products: [],
  loading: true,
  loadError: null,
  activeCategory: 'all',
  searchQuery: '',
  sortBy: 'featured',
  cart: [],
  lastOrderReceipt: null,
};

// Elements
const categoryTabsEl = document.getElementById('category-tabs');
const catalogCountEl = document.getElementById('catalog-count');
const productGridEl = document.getElementById('product-grid');
const searchInputEl = document.getElementById('catalog-search');
const sortSelectEl = document.getElementById('catalog-sort');
const headerCartCountEl = document.getElementById('header-cart-count');
const mobileCartCountEl = document.getElementById('mobile-cart-count');

const menuDrawerEl = document.getElementById('menu-drawer');
const menuBackdropEl = document.getElementById('menu-backdrop');
const menuDrawerBodyEl = document.getElementById('menu-drawer-body');
const closeMenuBtn = document.getElementById('close-menu-btn');

const productModalEl = document.getElementById('product-modal');
const productModalBackdropEl = document.getElementById('product-modal-backdrop');
const productModalContentEl = document.getElementById('product-modal-content');

const cartDrawerEl = document.getElementById('cart-drawer');
const cartBackdropEl = document.getElementById('cart-backdrop');
const cartDrawerBodyEl = document.getElementById('cart-drawer-body');
const cartSubtitleEl = document.getElementById('cart-subtitle');
const closeCartBtn = document.getElementById('close-cart-btn');

const toastRegionEl = document.getElementById('toast-region');

function showToast(message, type = 'success') {
  const toast = el(
    'div',
    `pointer-events-auto px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-medium transition-opacity ${
      type === 'error'
        ? 'bg-red-950 text-white border-red-800'
        : type === 'info'
          ? 'bg-[#0B0B0D] text-white border-white/15'
          : 'bg-[#0B0B0D] text-white border-[#E24700]'
    }`,
    message
  );
  toastRegionEl.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

const adminController = createAdminController({
  onProductsChanged: (updatedProducts) => {
    state.products = updatedProducts;
    renderCategoryTabs();
    renderProductGrid();
    renderMenuDrawer();
  },
  showToast,
});

// Drawer & Modal toggles
function openMenuDrawer() {
  renderMenuDrawer();
  menuDrawerEl.classList.remove('hidden');
  menuDrawerEl.setAttribute('aria-hidden', 'false');
}
function closeMenuDrawer() {
  menuDrawerEl.classList.add('hidden');
  menuDrawerEl.setAttribute('aria-hidden', 'true');
}

function openCartDrawer() {
  renderCartDrawer();
  cartDrawerEl.classList.remove('hidden');
  cartDrawerEl.classList.add('flex');
  cartDrawerEl.setAttribute('aria-hidden', 'false');
}
function closeCartDrawer() {
  cartDrawerEl.classList.add('hidden');
  cartDrawerEl.classList.remove('flex');
  cartDrawerEl.setAttribute('aria-hidden', 'true');
}

function closeProductModal() {
  productModalEl.classList.add('hidden');
  productModalEl.classList.remove('flex');
  productModalEl.setAttribute('aria-hidden', 'true');
}

// Navigation triggers
document.getElementById('nav-menu-btn').addEventListener('click', openMenuDrawer);
document.getElementById('hero-menu-btn').addEventListener('click', openMenuDrawer);
document.getElementById('footer-menu-btn').addEventListener('click', openMenuDrawer);
document.getElementById('mobile-menu-btn').addEventListener('click', openMenuDrawer);
closeMenuBtn.addEventListener('click', closeMenuDrawer);
menuBackdropEl.addEventListener('click', closeMenuDrawer);

document.getElementById('open-cart-btn').addEventListener('click', openCartDrawer);
document.getElementById('mobile-cart-btn').addEventListener('click', openCartDrawer);
closeCartBtn.addEventListener('click', closeCartDrawer);
cartBackdropEl.addEventListener('click', closeCartDrawer);

function handleOpenAdmin() {
  adminController.setProducts(state.products);
  adminController.open();
}

document.getElementById('nav-admin-btn').addEventListener('click', handleOpenAdmin);
document.getElementById('footer-admin-btn').addEventListener('click', handleOpenAdmin);
document.getElementById('mobile-admin-btn').addEventListener('click', handleOpenAdmin);
document.getElementById('menu-open-admin-btn').addEventListener('click', () => {
  closeMenuDrawer();
  handleOpenAdmin();
});

productModalBackdropEl.addEventListener('click', closeProductModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeMenuDrawer();
    closeCartDrawer();
    closeProductModal();
    adminController.close();
  }
});

// Cart Logic
function getCartCount() {
  return state.cart.reduce((sum, item) => sum + item.qty, 0);
}

function getCartTotal() {
  return state.cart.reduce((sum, item) => {
    const prod = state.products.find((p) => p.id === item.productId);
    return sum + (prod ? prod.price * item.qty : 0);
  }, 0);
}

function updateCartBadges() {
  const count = getCartCount();
  headerCartCountEl.textContent = String(count);
  mobileCartCountEl.textContent = String(count);
  cartSubtitleEl.textContent = `${count} ta mahsulot tanlangan`;
}

function addToCart(product, variant = null, color = null, openAfter = false) {
  if (!product.inStock) {
    showToast('Bu mahsulot hozirda sotuvda mavjud emas.', 'error');
    return;
  }
  state.lastOrderReceipt = null;
  const chosenVariant = variant || product.variants?.[0] || 'Standart';
  const chosenColor = color || product.colors?.[0] || '';
  const existing = state.cart.find(
    (c) => c.productId === product.id && c.variant === chosenVariant && c.color === chosenColor
  );
  if (existing) {
    existing.qty = Math.min(20, existing.qty + 1);
  } else {
    state.cart.push({
      productId: product.id,
      variant: chosenVariant,
      color: chosenColor,
      qty: 1,
    });
  }
  updateCartBadges();
  showToast(`"${product.name}" savatga qo‘shildi.`, 'success');
  if (openAfter) {
    openCartDrawer();
  }
}

function updateCartItemQty(index, delta) {
  const item = state.cart[index];
  if (!item) return;
  const nextQty = item.qty + delta;
  if (nextQty <= 0) {
    state.cart.splice(index, 1);
  } else {
    item.qty = Math.min(20, nextQty);
  }
  updateCartBadges();
  renderCartDrawer();
}

// Filtering & Sorting
function getFilteredProducts() {
  const q = state.searchQuery.trim().toLowerCase();
  let list = state.products.filter((p) => {
    const matchesCat = state.activeCategory === 'all' || p.category === state.activeCategory;
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.specs.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  if (state.sortBy === 'price-asc') {
    list = [...list].sort((a, b) => a.price - b.price);
  } else if (state.sortBy === 'price-desc') {
    list = [...list].sort((a, b) => b.price - a.price);
  } else {
    list = [...list].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  }
  return list;
}

searchInputEl.addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  renderProductGrid();
});

sortSelectEl.addEventListener('change', (e) => {
  state.sortBy = e.target.value;
  renderProductGrid();
});

function renderCategoryTabs() {
  categoryTabsEl.replaceChildren();
  const keys = Object.keys(CATEGORY_LABELS);
  keys.forEach((key) => {
    const isActive = state.activeCategory === key;
    const btn = el(
      'button',
      `min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
        isActive
          ? 'bg-white text-[#0B0B0D] shadow-xs font-semibold'
          : 'text-[#52525B] hover:text-[#0B0B0D]'
      }`,
      CATEGORY_LABELS[key]
    );
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.addEventListener('click', () => {
      state.activeCategory = key;
      renderCategoryTabs();
      renderProductGrid();
    });
    categoryTabsEl.appendChild(btn);
  });
}

function createProductImage(product, aspectClass = 'aspect-[4/3]') {
  const frame = el('div', `relative w-full ${aspectClass} bg-[#F4F4F6] overflow-hidden`);
  const img = document.createElement('img');
  img.src = product.image;
  img.alt = product.name;
  img.referrerPolicy = 'no-referrer';
  img.loading = 'lazy';
  img.className = 'w-full h-full object-cover';

  const fallback = el(
    'div',
    'hidden absolute inset-0 flex-col items-center justify-center gap-1.5 bg-[#F4F4F6] text-[#52525B] p-4 text-center'
  );
  fallback.append(
    el('span', 'font-display font-semibold text-sm text-[#0B0B0D]', product.name),
    el('span', 'text-xs text-[#71717A]', product.category)
  );

  img.addEventListener('error', () => {
    img.style.display = 'none';
    fallback.style.display = 'flex';
  });

  frame.append(img, fallback);
  return frame;
}

function renderProductGrid() {
  productGridEl.replaceChildren();

  if (state.loading) {
    catalogCountEl.textContent = 'Yuklanmoqda...';
    for (let i = 0; i < 6; i += 1) {
      const skel = el('div', 'rounded-2xl border border-black/10 bg-white overflow-hidden animate-pulse');
      skel.append(
        el('div', 'aspect-[4/3] bg-[#F4F4F6]'),
        el('div', 'p-5 space-y-3')
      );
      productGridEl.appendChild(skel);
    }
    return;
  }

  if (state.loadError) {
    catalogCountEl.textContent = 'Xatolik';
    const errCard = el(
      'div',
      'col-span-full p-8 rounded-2xl border border-red-200 bg-red-50 text-center space-y-3'
    );
    errCard.append(
      el('p', 'text-sm font-medium text-red-900', state.loadError),
      (() => {
        const retryBtn = el(
          'button',
          'min-h-[42px] px-4 py-2 rounded-lg bg-[#0B0B0D] text-white text-xs font-semibold cursor-pointer',
          'Qayta urinish'
        );
        retryBtn.type = 'button';
        retryBtn.addEventListener('click', loadCatalog);
        return retryBtn;
      })()
    );
    productGridEl.appendChild(errCard);
    return;
  }

  const list = getFilteredProducts();
  catalogCountEl.textContent = `${list.length} ta mahsulot`;

  if (list.length === 0) {
    const empty = el(
      'div',
      'col-span-full p-12 rounded-2xl border border-black/10 bg-[#FAFAFB] text-center space-y-3'
    );
    empty.append(
      el('p', 'font-display text-lg font-semibold text-[#0B0B0D]', 'Mos mahsulot topilmadi'),
      el('p', 'text-sm text-[#52525B]', 'Qidiruv so‘rovini o‘zgartiring yoki barcha toifalarni tanlang.')
    );
    const resetBtn = el(
      'button',
      'min-h-[42px] px-4 py-2 rounded-lg bg-[#E24700] text-white text-xs font-semibold cursor-pointer',
      'Barchasini ko‘rsatish'
    );
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', () => {
      state.activeCategory = 'all';
      state.searchQuery = '';
      searchInputEl.value = '';
      renderCategoryTabs();
      renderProductGrid();
    });
    empty.appendChild(resetBtn);
    productGridEl.appendChild(empty);
    return;
  }

  list.forEach((product) => {
    const card = el(
      'article',
      'product-card rounded-2xl border border-black/10 bg-white overflow-hidden flex flex-col'
    );

    const imageBtn = el('button', 'block w-full text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E24700]');
    imageBtn.type = 'button';
    imageBtn.setAttribute('aria-label', `${product.name} haqida batafsil`);
    imageBtn.appendChild(createProductImage(product, 'aspect-[4/3]'));
    imageBtn.addEventListener('click', () => openProductModal(product));

    const body = el('div', 'p-5 flex-1 flex flex-col');

    // Clean unboxed metadata (zero-pill rule)
    const metaRow = el('div', 'flex items-center justify-between gap-2 text-xs text-[#52525B] mb-1.5');
    metaRow.append(
      el('span', 'font-medium', `${product.category} · ${product.variants?.[0] || 'Standart'}`),
      el(
        'span',
        `font-medium ${product.inStock ? 'text-[#0B0B0D]' : 'text-[#71717A]'}`,
        product.inStock ? 'Mavjud' : 'Tugagan'
      )
    );

    const titleBtn = el(
      'button',
      'text-left font-display text-lg font-bold text-[#0B0B0D] hover:text-[#E24700] transition-colors mb-1.5 cursor-pointer',
      product.name
    );
    titleBtn.type = 'button';
    titleBtn.addEventListener('click', () => openProductModal(product));

    const specs = el('p', 'text-xs text-[#52525B] leading-relaxed mb-4 line-clamp-2', product.specs);

    const footer = el('div', 'mt-auto pt-4 border-t border-black/8 flex items-center justify-between gap-3');
    const price = el(
      'span',
      'font-display text-base sm:text-lg font-bold text-[#0B0B0D] tabular-nums',
      formatPriceUZS(product.price)
    );

    const btnGroup = el('div', 'flex items-center gap-2 shrink-0');
    const detailsBtn = el(
      'button',
      'min-h-[42px] px-3 py-2 rounded-lg border border-black/15 hover:bg-[#F4F4F6] text-xs font-semibold text-[#0B0B0D] transition-colors cursor-pointer whitespace-nowrap',
      'Batafsil'
    );
    detailsBtn.type = 'button';
    detailsBtn.addEventListener('click', () => openProductModal(product));

    const addBtn = el(
      'button',
      `min-h-[42px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
        product.inStock
          ? 'bg-[#E24700] hover:bg-[#C93E00] text-white cursor-pointer'
          : 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
      }`,
      product.inStock ? 'Savatga' : 'Tugagan'
    );
    addBtn.type = 'button';
    addBtn.disabled = !product.inStock;
    addBtn.addEventListener('click', () => addToCart(product));

    btnGroup.append(detailsBtn, addBtn);
    footer.append(price, btnGroup);
    body.append(metaRow, titleBtn, specs, footer);
    card.append(imageBtn, body);
    productGridEl.appendChild(card);
  });
}

function renderMenuDrawer() {
  menuDrawerBodyEl.replaceChildren();

  const catSection = el('div', 'space-y-2');
  catSection.appendChild(el('p', 'text-xs font-semibold text-[#9E9EA8] mb-2', 'Toifalar bo‘yicha tanlash'));

  Object.keys(CATEGORY_LABELS).forEach((key) => {
    const count =
      key === 'all'
        ? state.products.length
        : state.products.filter((p) => p.category === key).length;
    const isActive = state.activeCategory === key;
    const btn = el(
      'button',
      `w-full min-h-[48px] px-4 py-3 rounded-xl flex items-center justify-between text-sm font-medium transition-colors cursor-pointer ${
        isActive ? 'bg-[#E24700] text-white' : 'bg-white/5 hover:bg-white/10 text-white'
      }`
    );
    btn.type = 'button';
    btn.append(
      el('span', '', CATEGORY_LABELS[key]),
      el('span', 'font-mono text-xs opacity-80 tabular-nums', `${count}`)
    );
    btn.addEventListener('click', () => {
      state.activeCategory = key;
      renderCategoryTabs();
      renderProductGrid();
      closeMenuDrawer();
      document.getElementById('katalog').scrollIntoView({ behavior: 'smooth' });
    });
    catSection.appendChild(btn);
  });

  const featuredSection = el('div', 'pt-4 border-t border-white/10 space-y-2.5');
  featuredSection.appendChild(el('p', 'text-xs font-semibold text-[#9E9EA8]', 'Ommabop modellar'));

  state.products.slice(0, 4).forEach((product) => {
    const row = el(
      'button',
      'w-full min-h-[56px] p-3 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer'
    );
    row.type = 'button';
    const info = el('div', 'min-w-0');
    info.append(
      el('p', 'text-sm font-semibold text-white truncate', product.name),
      el('p', 'text-xs text-[#FF6B2B] tabular-nums', formatPriceUZS(product.price))
    );
    row.append(info, el('span', 'text-xs text-[#9E9EA8] shrink-0', 'Tanlash'));
    row.addEventListener('click', () => {
      closeMenuDrawer();
      openProductModal(product);
    });
    featuredSection.appendChild(row);
  });

  menuDrawerBodyEl.append(catSection, featuredSection);
}

function openProductModal(product) {
  let selectedVariant = product.variants?.[0] || 'Standart';
  let selectedColor = product.colors?.[0] || '';

  function renderModal() {
    productModalContentEl.replaceChildren();

    const header = el('div', 'flex items-start justify-between gap-4 mb-4');
    const titleWrap = el('div');
    titleWrap.append(
      el('p', 'text-xs font-semibold text-[#E24700] mb-1', product.category),
      el('h3', 'font-display text-xl sm:text-2xl font-bold text-[#0B0B0D]', product.name)
    );
    const closeBtn = el(
      'button',
      'min-w-[44px] min-h-[44px] rounded-lg border border-black/10 hover:bg-[#F4F4F6] flex items-center justify-center cursor-pointer shrink-0',
      '✕'
    );
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Yopish');
    closeBtn.addEventListener('click', closeProductModal);
    header.append(titleWrap, closeBtn);

    const grid = el('div', 'grid grid-cols-1 md:grid-cols-2 gap-6');
    const imgWrap = createProductImage(product, 'aspect-[4/3] rounded-xl');

    const details = el('div', 'flex flex-col space-y-4');
    details.append(
      el('p', 'text-sm text-[#27272A] leading-relaxed', product.description || product.specs),
      el('p', 'text-xs text-[#52525B] pb-3 border-b border-black/10', product.specs)
    );

    if (product.variants?.length) {
      const varWrap = el('div', 'space-y-2');
      varWrap.appendChild(el('p', 'text-xs font-semibold text-[#0B0B0D]', 'Variant / Xotira'));
      const varBtns = el('div', 'flex flex-wrap gap-2');
      product.variants.forEach((v) => {
        const active = selectedVariant === v;
        const b = el(
          'button',
          `min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
            active ? 'bg-[#0B0B0D] text-white border-[#0B0B0D]' : 'bg-[#F4F4F6] text-[#0B0B0D] border-black/10'
          }`,
          v
        );
        b.type = 'button';
        b.addEventListener('click', () => {
          selectedVariant = v;
          renderModal();
        });
        varBtns.appendChild(b);
      });
      varWrap.appendChild(varBtns);
      details.appendChild(varWrap);
    }

    if (product.colors?.length) {
      const colWrap = el('div', 'space-y-2');
      colWrap.appendChild(el('p', 'text-xs font-semibold text-[#0B0B0D]', 'Rangi'));
      const colBtns = el('div', 'flex flex-wrap gap-2');
      product.colors.forEach((c) => {
        const active = selectedColor === c;
        const b = el(
          'button',
          `min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
            active ? 'bg-[#E24700] text-white border-[#E24700]' : 'bg-[#F4F4F6] text-[#0B0B0D] border-black/10'
          }`,
          c
        );
        b.type = 'button';
        b.addEventListener('click', () => {
          selectedColor = c;
          renderModal();
        });
        colBtns.appendChild(b);
      });
      colWrap.appendChild(colBtns);
      details.appendChild(colWrap);
    }

    const purchaseBox = el('div', 'mt-auto pt-4 border-t border-black/10 space-y-3');
    purchaseBox.appendChild(
      el('p', 'font-display text-2xl font-bold text-[#0B0B0D] tabular-nums', formatPriceUZS(product.price))
    );

    const actionRow = el('div', 'grid grid-cols-2 gap-2.5');
    const addCartBtn = el(
      'button',
      'min-h-[46px] px-4 py-2.5 rounded-lg border border-[#0B0B0D] text-[#0B0B0D] hover:bg-[#F4F4F6] text-xs sm:text-sm font-semibold cursor-pointer',
      'Savatga qo‘shish'
    );
    addCartBtn.type = 'button';
    addCartBtn.disabled = !product.inStock;
    addCartBtn.addEventListener('click', () => {
      addToCart(product, selectedVariant, selectedColor, false);
      closeProductModal();
    });

    const buyNowBtn = el(
      'button',
      'min-h-[46px] px-4 py-2.5 rounded-lg bg-[#E24700] hover:bg-[#C93E00] text-white text-xs sm:text-sm font-semibold cursor-pointer',
      'Tezkor buyurtma'
    );
    buyNowBtn.type = 'button';
    buyNowBtn.disabled = !product.inStock;
    buyNowBtn.addEventListener('click', () => {
      closeProductModal();
      addToCart(product, selectedVariant, selectedColor, true);
    });

    actionRow.append(addCartBtn, buyNowBtn);
    purchaseBox.appendChild(actionRow);
    details.appendChild(purchaseBox);

    grid.append(imgWrap, details);
    productModalContentEl.append(header, grid);
  }

  renderModal();
  productModalEl.classList.remove('hidden');
  productModalEl.classList.add('flex');
  productModalEl.setAttribute('aria-hidden', 'false');
}

function renderCartDrawer() {
  cartDrawerBodyEl.replaceChildren();

  if (state.lastOrderReceipt) {
    const { order, telegramSent, telegramError } = state.lastOrderReceipt;
    const receipt = el('div', 'space-y-5');
    const box = el('div', 'p-5 rounded-2xl bg-[#0B0B0D] text-white space-y-2');
    box.append(
      el('p', 'text-xs font-semibold text-[#FF6B2B]', 'Buyurtma tasdiqlandi'),
      el('h3', 'font-display text-2xl font-bold tabular-nums', `Buyurtma #${order.id}`),
      el(
        'p',
        'text-sm text-[#B4B4BC] leading-relaxed',
        `${order.customerName}, buyurtmangiz qabul qilindi. Tez orada ${order.phone} raqamiga bog‘lanamiz.`
      )
    );

    const tgStatus = el(
      'div',
      `p-3.5 rounded-xl border text-xs font-medium ${
        telegramSent
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-amber-50 border-amber-200 text-amber-800'
      }`,
      telegramSent
        ? 'Buyurtma tafsilotlari real vaqt rejimida Telegram kanalga yuborildi.'
        : `Buyurtma tizimda saqlandi. Telegram holati: ${telegramError || 'Token sozlanmagan'}`
    );

    const summary = el('div', 'border border-black/10 rounded-xl p-4 space-y-2 text-sm');
    order.items.forEach((item) => {
      const row = el('div', 'flex justify-between gap-2');
      row.append(
        el('span', 'text-[#0B0B0D]', `${item.name} (${item.variant}) × ${item.qty}`),
        el('span', 'font-mono text-xs font-semibold tabular-nums', formatPriceUZS(item.lineTotal))
      );
      summary.appendChild(row);
    });
    const totalRow = el('div', 'pt-2 border-t border-black/10 flex justify-between font-bold text-[#0B0B0D]');
    totalRow.append(
      el('span', '', 'Jami summa'),
      el('span', 'font-mono tabular-nums', formatPriceUZS(order.total))
    );
    summary.appendChild(totalRow);

    const continueBtn = el(
      'button',
      'w-full min-h-[46px] px-4 py-2.5 rounded-lg bg-[#E24700] hover:bg-[#C93E00] text-white text-sm font-semibold cursor-pointer',
      'Xaridni davom ettirish'
    );
    continueBtn.type = 'button';
    continueBtn.addEventListener('click', () => {
      state.lastOrderReceipt = null;
      closeCartDrawer();
    });

    receipt.append(box, tgStatus, summary, continueBtn);
    cartDrawerBodyEl.appendChild(receipt);
    return;
  }

  if (state.cart.length === 0) {
    const empty = el('div', 'py-16 text-center space-y-4');
    empty.append(
      el('p', 'font-display text-lg font-bold text-[#0B0B0D]', 'Savatingiz bo‘sh'),
      el('p', 'text-sm text-[#52525B]', 'Katalogdan smartfon yoki aksessuar tanlab buyurtma bering.')
    );
    const goBtn = el(
      'button',
      'min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0B0B0D] text-white text-xs font-semibold cursor-pointer',
      'Katalogga o‘tish'
    );
    goBtn.type = 'button';
    goBtn.addEventListener('click', closeCartDrawer);
    empty.appendChild(goBtn);
    cartDrawerBodyEl.appendChild(empty);
    return;
  }

  // Cart Items
  const itemsList = el('div', 'space-y-3');
  state.cart.forEach((item, index) => {
    const prod = state.products.find((p) => p.id === item.productId);
    if (!prod) return;

    const row = el('div', 'p-3.5 rounded-xl border border-black/10 bg-[#FAFAFB] flex gap-3 items-center');
    const thumb = document.createElement('img');
    thumb.src = prod.image;
    thumb.alt = prod.name;
    thumb.referrerPolicy = 'no-referrer';
    thumb.className = 'w-16 h-16 rounded-lg object-cover bg-white shrink-0';

    const info = el('div', 'flex-1 min-w-0');
    info.append(
      el('p', 'text-sm font-semibold text-[#0B0B0D] truncate', prod.name),
      el('p', 'text-xs text-[#52525B] truncate', `${item.variant}${item.color ? ` · ${item.color}` : ''}`),
      el('p', 'text-xs font-bold text-[#E24700] tabular-nums mt-1', formatPriceUZS(prod.price * item.qty))
    );

    const stepper = el('div', 'flex items-center gap-1 shrink-0');
    const minus = el(
      'button',
      'w-9 h-9 rounded-lg border border-black/10 bg-white hover:bg-[#F4F4F6] text-sm font-bold cursor-pointer',
      '−'
    );
    minus.type = 'button';
    minus.addEventListener('click', () => updateCartItemQty(index, -1));

    const qtyText = el('span', 'w-7 text-center font-mono text-xs font-semibold tabular-nums', String(item.qty));

    const plus = el(
      'button',
      'w-9 h-9 rounded-lg border border-black/10 bg-white hover:bg-[#F4F4F6] text-sm font-bold cursor-pointer',
      '+'
    );
    plus.type = 'button';
    plus.addEventListener('click', () => updateCartItemQty(index, 1));

    stepper.append(minus, qtyText, plus);
    row.append(thumb, info, stepper);
    itemsList.appendChild(row);
  });

  // Total summary
  const totalBox = el('div', 'p-4 rounded-xl bg-[#0B0B0D] text-white flex items-center justify-between');
  totalBox.append(
    el('span', 'text-xs text-[#B4B4BC]', 'Umumiy to‘lov summasi'),
    el('span', 'font-display text-lg font-bold tabular-nums', formatPriceUZS(getCartTotal()))
  );

  // Checkout Form
  const form = el('form', 'space-y-3.5 pt-4 border-t border-black/10');
  form.appendChild(el('h3', 'font-display text-base font-bold text-[#0B0B0D]', 'Onlayn buyurtma rasmiylashtirish'));

  const nameInput = document.createElement('input');
  nameInput.required = true;
  nameInput.placeholder = 'Ismingiz (masalan: Sardorbek)';
  nameInput.className = 'w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#F4F4F6] border border-black/10 text-sm';

  const phoneInput = document.createElement('input');
  phoneInput.type = 'tel';
  phoneInput.required = true;
  phoneInput.placeholder = 'Telefon (+998 90 123 45 67)';
  phoneInput.className = 'w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#F4F4F6] border border-black/10 text-sm';

  const deliverySelect = document.createElement('select');
  deliverySelect.className = 'w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#F4F4F6] border border-black/10 text-sm';
  ['Kuryer (Toshkent)', "Do'kondan olib ketish"].forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    deliverySelect.appendChild(opt);
  });

  const addressInput = document.createElement('input');
  addressInput.required = true;
  addressInput.placeholder = 'Yetkazib berish manzili (tuman, ko‘cha, uy)';
  addressInput.className = 'w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#F4F4F6] border border-black/10 text-sm';

  deliverySelect.addEventListener('change', () => {
    if (deliverySelect.value === "Do'kondan olib ketish") {
      addressInput.required = false;
      addressInput.classList.add('hidden');
    } else {
      addressInput.required = true;
      addressInput.classList.remove('hidden');
    }
  });

  const paymentSelect = document.createElement('select');
  paymentSelect.className = 'w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#F4F4F6] border border-black/10 text-sm';
  ['Naqd pul', 'Click / Payme', "Bo'lib to'lash (0%)"].forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    paymentSelect.appendChild(opt);
  });

  const noteInput = document.createElement('input');
  noteInput.placeholder = 'Qo‘shimcha izoh (ixtiyoriy)';
  noteInput.className = 'w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#F4F4F6] border border-black/10 text-sm';

  const errorBox = el('p', 'hidden text-xs font-medium text-red-700');

  const submitBtn = el(
    'button',
    'w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#E24700] hover:bg-[#C93E00] text-white text-sm font-semibold transition-colors cursor-pointer',
    'Buyurtmani tasdiqlash'
  );
  submitBtn.type = 'submit';

  form.append(nameInput, phoneInput, deliverySelect, addressInput, paymentSelect, noteInput, errorBox, submitBtn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Yuborilmoqda...';

    try {
      const result = await createOrder({
        customerName: nameInput.value,
        phone: phoneInput.value,
        deliveryMethod: deliverySelect.value,
        address: addressInput.value,
        paymentMethod: paymentSelect.value,
        note: noteInput.value,
        items: state.cart,
      });

      state.cart = [];
      state.lastOrderReceipt = result;
      updateCartBadges();
      renderCartDrawer();
      showToast(`Buyurtma #${result.order.id} qabul qilindi!`, 'success');
    } catch (err) {
      errorBox.textContent = err.message || 'Buyurtma yuborishda xatolik yuz berdi.';
      errorBox.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Buyurtmani tasdiqlash';
    }
  });

  cartDrawerBodyEl.append(itemsList, totalBox, form);
}

async function loadCatalog() {
  state.loading = true;
  state.loadError = null;
  renderProductGrid();
  try {
    const res = await fetchProducts();
    state.products = res.products || [];
    state.loading = false;
    renderCategoryTabs();
    renderProductGrid();
    renderMenuDrawer();
  } catch (err) {
    state.loading = false;
    state.loadError = err.message || 'Katalogni yuklab bo‘lmadi.';
    renderProductGrid();
  }
}

updateCartBadges();
renderCategoryTabs();
loadCatalog();

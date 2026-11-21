import {
  claimAdminPassword,
  createProduct,
  deleteProduct,
  fetchAdminStatus,
  fetchOrders,
  getAdminToken,
  loginAdmin,
  resendOrderTelegram,
  sendTelegramTest,
  setAdminToken,
  updateOrderStatus,
  updateProduct,
} from './api.js';
import { IMAGE_PRESETS, ORDER_STATUSES, formatPriceUZS } from './data.js';

function el(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = String(text);
  return node;
}

export function createAdminController({ onProductsChanged, showToast }) {
  const modal = document.getElementById('admin-modal');
  const backdrop = document.getElementById('admin-backdrop');
  const closeBtn = document.getElementById('close-admin-btn');
  const logoutBtn = document.getElementById('admin-logout-btn');
  const bodyEl = document.getElementById('admin-modal-body');

  const state = {
    activeTab: 'orders',
    statusFilter: 'Barchasi',
    adminStatus: null,
    orders: [],
    products: [],
    loading: false,
    error: null,
  };

  function open() {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.setAttribute('aria-hidden', 'false');
    loadAdminView();
  }

  function close() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modal.setAttribute('aria-hidden', 'true');
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  logoutBtn.addEventListener('click', () => {
    setAdminToken(null);
    logoutBtn.classList.add('hidden');
    loadAdminView();
    showToast('Admin sessiyasi yopildi.', 'info');
  });

  async function loadAdminView(currentProducts = null) {
    if (currentProducts) {
      state.products = currentProducts;
    }
    state.loading = true;
    state.error = null;
    render();

    try {
      state.adminStatus = await fetchAdminStatus();
      if (getAdminToken()) {
        const res = await fetchOrders();
        state.orders = res.orders || [];
        logoutBtn.classList.remove('hidden');
      } else {
        logoutBtn.classList.add('hidden');
      }
    } catch (err) {
      if (err.status === 401) {
        setAdminToken(null);
        logoutBtn.classList.add('hidden');
      } else {
        state.error = err.message || 'Ma’lumotlarni yuklashda xatolik.';
      }
    } finally {
      state.loading = false;
      render();
    }
  }

  function setProducts(products) {
    state.products = products;
    if (!modal.classList.contains('hidden') && getAdminToken() && state.activeTab === 'products') {
      render();
    }
  }

  function render() {
    bodyEl.replaceChildren();

    if (state.loading) {
      const loader = el('div', 'py-16 text-center text-sm text-[#52525B]', 'Ma’lumotlar yuklanmoqda...');
      bodyEl.appendChild(loader);
      return;
    }

    if (state.error) {
      const errBox = el('div', 'p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800', state.error);
      bodyEl.appendChild(errBox);
      return;
    }

    if (!getAdminToken()) {
      renderAuthScreen();
      return;
    }

    renderDashboard();
  }

  function renderAuthScreen() {
    const isUnclaimed = state.adminStatus?.authMode === 'unclaimed';
    const card = el(
      'div',
      'max-w-md mx-auto my-6 bg-white border border-black/10 rounded-2xl p-6 sm:p-8 shadow-sm'
    );

    const kicker = el(
      'p',
      'text-xs font-semibold text-[#E24700] mb-1',
      isUnclaimed ? 'Birinchi ishga tushirish' : 'Xavfsiz kirish'
    );
    const title = el(
      'h3',
      'font-display text-xl font-bold text-[#0B0B0D] mb-2',
      isUnclaimed ? 'Admin parolini yarating' : 'Admin panelga kirish'
    );
    const desc = el(
      'p',
      'text-sm text-[#52525B] mb-6 leading-relaxed',
      isUnclaimed
        ? 'Hali admin paroli o‘rnatilmagan. Boshqaruv panelini himoyalash uchun kamida 6 ta belgidan iborat parol kiriting.'
        : 'Buyurtmalar, mahsulotlar va Telegram kanal integratsiyasini boshqarish uchun parolni kiriting.'
    );

    const form = el('form', 'space-y-4');
    const label = el('label', 'block text-xs font-semibold text-[#0B0B0D] mb-1.5', 'Admin paroli');
    const input = document.createElement('input');
    input.type = 'password';
    input.required = true;
    input.minLength = isUnclaimed ? 6 : 1;
    input.placeholder = isUnclaimed ? 'Kamida 6 ta belgi...' : 'Parolni kiriting...';
    input.className =
      'w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#F4F4F6] border border-black/10 text-sm text-[#0B0B0D] focus:outline-none focus:border-[#E24700] focus:bg-white';

    const errorMsg = el('p', 'hidden text-xs text-red-700 font-medium');
    const submitBtn = el(
      'button',
      'w-full min-h-[46px] px-4 py-2.5 rounded-lg bg-[#E24700] hover:bg-[#C93E00] text-white text-sm font-semibold transition-colors cursor-pointer',
      isUnclaimed ? 'Parolni saqlash va kirish' : 'Kirish'
    );
    submitBtn.type = 'submit';

    form.append(label, input, errorMsg, submitBtn);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorMsg.classList.add('hidden');
      submitBtn.disabled = true;
      try {
        const res = isUnclaimed
          ? await claimAdminPassword(input.value)
          : await loginAdmin(input.value);
        setAdminToken(res.token);
        showToast('Admin panelga muvaffaqiyatli kirdingiz.', 'success');
        await loadAdminView();
      } catch (err) {
        errorMsg.textContent = err.message || 'Kirishda xatolik.';
        errorMsg.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
      }
    });

    card.append(kicker, title, desc, form);
    bodyEl.appendChild(card);
  }

  function renderDashboard() {
    // Summary Metrics Row
    const totalRevenue = state.orders
      .filter((o) => o.status !== 'Bekor qilindi')
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const newOrdersCount = state.orders.filter((o) => o.status === 'Yangi').length;
    const activeProductsCount = state.products.filter((p) => p.inStock).length;

    const metricsGrid = el('div', 'grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6');
    const metrics = [
      { label: 'Jami buyurtmalar', value: String(state.orders.length) },
      { label: 'Yangi buyurtmalar', value: String(newOrdersCount), accent: newOrdersCount > 0 },
      { label: 'Faol mahsulotlar', value: String(activeProductsCount) },
      { label: 'Umumiy savdo', value: formatPriceUZS(totalRevenue) },
    ];

    metrics.forEach((m) => {
      const box = el('div', 'bg-white border border-black/10 rounded-xl p-4');
      box.append(
        el('p', 'text-xs text-[#52525B] mb-1', m.label),
        el(
          'p',
          `font-display text-lg sm:text-xl font-bold tabular-nums ${m.accent ? 'text-[#E24700]' : 'text-[#0B0B0D]'}`,
          m.value
        )
      );
      metricsGrid.appendChild(box);
    });

    // Tab Navigation
    const tabBar = el('div', 'flex items-center gap-2 mb-6 border-b border-black/10 pb-3 overflow-x-auto');
    const tabs = [
      { id: 'orders', label: `Buyurtmalar (${state.orders.length})` },
      { id: 'products', label: `Mahsulotlar (${state.products.length})` },
      { id: 'telegram', label: 'Telegram kanal' },
    ];

    tabs.forEach((t) => {
      const isActive = state.activeTab === t.id;
      const btn = el(
        'button',
        `min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
          isActive
            ? 'bg-[#0B0B0D] text-white'
            : 'bg-white border border-black/10 text-[#52525B] hover:text-[#0B0B0D]'
        }`,
        t.label
      );
      btn.type = 'button';
      btn.addEventListener('click', () => {
        state.activeTab = t.id;
        render();
      });
      tabBar.appendChild(btn);
    });

    const refreshBtn = el(
      'button',
      'ml-auto min-h-[40px] px-3.5 py-2 rounded-lg border border-black/10 bg-white hover:bg-[#F4F4F6] text-xs font-medium text-[#0B0B0D] whitespace-nowrap shrink-0 cursor-pointer',
      'Yangilash'
    );
    refreshBtn.type = 'button';
    refreshBtn.addEventListener('click', () => loadAdminView());
    tabBar.appendChild(refreshBtn);

    bodyEl.append(metricsGrid, tabBar);

    if (state.activeTab === 'orders') {
      renderOrdersTab();
    } else if (state.activeTab === 'products') {
      renderProductsTab();
    } else {
      renderTelegramTab();
    }
  }

  function renderOrdersTab() {
    const filterRow = el('div', 'flex flex-wrap items-center gap-2 mb-4');
    ['Barchasi', ...ORDER_STATUSES].forEach((status) => {
      const active = state.statusFilter === status;
      const btn = el(
        'button',
        `min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
          active ? 'bg-[#E24700] text-white' : 'bg-white border border-black/10 text-[#52525B] hover:text-[#0B0B0D]'
        }`,
        status
      );
      btn.type = 'button';
      btn.addEventListener('click', () => {
        state.statusFilter = status;
        render();
      });
      filterRow.appendChild(btn);
    });
    bodyEl.appendChild(filterRow);

    const filtered =
      state.statusFilter === 'Barchasi'
        ? state.orders
        : state.orders.filter((o) => o.status === state.statusFilter);

    if (filtered.length === 0) {
      bodyEl.appendChild(
        el(
          'div',
          'bg-white border border-black/10 rounded-xl p-10 text-center text-sm text-[#52525B]',
          'Ushbu holat bo‘yicha buyurtmalar hali mavjud emas.'
        )
      );
      return;
    }

    const list = el('div', 'space-y-4');
    filtered.forEach((order) => {
      const card = el('div', 'bg-white border border-black/10 rounded-xl p-4 sm:p-5 space-y-4');

      // Top row: ID + Date + Status + Price
      const top = el('div', 'flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/10');
      const leftInfo = el('div', 'flex flex-wrap items-center gap-2.5');
      leftInfo.append(
        el('span', 'font-mono text-sm font-semibold text-[#0B0B0D] tabular-nums', `#${order.id}`),
        el('span', 'text-xs text-[#71717A]', '·'),
        el(
          'span',
          'text-xs text-[#52525B] tabular-nums',
          new Date(order.createdAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })
        )
      );

      const rightInfo = el('div', 'flex items-center gap-3');
      rightInfo.append(
        el('span', 'font-display text-base font-bold text-[#0B0B0D] tabular-nums', formatPriceUZS(order.total))
      );
      top.append(leftInfo, rightInfo);

      // Customer & Items grid
      const details = el('div', 'grid grid-cols-1 md:grid-cols-2 gap-4 text-sm');
      const custBox = el('div', 'space-y-1 text-xs sm:text-sm text-[#27272A]');
      custBox.append(
        el('p', 'font-semibold text-[#0B0B0D]', `${order.customerName} · ${order.phone}`),
        el('p', 'text-[#52525B]', `${order.deliveryMethod}: ${order.address}`),
        el('p', 'text-[#52525B]', `To‘lov: ${order.paymentMethod}`)
      );
      if (order.note) {
        custBox.append(el('p', 'text-[#52525B]', `Izoh: ${order.note}`));
      }

      const itemsBox = el('div', 'space-y-1.5');
      order.items.forEach((item) => {
        const row = el('div', 'flex items-center justify-between gap-2 text-xs sm:text-sm');
        row.append(
          el('span', 'text-[#0B0B0D]', `${item.name} (${item.variant}) × ${item.qty}`),
          el('span', 'font-mono text-xs text-[#52525B] tabular-nums shrink-0', formatPriceUZS(item.lineTotal))
        );
        itemsBox.appendChild(row);
      });

      details.append(custBox, itemsBox);

      // Action row: Status selector + Telegram status + Resend button
      const actions = el('div', 'flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-black/10');
      const tgInfo = el('div', 'text-xs');
      if (order.telegram?.sent) {
        tgInfo.className = 'text-xs font-medium text-emerald-700';
        tgInfo.textContent = `Telegram kanalga yuborilgan (ID: ${order.telegram.messageId || 'OK'})`;
      } else {
        tgInfo.className = 'text-xs font-medium text-amber-700';
        tgInfo.textContent = `Telegramga yuborilmadi: ${order.telegram?.error || 'Kutilmoqda'}`;
      }

      const controls = el('div', 'flex flex-wrap items-center gap-2');
      const select = document.createElement('select');
      select.className =
        'min-h-[38px] px-3 py-1.5 rounded-lg bg-[#F4F4F6] border border-black/10 text-xs font-semibold text-[#0B0B0D] cursor-pointer';
      ORDER_STATUSES.forEach((st) => {
        const opt = document.createElement('option');
        opt.value = st;
        opt.textContent = st;
        if (st === order.status) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener('change', async () => {
        try {
          const updated = await updateOrderStatus(order.id, select.value, true);
          order.status = updated.order.status;
          if (updated.telegramUpdate?.sent) {
            order.telegram = updated.telegramUpdate;
          }
          showToast(`Buyurtma #${order.id} holati "${select.value}" ga o‘zgartirildi.`, 'success');
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

      const resendBtn = el(
        'button',
        'min-h-[38px] px-3 py-1.5 rounded-lg border border-black/15 hover:bg-[#F4F4F6] text-xs font-medium text-[#0B0B0D] cursor-pointer',
        'Telegramga yuborish'
      );
      resendBtn.type = 'button';
      resendBtn.addEventListener('click', async () => {
        resendBtn.disabled = true;
        try {
          const res = await resendOrderTelegram(order.id);
          order.telegram = res.order.telegram;
          if (res.telegramResult.sent) {
            showToast(`#${order.id} Telegram kanalga yuborildi.`, 'success');
          } else {
            showToast(res.telegramResult.error || 'Yuborib bo‘lmadi.', 'error');
          }
          render();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          resendBtn.disabled = false;
        }
      });

      controls.append(select, resendBtn);
      actions.append(tgInfo, controls);

      card.append(top, details, actions);
      list.appendChild(card);
    });

    bodyEl.appendChild(list);
  }

  function renderProductsTab() {
    // Add product form
    const formCard = el('form', 'bg-white border border-black/10 rounded-xl p-4 sm:p-5 mb-6 space-y-4');
    formCard.appendChild(el('h3', 'font-display text-base font-bold text-[#0B0B0D]', 'Yangi mahsulot qo‘shish'));

    const grid = el('div', 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3');

    const nameInput = document.createElement('input');
    nameInput.placeholder = 'Model nomi (masalan: Olov X20)';
    nameInput.required = true;
    nameInput.className = 'min-h-[42px] px-3 py-2 rounded-lg bg-[#F4F4F6] border border-black/10 text-sm';

    const catSelect = document.createElement('select');
    catSelect.className = 'min-h-[42px] px-3 py-2 rounded-lg bg-[#F4F4F6] border border-black/10 text-sm';
    ['Smartfonlar', 'Quloqchinlar', 'Soatlar', 'Aksessuarlar'].forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      catSelect.appendChild(opt);
    });

    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.min = '1000';
    priceInput.step = '1000';
    priceInput.required = true;
    priceInput.placeholder = "Narxi (so'mda, masalan: 4500000)";
    priceInput.className = 'min-h-[42px] px-3 py-2 rounded-lg bg-[#F4F4F6] border border-black/10 text-sm';

    const specsInput = document.createElement('input');
    specsInput.placeholder = 'Xususiyatlari (6.7" AMOLED · 256 GB)';
    specsInput.className = 'min-h-[42px] px-3 py-2 rounded-lg bg-[#F4F4F6] border border-black/10 text-sm';

    const variantsInput = document.createElement('input');
    variantsInput.placeholder = 'Xotira / variant (128 GB, 256 GB)';
    variantsInput.className = 'min-h-[42px] px-3 py-2 rounded-lg bg-[#F4F4F6] border border-black/10 text-sm';

    const imageSelect = document.createElement('select');
    imageSelect.className = 'min-h-[42px] px-3 py-2 rounded-lg bg-[#F4F4F6] border border-black/10 text-sm';
    IMAGE_PRESETS.forEach((img) => {
      const opt = document.createElement('option');
      opt.value = img.value;
      opt.textContent = img.label;
      imageSelect.appendChild(opt);
    });

    grid.append(nameInput, catSelect, priceInput, specsInput, variantsInput, imageSelect);

    const submitRow = el('div', 'flex justify-end');
    const addBtn = el(
      'button',
      'min-h-[42px] px-5 py-2 rounded-lg bg-[#E24700] hover:bg-[#C93E00] text-white text-sm font-semibold cursor-pointer',
      'Mahsulotni qo‘shish'
    );
    addBtn.type = 'submit';
    submitRow.appendChild(addBtn);

    formCard.append(grid, submitRow);
    formCard.addEventListener('submit', async (e) => {
      e.preventDefault();
      addBtn.disabled = true;
      try {
        const res = await createProduct({
          name: nameInput.value,
          category: catSelect.value,
          price: Number(priceInput.value),
          specs: specsInput.value,
          variants: variantsInput.value || 'Standart',
          image: imageSelect.value,
          inStock: true,
        });
        state.products.unshift(res.product);
        onProductsChanged([...state.products]);
        formCard.reset();
        showToast(`"${res.product.name}" katalogga qo‘shildi.`, 'success');
        render();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        addBtn.disabled = false;
      }
    });

    bodyEl.appendChild(formCard);

    // Product list
    const list = el('div', 'space-y-3');
    state.products.forEach((product) => {
      const row = el(
        'div',
        'bg-white border border-black/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4'
      );

      const left = el('div', 'flex items-center gap-3.5 min-w-0');
      const thumb = document.createElement('img');
      thumb.src = product.image;
      thumb.alt = product.name;
      thumb.referrerPolicy = 'no-referrer';
      thumb.className = 'w-14 h-14 rounded-lg object-cover bg-[#F4F4F6] shrink-0';
      const meta = el('div', 'min-w-0');
      meta.append(
        el('p', 'font-semibold text-sm text-[#0B0B0D] truncate', product.name),
        el('p', 'text-xs text-[#52525B] truncate', `${product.category} · ${formatPriceUZS(product.price)}`)
      );
      left.append(thumb, meta);

      const right = el('div', 'flex flex-wrap items-center gap-2 shrink-0');

      const priceEdit = document.createElement('input');
      priceEdit.type = 'number';
      priceEdit.value = String(product.price);
      priceEdit.className = 'w-32 min-h-[38px] px-2.5 py-1 rounded-lg bg-[#F4F4F6] border border-black/10 text-xs font-mono tabular-nums';

      const savePriceBtn = el(
        'button',
        'min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0B0B0D] text-white text-xs font-medium cursor-pointer',
        'Narxni saqlash'
      );
      savePriceBtn.type = 'button';
      savePriceBtn.addEventListener('click', async () => {
        try {
          const res = await updateProduct(product.id, { price: Number(priceEdit.value) });
          product.price = res.product.price;
          onProductsChanged([...state.products]);
          showToast('Narx yangilandi.', 'success');
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

      const stockBtn = el(
        'button',
        `min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
          product.inStock
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-zinc-100 border-zinc-300 text-zinc-700'
        }`,
        product.inStock ? 'Sotuvda' : 'Tugagan'
      );
      stockBtn.type = 'button';
      stockBtn.addEventListener('click', async () => {
        try {
          const res = await updateProduct(product.id, { inStock: !product.inStock });
          product.inStock = res.product.inStock;
          onProductsChanged([...state.products]);
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

      const delBtn = el(
        'button',
        'min-h-[38px] px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium cursor-pointer',
        'O‘chirish'
      );
      delBtn.type = 'button';
      delBtn.addEventListener('click', async () => {
        try {
          await deleteProduct(product.id);
          state.products = state.products.filter((p) => p.id !== product.id);
          onProductsChanged([...state.products]);
          showToast('Mahsulot o‘chirildi.', 'info');
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

      right.append(priceEdit, savePriceBtn, stockBtn, delBtn);
      row.append(left, right);
      list.appendChild(row);
    });

    bodyEl.appendChild(list);
  }

  function renderTelegramTab() {
    const status = state.adminStatus || {};
    const card = el('div', 'bg-white border border-black/10 rounded-xl p-5 sm:p-6 space-y-5 max-w-2xl');

    card.append(
      el('h3', 'font-display text-lg font-bold text-[#0B0B0D]', 'Telegram Bot va Kanal Integratsiyasi'),
      el(
        'p',
        'text-sm text-[#52525B] leading-relaxed',
        'Har bir yangi buyurtma sayt orqali tasdiqlanishi bilan real vaqt rejimida belgilangan Telegram kanalga yuboriladi.'
      )
    );

    const infoGrid = el('div', 'grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2');
    const channelBox = el('div', 'p-4 rounded-xl bg-[#F4F4F6] border border-black/5');
    channelBox.append(
      el('p', 'text-xs text-[#52525B] mb-1', 'Bog‘langan kanal ID'),
      el('p', 'font-mono text-sm font-semibold text-[#0B0B0D]', status.channelId || '-1003957660682')
    );

    const tokenBox = el('div', 'p-4 rounded-xl bg-[#F4F4F6] border border-black/5');
    tokenBox.append(
      el('p', 'text-xs text-[#52525B] mb-1', 'Bot Token holati'),
      el(
        'p',
        `text-sm font-semibold ${status.telegramConfigured ? 'text-emerald-700' : 'text-amber-700'}`,
        status.telegramConfigured
          ? 'Server muhitida faollashtirilgan'
          : 'TELEGRAM_BOT_TOKEN Secrets panelida kutilmoqda'
      )
    );

    infoGrid.append(channelBox, tokenBox);
    card.appendChild(infoGrid);

    if (!status.telegramConfigured) {
      const hint = el(
        'p',
        'text-xs text-[#52525B] bg-amber-50 border border-amber-200 rounded-lg p-3 leading-relaxed',
        'Eslatma: Bot tokeningizni xavfsiz saqlash uchun uni AI Studio Settings → Secrets bo‘limida TELEGRAM_BOT_TOKEN nomi bilan kiriting va botni kanalga admin qiling.'
      );
      card.appendChild(hint);
    }

    const testResultBox = el('p', 'hidden text-xs font-medium p-3 rounded-lg');
    const testBtn = el(
      'button',
      'min-h-[44px] px-5 py-2.5 rounded-lg bg-[#E24700] hover:bg-[#C93E00] text-white text-sm font-semibold cursor-pointer',
      'Kanalga sinov xabari yuborish'
    );
    testBtn.type = 'button';

    testBtn.addEventListener('click', async () => {
      testBtn.disabled = true;
      testResultBox.classList.add('hidden');
      try {
        const res = await sendTelegramTest();
        testResultBox.className = 'text-xs font-medium p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800';
        testResultBox.textContent = `Sinov xabari muvaffaqiyatli yuborildi (Xabar ID: ${res.messageId || 'OK'}).`;
      } catch (err) {
        testResultBox.className = 'text-xs font-medium p-3 rounded-lg bg-red-50 border border-red-200 text-red-800';
        testResultBox.textContent = err.message || 'Sinov xabarini yuborishda xatolik.';
      } finally {
        testBtn.disabled = false;
      }
    });

    card.append(testBtn, testResultBox);
    bodyEl.appendChild(card);
  }

  return {
    open,
    close,
    setProducts,
  };
}

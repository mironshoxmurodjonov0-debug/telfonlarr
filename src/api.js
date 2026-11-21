// In-memory admin token (kept out of localStorage/sessionStorage)
let adminToken = null;

export function getAdminToken() {
  return adminToken;
}

export function setAdminToken(token) {
  adminToken = token || null;
}

async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.auth && adminToken) {
    headers.Authorization = `Bearer ${adminToken}`;
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `So‘rov xatosi (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function fetchProducts() {
  return request('/api/products');
}

export function createOrder(payload) {
  return request('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchAdminStatus() {
  return request('/api/admin/status');
}

export function claimAdminPassword(password) {
  return request('/api/admin/claim', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function loginAdmin(password) {
  return request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function fetchOrders() {
  return request('/api/orders', { auth: true });
}

export function updateOrderStatus(orderId, status, notifyTelegram) {
  return request(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ status, notifyTelegram }),
  });
}

export function resendOrderTelegram(orderId) {
  return request(`/api/orders/${encodeURIComponent(orderId)}/resend-telegram`, {
    method: 'POST',
    auth: true,
  });
}

export function createProduct(payload) {
  return request('/api/products', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export function updateProduct(productId, payload) {
  return request(`/api/products/${encodeURIComponent(productId)}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export function deleteProduct(productId) {
  return request(`/api/products/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function sendTelegramTest() {
  return request('/api/telegram/test', {
    method: 'POST',
    auth: true,
  });
}

// --- 1. SUPABASE SETUP ---
const SUPABASE_URL = 'https://tiujvifgzwwqnuccganc.supabase.co/';
const SUPABASE_ANON_KEY = 'sb_publishable_oofbS_BHEesNqKIwGRXecg_NSd-uFen';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.supabaseClient = supabaseClient;
window.supabase = supabaseClient;

// Helper สำหรับดึง ID ปลอดภัย
function getId(obj, type = 'menu') {
  if (!obj) return null;
  if (type === 'menu') return obj.menu_id ?? obj.id;
  if (type === 'order') return obj.order_id ?? obj.id;
  return obj.id;
}

// --- 2. CLASS DEFINITIONS & GLOBALS ---
class Menu {
  constructor(menu_id, menu_name, price, category, image_url, is_popular = false) {
    this.menu_id = menu_id;
    this.menu_name = menu_name;
    this.price = Number(price);
    this.category = category;
    this.image_url = image_url;
    this.is_popular = is_popular;
  }
}

let currentCart = [];
let allMenus = [];
let currentCategory = 'All';

// --- UI UTILITIES ---
function showToast(message, icon = '✅') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  const toastIcon = document.querySelector('.toast-icon');

  if (toast && toastMsg) {
    toastMsg.innerHTML = message;
    if (toastIcon) toastIcon.innerText = icon;

    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}

function openModal(modalId) {
  document.getElementById(modalId)?.classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('active');
}

async function uploadImageToSupabase(file) {
  if (!file) return null;

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { data, error } = await supabaseClient.storage
    .from('menu-images')
    .upload(fileName, file);

  if (error) {
    console.error('Storage Upload Error:', error);
    throw new Error('ไม่สามารถอัปโหลดรูปภาพได้');
  }

  const { data: publicUrlData } = supabaseClient.storage
    .from('menu-images')
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

// --- 3. CUSTOMER SIDE FUNCTIONS ---
async function loadCustomerMenus(category = 'All') {
  const grid = document.getElementById('menu-grid');
  if (!grid) return;

  grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">⚡กำลังโหลดเมนูสุดพิเศษ...</p>';

  try {
    const { data, error } = await supabaseClient.from('menus').select('*');
    if (error) throw error;

    allMenus = data.map(m => new Menu(getId(m, 'menu'), m.menu_name, m.price, m.category, m.image_url, m.is_popular));
    currentCategory = category;
    handleSearchAndFilter();

  } catch (err) {
    console.error(err);
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ef4444;">เกิดข้อผิดพลาดในการโหลดข้อมูลเมนู</p>';
  }
}

function renderCustomerMenus(menuList) {
  const grid = document.getElementById('menu-grid');
  if (!grid) return;

  grid.innerHTML = '';

  if (!menuList || menuList.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">🔍 ไม่พบรายการอาหารที่ค้นหา</p>';
    return;
  }

  menuList.forEach(menu => {
    const mId = getId(menu, 'menu');
    const cartItem = currentCart.find(item => getId(item.menu, 'menu') === mId);
    const itemQty = cartItem ? cartItem.quantity : 0;
    const price = Number(menu.price) || 0;

    const actionButtonHTML = itemQty > 0 
      ? `
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(15, 23, 42, 0.8); border: 1px solid var(--border); border-radius: 8px; padding: 0.3rem 0.6rem; margin-top: auto;">
          <button onclick="updateCartQuantity(${mId}, -1); renderCustomerMenus(allMenus);" style="background: #EF4444; color: #fff; border: none; border-radius: 6px; width: 28px; height: 28px; font-weight: bold; cursor: pointer;">-</button>
          <span style="color: #fff; font-weight: bold; font-size: 1rem;">${itemQty}</span>
          <button onclick="updateCartQuantity(${mId}, 1); renderCustomerMenus(allMenus);" style="background: #10B981; color: #fff; border: none; border-radius: 6px; width: 28px; height: 28px; font-weight: bold; cursor: pointer;">+</button>
        </div>
      `
      : `
        <button class="btn-primary" style="margin-top:auto;" onclick="addToCart(${mId}); renderCustomerMenus(allMenus);">
          + เพิ่มลงตะกร้า
        </button>
      `;

    grid.innerHTML += `
      <div class="card">
        <div class="card-img-wrapper">
          <span class="badge ${menu.category ? menu.category.toLowerCase() : ''}">${menu.category || 'ทั่วไป'}</span>
          <img src="${menu.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}" 
               alt="${menu.menu_name}"
               onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';">
        </div>
        <div class="card-body">
          <h3>${menu.menu_name}</h3>
          <p class="price">฿${price.toLocaleString()}</p>
          ${actionButtonHTML}
        </div>
      </div>
    `;
  });
}

function setCategory(category, btnElement) {
  currentCategory = category;
  document.querySelectorAll('.filter-btn, .tab-btn').forEach(btn => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  handleSearchAndFilter();
}

function handleSearchAndFilter() {
  const searchInput = document.getElementById('search-input');
  const keyword = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filteredMenus = allMenus.filter(item => {
    let matchesCategory = false;
    if (currentCategory.toLowerCase() === 'all') {
      matchesCategory = true;
    } else if (currentCategory.toLowerCase() === 'popular') {
      matchesCategory = item.is_popular === true; 
    } else {
      matchesCategory = item.category && item.category.toLowerCase() === currentCategory.toLowerCase();
    }

    const matchesSearch = item.menu_name ? item.menu_name.toLowerCase().includes(keyword) : true;
    return matchesCategory && matchesSearch;
  });

  renderCustomerMenus(filteredMenus);
}

function addToCart(menuId) {
  const menu = allMenus.find(m => getId(m, 'menu') === menuId);
  if (!menu) return;

  const existing = currentCart.find(item => getId(item.menu, 'menu') === menuId);
  if (existing) {
    existing.quantity += 1;
  } else {
    currentCart.push({ menu, quantity: 1 });
  }

  showToast(`เพิ่ม <b>${menu.menu_name}</b> ลงตะกร้าแล้ว`);
  updateCartBadge();
  renderCartModal();
  handleSearchAndFilter();
}

function updateCartQuantity(menuId, change) {
  const index = currentCart.findIndex(item => getId(item.menu, 'menu') === menuId);
  if (index !== -1) {
    currentCart[index].quantity += change;
    if (currentCart[index].quantity <= 0) {
      currentCart.splice(index, 1);
    }
  }
  updateCartBadge();
  renderCartModal();
}

function updateCartBadge() {
  const totalCount = currentCart.reduce((sum, i) => sum + i.quantity, 0);
  const badge = document.getElementById('cart-count-badge');
  if (badge) badge.textContent = totalCount;
}

function removeCartItem(menuId) {
  currentCart = currentCart.filter(item => getId(item.menu, 'menu') !== menuId);
  updateCartBadge();
  renderCartModal();
  handleSearchAndFilter();
}

function renderCartModal() {
  const container = document.getElementById('cart-modal-items');
  const totalEl = document.getElementById('cart-modal-total');
  if (!container) return;

  container.innerHTML = '';
  let total = 0;

  if (currentCart.length === 0) {
    container.innerHTML = '<p class="empty-cart-text">🛒 ยังไม่มีรายการอาหารในตะกร้าของคุณ</p>';
  } else {
    currentCart.forEach(item => {
      const price = Number(item.menu.price) || 0;
      const itemTotal = price * item.quantity;
      total += itemTotal;
      const mId = getId(item.menu, 'menu');

      container.innerHTML += `
        <div class="modal-cart-item">
          <img src="${item.menu.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}" class="item-thumb" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'">
          <div class="item-info">
            <div class="item-name">${item.menu.menu_name}</div>
            <div class="item-price">฿${itemTotal.toLocaleString()}</div>
          </div>
          <div class="qty-controls">
            <button class="btn-qty" onclick="updateCartQuantity(${mId}, -1)">-</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="btn-qty" onclick="updateCartQuantity(${mId}, 1)">+</button>
          </div>
          <button class="btn-remove-item" onclick="removeCartItem(${mId})" title="ลบรายการ">🗑️</button>
        </div>
      `;
    });
  }

  if (totalEl) totalEl.innerText = `฿${total.toLocaleString()}`;
}

async function saveOrderToSupabase(tableNum, paymentMethod) {
  if (!tableNum || currentCart.length === 0) {
    alert('❌ กรุณาเลือกโต๊ะและเลือกอาหารก่อนสั่งซื้อ');
    return false;
  }

  try {
    // 1. บันทึกลงตาราง orders (ตั้งสถานะเริ่มต้นเป็น Pending เพื่อให้แอดมินมากด Paid เอง)
const { data: orderData, error: orderErr } = await supabaseClient
  .from('orders')
  .insert([{ 
    table_number: parseInt(tableNum), 
    status: 'Pending', 
    payment_method: paymentMethod || 'เงินสด',
    payment_status: 'pending'
  }])
  .select('*');

    if (orderErr) throw orderErr;
    if (!orderData || orderData.length === 0) throw new Error('ไม่สามารถรับ Order ID ได้');

    // ประกาศตัวแปร newOrderId ให้ถูกต้อง
    const newOrderId = getId(orderData[0], 'order');

    // 2. บันทึกลงตาราง order_items (ไม่ส่ง price เพื่อป้องกัน Error เรื่อง column schema)
    const itemsToInsert = currentCart.map(item => ({
      order_id: newOrderId,
      menu_id: getId(item.menu, 'menu'),
      quantity: item.quantity
    }));

    const { error: itemsErr } = await supabaseClient.from('order_items').insert(itemsToInsert);
    if (itemsErr) throw itemsErr;

    // 3. เคลียร์ตะกร้าสินค้า
    currentCart = [];
    const tableInput = document.getElementById('table-number');
    if (tableInput) tableInput.value = '';
    updateCartBadge();
    renderCartModal();

    // 4. อัปเดตข้อมูลฝั่ง Admin
    if (typeof loadAdminOrders === 'function') await loadAdminOrders();
    if (typeof loadDashboardStats === 'function') await loadDashboardStats();

    return true;
  } catch (err) {
    console.error('Submit order error:', err);
    alert('บันทึกออเดอร์ไม่สำเร็จ: ' + err.message);
    return false;
  }
}

// --- 4. ADMIN SIDE FUNCTIONS ---
async function loadAdminData() {
  await loadAdminMenus();
  await loadAdminOrders();
  await loadDashboardStats();
  populateMenuSelect();
}

async function loadAdminMenus(searchQuery = '') {
  const tbody = document.getElementById('admin-menu-table');
  if (!tbody) return;

  let query = supabaseClient.from('menus').select('*');
  if (searchQuery) query = query.ilike('menu_name', `%${searchQuery}%`);

  const { data, error } = await query;
  if (error) return;

  allMenus = data.map(m => new Menu(getId(m, 'menu'), m.menu_name, m.price, m.category, m.image_url, m.is_popular));

  tbody.innerHTML = '';
  data.forEach(m => {
    const mId = getId(m, 'menu');
    tbody.innerHTML += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <td style="padding:0.8rem 1rem; color:var(--text-muted);">#${mId}</td>
        <td style="padding:0.8rem 1rem;">
          <img src="${m.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px;">
        </td>
        <td style="padding:0.8rem 1rem;"><b>${m.menu_name}</b></td>
        <td style="padding:0.8rem 1rem;"><span class="badge">${m.category || '-'}</span></td>
        <td style="padding:0.8rem 1rem; color:#F472B6; font-weight:bold;">฿${Number(m.price).toLocaleString()}</td>
        <td style="padding:0.8rem 1rem;">
          <button style="padding:0.4rem 0.8rem; border-radius:8px; background:#3b82f6; color:#fff; border:none; cursor:pointer; margin-right:6px; font-weight:bold;" onclick="editMenu(${mId})">แก้ไข</button>
          <button style="padding:0.4rem 0.8rem; border-radius:8px; background:#ef4444; color:#fff; border:none; cursor:pointer; font-weight:bold;" onclick="deleteMenu(${mId}, '${m.menu_name}')">ลบ</button>
        </td>
      </tr>
    `;
  });
}

async function handleAddMenu(e) {
  e.preventDefault();
  const name = document.getElementById('m-name').value;
  const price = parseFloat(document.getElementById('m-price').value);
  const category = document.getElementById('m-category').value;
  const fileInput = document.getElementById('m-file');
  const submitBtn = document.getElementById('add-submit-btn');

  if (!fileInput.files || fileInput.files.length === 0) {
    showToast('❌ กรุณาเลือกไฟล์รูปภาพ');
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ กำลังอัปโหลดรูป...';

    const imageUrl = await uploadImageToSupabase(fileInput.files[0]);

    const { error } = await supabaseClient.from('menus').insert([{ 
      menu_name: name, 
      price, 
      category, 
      image_url: imageUrl 
    }]);

    if (error) throw error;

    showToast('เพิ่มเมนูสำเร็จ!');
    document.getElementById('add-menu-form').reset();
    closeModal('add-menu-modal');
    loadAdminData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'บันทึกเมนู';
  }
}

async function handleAdminCreateOrder(e) {
  e.preventDefault();
  const tableNum = document.getElementById('admin-table-num').value;
  const menuId = document.getElementById('admin-menu-select').value;
  const qty = parseInt(document.getElementById('admin-qty').value);

  try {
    const { data: menu } = await supabaseClient.from('menus').select('*').eq('menu_id', menuId).single();

    const { data: newOrder, error: orderErr } = await supabaseClient
      .from('orders')
      .insert([{ table_number: parseInt(tableNum), status: 'Paid', payment_status: 'pending' }])
      .select('*');

    if (orderErr) throw orderErr;

    const { error: itemErr } = await supabaseClient.from('order_items').insert([{
      order_id: getId(newOrder[0], 'order'),
      menu_id: parseInt(menuId),
      quantity: qty,
      price: menu ? menu.price : 0
    }]);

    if (itemErr) throw itemErr;

    showToast('สร้าง Order สำเร็จ!');
    closeModal('create-order-modal');
    loadAdminData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message);
  }
}
async function loadAdminOrders() {
  const container = document.getElementById('admin-orders-list');
  if (!container) return;

  try {
    const { data: orders, error: oErr } = await supabaseClient.from('orders').select('*');
    const { data: items, error: iErr } = await supabaseClient.from('order_items').select('*');
    const { data: menus } = await supabaseClient.from('menus').select('*');

    if (oErr || iErr) throw oErr || iErr;

    // Map ข้อมูลเมนูเพื่อดึงทั้ง ชื่อ, ราคา และ รูปภาพ
    const menuMap = {};
    if (menus) {
      menus.forEach(m => {
        const id = getId(m, 'menu');
        menuMap[id] = {
          name: m.menu_name,
          price: Number(m.price) || 0,
          image: m.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'
        };
      });
    }

    orders.sort((a, b) => getId(b, 'order') - getId(a, 'order'));

    const fullOrders = orders.map(ord => {
      const oId = getId(ord, 'order');
      const orderItems = (items || [])
        .filter(it => it.order_id === oId)
        .map(it => {
          const menuInfo = menuMap[it.menu_id] || {};
          return {
            ...it,
            menu_name: menuInfo.name || 'รายการอาหาร',
            price: Number(it.price) || menuInfo.price || 0,
            image_url: menuInfo.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'
          };
        });
      return { ...ord, order_items: orderItems };
    });

    renderAdminOrders(fullOrders);
  } catch (err) {
    console.error('Error loading orders:', err);
  }
}

function renderAdminOrders(orders) {
  const container = document.getElementById('admin-orders-list');
  if (!container) return;

  container.innerHTML = '';
  if (!orders || orders.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; grid-column: 1/-1;">ยังไม่มีรายการสั่งซื้อ</p>';
    return;
  }

  orders.forEach(order => {
    let itemsHTML = '';
    let totalPrice = 0;
    const oId = getId(order, 'order');
    const currentStatus = order.status || 'Pending';

    if (order.order_items && order.order_items.length > 0) {
      order.order_items.forEach(item => {
        const price = Number(item.price) || 0;
        const qty = item.quantity || 1;
        const itemTotal = price * qty;
        totalPrice += itemTotal;

        itemsHTML += `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; font-size: 0.9rem; color: #cbd5e1; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
              <img src="${item.image_url}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 6px; flex-shrink: 0;">
              <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.menu_name} × ${qty}</span>
            </div>
            <span style="flex-shrink: 0; font-weight: 600;">฿${itemTotal.toLocaleString()}</span>
          </div>
        `;
      });
    }

    // กำหนดสไตล์ปุ่มตามสถานะ
    const isPaid = currentStatus.toLowerCase() === 'paid';
    const statusBtnHTML = isPaid
      ? `<button onclick="updateOrderStatus(${oId}, 'Pending')" style="background: rgba(16, 185, 129, 0.2); color: #10B981; border: 1px solid #10B981; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem; font-weight: bold; cursor: pointer;" title="คลิกเพื่อย้อนกลับเป็น Pending">✓ Paid</button>`
      : `<button onclick="updateOrderStatus(${oId}, 'Paid')" style="background: linear-gradient(135deg, #EC4899, #8B5CF6); color: #FFF; border: none; padding: 0.35rem 0.9rem; border-radius: 20px; font-size: 0.8rem; font-weight: bold; cursor: pointer; box-shadow: 0 2px 8px rgba(236,72,153,0.4);" title="คลิกเพื่อยืนยันชำระเงิน">⏳ กดชำระเงิน (Paid)</button>`;

    container.innerHTML += `
      <div class="card" style="padding: 1.2rem; background: rgba(30, 41, 59, 0.7); border: 1px solid var(--border); border-radius: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">
          <h3 style="margin: 0; font-size: 1.1rem; color: #fff;">Order #${oId} <span style="font-size: 0.85rem; color: var(--text-muted);">(โต๊ะ: ${order.table_number || '-'})</span></h3>
          ${statusBtnHTML}
        </div>
        
        <div style="margin-bottom: 1rem; min-height: 40px;">
          ${itemsHTML || '<p style="color: #64748b; font-size: 0.85rem;">ไม่มีรายการอาหาร</p>'}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.75rem; font-weight: bold;">
          <span style="color: #fff;">รวม: <span style="color: #ec4899;">฿${totalPrice.toLocaleString()}</span></span>
          <span style="color: ${isPaid ? '#10b981' : '#f59e0b'}; font-size: 0.85rem;">${isPaid ? 'สำเร็จ' : 'รอชำระเงิน'}</span>
        </div>
      </div>
    `;
  });
}

async function loadDashboardStats() {
  try {
    const { data: items } = await supabaseClient.from('order_items').select('*');
    const { data: menus } = await supabaseClient.from('menus').select('*');

    const menuNameMap = {};
    const menuPriceMap = {};
    if (menus) {
      menus.forEach(m => {
        const id = getId(m, 'menu');
        menuNameMap[id] = m.menu_name;
        menuPriceMap[id] = Number(m.price) || 0;
      });
    }

    let totalSales = 0;
    const menuCounts = {};

    if (items) {
      items.forEach(item => {
        const price = Number(item.price) || menuPriceMap[item.menu_id] || 0;
        const qty = item.quantity || 0;
        totalSales += price * qty;

        const name = menuNameMap[item.menu_id] || 'รายการอาหาร';
        menuCounts[name] = (menuCounts[name] || 0) + qty;
      });
    }

    const salesEl = document.getElementById('stat-total-sales');
    if (salesEl) salesEl.innerText = `฿${totalSales.toLocaleString()}`;

    let topMenu = '-';
    let maxCount = 0;
    for (const [name, count] of Object.entries(menuCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topMenu = `${name} (${count} จาน)`;
      }
    }
    const topMenuEl = document.getElementById('stat-top-menu');
    if (topMenuEl) topMenuEl.innerText = topMenu;
  } catch (err) {
    console.error('Error stats:', err);
  }
}

async function populateMenuSelect() {
  const select = document.getElementById('admin-menu-select');
  if (!select) return;

  const { data: menus } = await supabaseClient.from('menus').select('*');
  if (!menus) return;

  select.innerHTML = menus.map(m => `<option value="${getId(m, 'menu')}">${m.menu_name} - ฿${m.price}</option>`).join('');
}

// Auto Load
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('menu-grid')) {
    loadCustomerMenus();
  }
});

async function updateOrderStatus(orderId, newStatus) {
  try {
    let { error } = await supabaseClient
      .from('orders')
      .update({ status: newStatus, payment_status: newStatus.toLowerCase() })
      .eq('order_id', orderId);

    if (error) {
      await supabaseClient
        .from('orders')
        .update({ status: newStatus, payment_status: newStatus.toLowerCase() })
        .eq('id', orderId);
    }

    showToast(`อัปเดต Order #${orderId} เป็น ${newStatus} แล้ว`);
    await loadAdminOrders();
    await loadDashboardStats();
  } catch (err) {
    alert('อัปเดตสถานะไม่สำเร็จ: ' + err.message);
  }
}

// ดึงข้อมูลเมนูเดิมมาใส่ใน Modal แก้ไข (ดึงจากตัวแปร allMenus โดยตรง ไม่ต้องยิง Query ซ้ำ)
function editMenu(menuId) {
  try {
    // หาเมนูจากในอาร์เรย์ allMenus ที่มีอยู่แล้ว
    const menu = allMenus.find(m => getId(m, 'menu') == menuId);

    if (!menu) {
      showToast('❌ ไม่พบข้อมูลเมนูนี้ในระบบ');
      return;
    }

    const targetId = getId(menu, 'menu');

    document.getElementById('edit-m-id').value = targetId;
    document.getElementById('edit-m-name').value = menu.menu_name || '';
    document.getElementById('edit-m-price').value = menu.price || '';
    document.getElementById('edit-m-category').value = menu.category || 'Thai';

    openModal('edit-menu-modal');
  } catch (err) {
    console.error(err);
    showToast('เกิดข้อผิดพลาด: ' + err.message);
  }
}

// บันทึกการแก้ไขลง Supabase + อัปเดตหน้าเว็บทันที
async function handleUpdateMenu(e) {
  e.preventDefault();
  const menuId = document.getElementById('edit-m-id').value;
  const name = document.getElementById('edit-m-name').value;
  const price = parseFloat(document.getElementById('edit-m-price').value);
  const category = document.getElementById('edit-m-category').value;
  const fileInput = document.getElementById('edit-m-file');
  const submitBtn = document.getElementById('edit-submit-btn');

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ กำลังบันทึก...';

    let payload = {
      menu_name: name,
      price: price,
      category: category
    };

    // อัปโหลดรูปใหม่ (ถ้ามีการเลือกไฟล์)
    if (fileInput.files && fileInput.files.length > 0) {
      const imageUrl = await uploadImageToSupabase(fileInput.files[0]);
      payload.image_url = imageUrl;
    }

    // 1. ลอง อัปเดต โดยใช้ order/menu key ปลอดภัย
    let { error } = await supabaseClient
      .from('menus')
      .update(payload)
      .eq('menu_id', menuId);

    // 2. ถ้าโครงสร้างใน DB ใช้ชื่อคอลัมน์ว่า id ให้ลองอัปเดตอีกรอบ
    if (error) {
      const { error: err2 } = await supabaseClient
        .from('menus')
        .update(payload)
        .eq('id', menuId);
      
      if (err2) throw err2;
    }

    showToast('✨ แก้ไขเมนูสำเร็จ!');
    document.getElementById('edit-menu-form').reset();
    closeModal('edit-menu-modal');

    // 3. โหลดข้อมูลใหม่ทั้งฝั่ง Admin และ Customer ทันที
    await loadAdminData();
    if (typeof loadCustomerMenus === 'function') {
      await loadCustomerMenus(currentCategory);
    }

  } catch (err) {
    console.error(err);
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'บันทึกการแก้ไข';
  }
}
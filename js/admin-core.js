import { signIn, signOut, getCurrentUser, getCurrentProfile, supabase, createProject } from './supabase.js';

let adminUser = null;
let adminProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check if already logged in
  try {
    const user = await getCurrentUser();
    if (user) {
      const profile = await getCurrentProfile();
      if (profile && profile.role === 'admin') {
        adminUser = user;
        adminProfile = profile;
        showDashboard();
      } else {
        // Logged in but not admin
        await signOut();
      }
    }
  } catch (err) {
    console.log("Not logged in");
  }
});

async function handleAdminLogin(e) {
  e.preventDefault();
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const btn = document.getElementById('admin-login-btn');
  
  btn.textContent = 'Authenticating...';
  btn.disabled = true;

  try {
    await signIn(email, password);
    const user = await getCurrentUser();
    const profile = await getCurrentProfile();

    if (!profile || profile.role !== 'admin') {
      await signOut();
      throw new Error("Access Denied: You do not have administrator privileges.");
    }

    adminUser = user;
    adminProfile = profile;
    showDashboard();
  } catch (err) {
    alert(err.message || 'Login failed. Please check your credentials.');
  } finally {
    btn.textContent = 'Sign In to Admin';
    btn.disabled = false;
  }
}

async function handleAdminLogout() {
  await signOut();
  adminUser = null;
  adminProfile = null;
  document.getElementById('admin-login-gate').style.display = 'flex';
  document.getElementById('admin-dashboard').style.display = 'none';
  
  // Clear inputs
  document.getElementById('admin-email').value = '';
  document.getElementById('admin-password').value = '';
}

function showDashboard() {
  document.getElementById('admin-login-gate').style.display = 'none';
  document.getElementById('admin-dashboard').style.display = 'flex';
  // Init data for current active tab
  switchAdminTab('overview');
}

function switchAdminTab(tabName) {
  // Update Nav
  document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
  const activeLink = Array.from(document.querySelectorAll('.admin-nav a')).find(a => a.getAttribute('onclick').includes(tabName));
  if (activeLink) activeLink.classList.add('active');

  // Update Panes
  document.querySelectorAll('.admin-tab-pane').forEach(p => p.classList.remove('active'));
  const activePane = document.getElementById(`tab-${tabName}`);
  if (activePane) activePane.classList.add('active');
  
  // Load data based on tab
  if (tabName === 'overview') loadAdminOverview();
  if (tabName === 'projects') loadWebsiteProjects();
  if (tabName === 'clients') loadConstructionClients();
  if (tabName === 'products') loadShopProducts();
  if (tabName === 'categories') {
    if (typeof window.loadAdminCategories === 'function') window.loadAdminCategories();
  }
  if (tabName === 'orders') {
    if (typeof window.loadAdminOrders === 'function') window.loadAdminOrders();
  }
  if (tabName === 'sales') {
    if (typeof window.loadSalesOverview === 'function') window.loadSalesOverview();
  }
  if (tabName === 'users') loadAdminUsers();
}

// Stubs for future data loading
async function loadAdminOverview() {
  try {
    // Fetch active projects count
    const { count: projectsCount, error: pErr } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true });
    
    if (pErr) console.error("Error fetching projects count:", pErr);
    
    // Fetch shop orders count
    const { count: ordersCount, error: oErr } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
      
    if (oErr) console.error("Error fetching orders count:", oErr);
    
    document.getElementById('overview-active-projects').textContent = projectsCount || 0;
    document.getElementById('overview-shop-orders').textContent = ordersCount || 0;
  } catch (err) {
    console.error("Error loading overview:", err);
  }
}
async function loadWebsiteProjects() {
  const list = document.getElementById('admin-projects-list');
  if (!list) return;
  list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-secondary)">Loading projects...</div>';
  
  try {
    const { data, error } = await supabase.from('homepage_projects').select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) {
      list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-secondary)">No projects found. Click + Add Project.</div>';
      return;
    }
    
    list.innerHTML = data.map(p => `
      <div style="padding:16px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:16px;">
          <div style="width:60px;height:40px;background:#333;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;overflow:hidden;">
            ${p.image_url ? `<img src="${p.image_url}" style="width:100%;height:100%;object-fit:cover;">` : 'IMG'}
          </div>
          <div>
            <h4 style="margin:0;color:var(--gold)">${p.name}</h4>
            <span style="font-size:12px;color:var(--text-secondary)">${p.type.toUpperCase()} · ${p.location}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn-outline-shop" style="padding:6px 12px;font-size:12px;" onclick="openProjectModal('${p.id}')">Edit</button>
          <button class="btn-outline-shop" style="padding:6px 12px;font-size:12px;border-color:#ff4444;color:#ff4444;" onclick="deleteHomepageProject('${p.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
    list.innerHTML = '<div style="padding:16px;text-align:center;color:#ff4444">Failed to load projects. Ensure the homepage_projects table exists.</div>';
  }
}

async function loadConstructionClients() {
  const wrap = document.querySelector('#tab-clients .data-table-wrap');
  if (!wrap) return;
  
  try {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    
    let html = `
      <table class="data-table" style="width:100%;border-collapse:collapse;text-align:left;margin-top:16px;">
        <thead style="background:rgba(255,255,255,0.02);border-bottom:1px solid var(--glass-border);">
          <tr>
            <th style="padding:16px;font-size:12px;color:var(--text-secondary);font-weight:600;">Project ID</th>
            <th style="padding:16px;font-size:12px;color:var(--text-secondary);font-weight:600;">Client Name</th>
            <th style="padding:16px;font-size:12px;color:var(--text-secondary);font-weight:600;">Progress</th>
            <th style="padding:16px;font-size:12px;color:var(--text-secondary);font-weight:600;">Actions</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    if (!data || data.length === 0) {
      html += `<tr><td colspan="4" style="padding:24px;text-align:center;color:var(--text-secondary)">No construction clients found.</td></tr>`;
    } else {
      html += data.map(p => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
          <td style="padding:16px;font-weight:600;color:#fff">${p.project_code}</td>
          <td style="padding:16px;color:var(--text-secondary)">${p.client_name || 'N/A'}</td>
          <td style="padding:16px;color:var(--gold)">${p.overall_progress}%</td>
          <td style="padding:16px;">
            <button class="btn-outline-shop" style="padding:6px 12px;font-size:12px;" onclick="deleteClientPortal('${p.id}')">Delete</button>
          </td>
        </tr>
      `).join('');
    }
    html += `</tbody></table>`;
    
    // Replace the placeholder text with the table
    const note = wrap.querySelector('div');
    wrap.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;"><h3 style="margin:0;font-size:16px;">Active Portals</h3></div>` + html;
    if (note) wrap.appendChild(note); // keep the note at bottom
  } catch (err) {
    console.error(err);
  }
}

async function loadShopProducts() {
  if (typeof window.loadAdminProducts === 'function') window.loadAdminProducts();
}

async function loadAdminUsers() {
  const wrap = document.querySelector('#tab-users .data-table-wrap');
  if (!wrap) return;
  
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('role', 'admin');
    if (error) throw error;
    
    let html = `
      <table class="data-table" style="width:100%;border-collapse:collapse;text-align:left;margin-top:16px;">
        <thead style="background:rgba(255,255,255,0.02);border-bottom:1px solid var(--glass-border);">
          <tr>
            <th style="padding:16px;font-size:12px;color:var(--text-secondary);font-weight:600;">Admin Name</th>
            <th style="padding:16px;font-size:12px;color:var(--text-secondary);font-weight:600;">Email</th>
            <th style="padding:16px;font-size:12px;color:var(--text-secondary);font-weight:600;">Role</th>
            <th style="padding:16px;font-size:12px;color:var(--text-secondary);font-weight:600;">Actions</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    if (!data || data.length === 0) {
      html += `<tr><td colspan="4" style="padding:24px;text-align:center;color:var(--text-secondary)">No admin users found.</td></tr>`;
    } else {
      html += data.map(u => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
          <td style="padding:16px;font-weight:600;color:#fff">${u.full_name || 'Admin'}</td>
          <td style="padding:16px;color:var(--text-secondary)">${u.email || 'N/A'}</td>
          <td style="padding:16px;"><span style="background:rgba(212,160,23,0.1);color:var(--gold);padding:4px 8px;border-radius:4px;font-size:11px;letter-spacing:1px;">ADMIN</span></td>
          <td style="padding:16px;">
            <button class="btn-outline-shop" style="padding:6px 12px;font-size:12px;border-color:#ff4444;color:#ff4444;" onclick="revokeAdmin('${u.id}')">Revoke</button>
          </td>
        </tr>
      `).join('');
    }
    html += `</tbody></table>`;
    
    const note = wrap.querySelector('div');
    wrap.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;"><h3 style="margin:0;font-size:16px;">Authorized Administrators</h3></div>` + html;
    if (note) wrap.appendChild(note); // keep the note at bottom
  } catch (err) {
    console.error(err);
  }
}

// ============================================
// MODALS AND CRUD OPERATIONS
// ============================================

window.closeGenericModals = function() {
  document.getElementById('generic-modal-overlay').classList.remove('show');
  document.querySelectorAll('.add-product-panel').forEach(p => p.classList.remove('show'));
}

// 1. Homepage Projects
window.openProjectModal = async function(id = null) {
  document.getElementById('form-homepage-project').reset();
  document.getElementById('hp-id').value = '';
  document.getElementById('hp-modal-title').textContent = 'Add Homepage Project';

  if (id) {
    document.getElementById('hp-modal-title').textContent = 'Edit Project';
    const { data } = await supabase.from('homepage_projects').select('*').eq('id', id).single();
    if (data) {
      document.getElementById('hp-id').value = data.id;
      document.getElementById('hp-name').value = data.name;
      document.getElementById('hp-loc').value = data.location;
      document.getElementById('hp-type').value = data.type;
      document.getElementById('hp-units').value = data.units;
      document.getElementById('hp-price').value = data.price_range;
      document.getElementById('hp-status').value = data.status;
      document.getElementById('hp-img').value = data.image_url || '';
    }
  }

  document.getElementById('generic-modal-overlay').classList.add('show');
  document.getElementById('modal-homepage-project').classList.add('show');
}

window.saveHomepageProject = async function(e) {
  e.preventDefault();
  const id = document.getElementById('hp-id').value;
  const project = {
    name: document.getElementById('hp-name').value,
    location: document.getElementById('hp-loc').value,
    type: document.getElementById('hp-type').value,
    units: document.getElementById('hp-units').value,
    price_range: document.getElementById('hp-price').value,
    status: document.getElementById('hp-status').value,
    image_url: document.getElementById('hp-img').value || null
  };

  try {
    if (id) {
      await supabase.from('homepage_projects').update(project).eq('id', id);
    } else {
      await supabase.from('homepage_projects').insert(project);
    }
    closeGenericModals();
    loadWebsiteProjects();
  } catch (err) {
    alert('Failed to save project.');
    console.error(err);
  }
}

window.deleteHomepageProject = async function(id) {
  if (!confirm('Are you sure you want to delete this project?')) return;
  try {
    await supabase.from('homepage_projects').delete().eq('id', id);
    loadWebsiteProjects();
  } catch (err) {
    console.error(err);
  }
}

// 2. Client Portals
window.openClientModal = function() {
  document.getElementById('form-client-portal').reset();
  document.getElementById('generic-modal-overlay').classList.add('show');
  document.getElementById('modal-client-portal').classList.add('show');
}

window.saveClientPortal = async function(e) {
  e.preventDefault();
  const code = document.getElementById('cp-code').value.toUpperCase();
  const client_name = document.getElementById('cp-name').value;
  const title = document.getElementById('cp-title').value;

  try {
    const projectData = {
      project_code: code,
      client_name,
      project_name: title,
      overall_progress: 0
    };
    await createProject(projectData);
    closeGenericModals();
    loadConstructionClients();
    alert(`Portal Created! Client can now log in using ${code}@rjshomes.in`);
  } catch (err) {
    alert('Failed to create portal: ' + (err.message || JSON.stringify(err)));
    console.error(err);
  }
}

window.deleteClientPortal = async function(id) {
  if (!confirm('WARNING: Are you sure you want to delete this client portal and all associated data?')) return;
  try {
    await supabase.from('projects').delete().eq('id', id);
    loadConstructionClients();
  } catch (err) {
    console.error(err);
  }
}

// 3. Admin Users
window.openAdminModal = function() {
  document.getElementById('form-invite-admin').reset();
  document.getElementById('generic-modal-overlay').classList.add('show');
  document.getElementById('modal-invite-admin').classList.add('show');
}

window.saveAdminUser = async function(e) {
  e.preventDefault();
  const email = document.getElementById('adm-email').value;
  const full_name = document.getElementById('adm-name').value;

  try {
    // Basic insert into profiles (Assuming a cloud edge function or manual setup triggers real auth signup)
    // For demo purposes we insert into profiles
    await supabase.from('profiles').insert({
      id: crypto.randomUUID(),
      email,
      full_name,
      role: 'admin'
    });
    closeGenericModals();
    loadAdminUsers();
    alert('Admin user added to database.');
  } catch (err) {
    alert('Failed to invite admin.');
    console.error(err);
  }
}

window.revokeAdmin = async function(id) {
  if (!confirm('Are you sure you want to revoke admin access for this user?')) return;
  try {
    await supabase.from('profiles').update({ role: 'client' }).eq('id', id);
    loadAdminUsers();
  } catch (err) {
    console.error(err);
  }
}

// Expose to window
window.handleAdminLogin = handleAdminLogin;
window.handleAdminLogout = handleAdminLogout;
window.switchAdminTab = switchAdminTab;
window.openProjectModal = openProjectModal;
window.saveHomepageProject = saveHomepageProject;
window.deleteHomepageProject = deleteHomepageProject;
window.openClientModal = openClientModal;
window.saveClientPortal = saveClientPortal;
window.deleteClientPortal = deleteClientPortal;
window.openAdminModal = openAdminModal;
window.saveAdminUser = saveAdminUser;
window.revokeAdmin = revokeAdmin;
window.closeGenericModals = closeGenericModals;

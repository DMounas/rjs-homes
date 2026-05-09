// ============================================
// RJS HOMES — SUPABASE CLIENT & ALL API CALLS
// Save this as: js/supabase.js
// Include BEFORE app.js and shop-core.js
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ⚠️ Replace these with your actual Supabase project values
// Found in: Supabase Dashboard → Settings → API
const SUPABASE_URL = 'https://cmscvhlhwijwupwlaamb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtc2N2aGxod2lqd3Vwd2xhYW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzI1NzgsImV4cCI6MjA5Mzc0ODU3OH0.oW8AYi7aXdetX-5SzZHCvqhPfqkqHsKjnn6nTMghE1I'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ============================================
// AUTH
// ============================================

// Shop customer signup
export async function signUpCustomer(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role: 'customer' } }
    })
    if (error) throw error
    return data
}

// Shop customer / client login
export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
}

// Construction client login (by project code + password)
// Project code maps to a specific email in your system
export async function signInClient(projectCode, password) {
    // Each client's email is: projectcode@rjshomes.in  e.g. frg-2024@rjshomes.in
    const email = `${projectCode.toLowerCase()}@rjshomes.in`
    return await signIn(email, password)
}

export async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
}

export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

export async function getCurrentProfile() {
    const user = await getCurrentUser()
    if (!user) return null
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
    if (error) throw error
    return data
}

// ============================================
// CONSTRUCTION — CLIENT SIDE
// ============================================

// Get the project belonging to the logged-in client
export async function getMyProject() {
    const user = await getCurrentUser()
    if (!user) return null
    
    // We match by project_code = email prefix
    const code = user.email.split('@')[0].toUpperCase()

    const { data, error } = await supabase
        .from('projects')
        .select(`
      *,
      phases (*, order:sort_order),
      project_updates (*, order:created_at.desc),
      project_photos (*),
      materials (*)
    `)
        .eq('project_code', code)
        .single()
    if (error) throw error
    return data
}

// Listen for live updates on a project (real-time)
export function subscribeToProject(projectId, onPhaseChange, onNewUpdate) {
    // Listen to phase completion changes
    const phaseChannel = supabase
        .channel(`project-phases-${projectId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'phases',
            filter: `project_id=eq.${projectId}`
        }, (payload) => onPhaseChange(payload.new))
        .subscribe()

    // Listen to new project updates (timeline)
    const updateChannel = supabase
        .channel(`project-updates-${projectId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'project_updates',
            filter: `project_id=eq.${projectId}`
        }, (payload) => onNewUpdate(payload.new))
        .subscribe()

    // Return unsubscribe function
    return () => {
        supabase.removeChannel(phaseChannel)
        supabase.removeChannel(updateChannel)
    }
}

// Listen for live notifications
export function subscribeToNotifications(userId, onNotification) {
    return supabase
        .channel(`notifications-${userId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
        }, (payload) => onNotification(payload.new))
        .subscribe()
}

export async function getMyNotifications() {
    const user = await getCurrentUser()
    if (!user) return []
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
    if (error) throw error
    return data
}

export async function markNotificationsRead(userId) {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
    if (error) throw error
}

// ============================================
// CONSTRUCTION — ADMIN SIDE
// ============================================

export async function getAllProjects() {
    const { data, error } = await supabase
        .from('projects')
        .select(`*, profiles(full_name), phases(*)`)
        .order('created_at', { ascending: false })
    if (error) throw error
    return data
}

export async function getProjectById(projectId) {
    const { data, error } = await supabase
        .from('projects')
        .select(`
      *,
      phases (*),
      project_updates (*),
      project_photos (*),
      materials (*)
    `)
        .eq('id', projectId)
        .single()
    if (error) throw error
    return data
}

export async function updatePhase(phaseId, completion) {
    const status = completion === 100 ? 'completed'
        : completion > 0 ? 'in-progress' : 'pending'

    const { data, error } = await supabase
        .from('phases')
        .update({
            completion,
            status,
            last_updated: new Date().toISOString().split('T')[0]
        })
        .eq('id', phaseId)
        .select()
        .single()
    if (error) throw error
    return data
}

export async function updateProjectProgress(projectId, overallProgress) {
    const { error } = await supabase
        .from('projects')
        .update({ overall_progress: overallProgress, updated_at: new Date().toISOString() })
        .eq('id', projectId)
    if (error) throw error
}

export async function addProjectUpdate(projectId, text, date) {
    const user = await getCurrentUser()
    const { data, error } = await supabase
        .from('project_updates')
        .insert({ project_id: projectId, update_text: text, update_date: date, created_by: user.id })
        .select()
        .single()
    if (error) throw error
    return data
}

export async function deleteProjectUpdate(updateId) {
    const { error } = await supabase
        .from('project_updates')
        .delete()
        .eq('id', updateId)
    if (error) throw error
}

export async function upsertMaterial(projectId, material) {
    const { data, error } = await supabase
        .from('materials')
        .upsert({ ...material, project_id: projectId, updated_at: new Date().toISOString() })
        .select()
        .single()
    if (error) throw error
    return data
}

export async function deleteMaterial(materialId) {
    const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', materialId)
    if (error) throw error
}

// Push a live notification to the client
export async function pushNotificationToClient(clientId, title, message) {
    const { error } = await supabase
        .from('notifications')
        .insert({ user_id: clientId, title, message, type: 'update' })
    if (error) throw error
}

export async function uploadProjectPhoto(projectId, phaseName, file) {
    const fileName = `${projectId}/${phaseName}/${Date.now()}-${file.name}`
    const { data: storageData, error: storageError } = await supabase.storage
        .from('project-photos')
        .upload(fileName, file)
    if (storageError) throw storageError

    const { data: { publicUrl } } = supabase.storage
        .from('project-photos')
        .getPublicUrl(fileName)

    const user = await getCurrentUser()
    const { data, error } = await supabase
        .from('project_photos')
        .insert({ project_id: projectId, phase_name: phaseName, photo_url: publicUrl, uploaded_by: user.id })
        .select()
        .single()
    if (error) throw error
    return data
}

// Create a new construction project + seed phases
export async function createProject(projectData) {
    const { data: project, error } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single()
    if (error) throw error

    // Auto-seed 6 default phases
    const phases = [
        { project_id: project.id, name: 'Foundation', sort_order: 1 },
        { project_id: project.id, name: 'Framing', sort_order: 2 },
        { project_id: project.id, name: 'Plumbing', sort_order: 3 },
        { project_id: project.id, name: 'Electrical', sort_order: 4 },
        { project_id: project.id, name: 'Painting', sort_order: 5 },
        { project_id: project.id, name: 'Finishing', sort_order: 6 },
    ]
    const { error: phaseError } = await supabase.from('phases').insert(phases)
    if (phaseError) throw phaseError

    return project
}

// ============================================
// FURNITURE SHOP — CUSTOMER SIDE
// ============================================

export async function getProducts(filters = {}) {
    let query = supabase
        .from('products')
        .select(`
      *,
      furniture_categories(name, icon),
      product_photos(photo_url, is_primary)
    `)
        .eq('is_active', true)

    // Search by name
    if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`)
    }

    // Price range
    if (filters.minPrice !== undefined) {
        query = query.gte('price', filters.minPrice)
    }
    if (filters.maxPrice !== undefined) {
        query = query.lte('price', filters.maxPrice)
    }

    // Material
    if (filters.material) {
        query = query.eq('material', filters.material)
    }

    // Sort
    if (filters.sort === 'price-asc') query = query.order('price', { ascending: true })
    if (filters.sort === 'price-desc') query = query.order('price', { ascending: false })
    if (filters.sort === 'newest') query = query.order('created_at', { ascending: false })

    const { data, error } = await query
    if (error) throw error

    // Filter by category name AFTER fetching
    // (Supabase can't filter on joined columns directly)
    let result = data || []
    if (filters.category && filters.category !== 'All') {
        result = result.filter(p => p.furniture_categories?.name === filters.category)
    }

    return result
}

export async function getProductById(productId) {
    const { data, error } = await supabase
        .from('products')
        .select(`*, furniture_categories(name, icon), product_photos(*)`)
        .eq('id', productId)
        .single()
    if (error) throw error
    return data
}

export async function getCategories() {
    const { data, error } = await supabase
        .from('furniture_categories')
        .select('*')
        .order('sort_order')
    if (error) throw error
    return data
}

export async function placeOrder(orderData, cartItems) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Must be logged in to place order')

    // Insert order
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({ ...orderData, customer_id: user.id })
        .select()
        .single()
    if (orderError) throw orderError

    // Insert order items
    const items = cartItems.map(item => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        product_price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity
    }))
    const { error: itemsError } = await supabase.from('order_items').insert(items)
    if (itemsError) throw itemsError

    // Decrement stock for each product
    for (const item of cartItems) {
        await supabase.rpc('decrement_stock', { product_id: item.id, qty: item.quantity })
    }

    // Send order notification to customer
    await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Order Confirmed!',
        message: `Your order ${order.order_code} has been placed. We'll update you when it's dispatched.`,
        type: 'order'
    })

    return order
}

export async function getMyOrders() {
    const user = await getCurrentUser()
    if (!user) return []
    const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items(*, products(name))`)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
    if (error) throw error
    return data
}

// Listen for order status changes (real-time for customer)
export function subscribeToMyOrders(userId, onStatusChange) {
    return supabase
        .channel(`orders-${userId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `customer_id=eq.${userId}`
        }, (payload) => onStatusChange(payload.new))
        .subscribe()
}

// ============================================
// FURNITURE SHOP — ADMIN SIDE
// ============================================

export async function getAllOrders(statusFilter = null) {
    let query = supabase
        .from('orders')
        .select(`*, profiles(full_name), order_items(*, products(name))`)
        .order('created_at', { ascending: false })
    if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
    }
    const { data, error } = await query
    if (error) throw error
    return data
}

export async function updateOrderStatus(orderId, status, customerId) {
    const { error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId)
    if (error) throw error

    // Notify the customer
    const messages = {
        'Dispatched': 'Your order has been dispatched and is on its way!',
        'Out for Delivery': 'Your order is out for delivery today!',
        'Delivered': 'Your order has been delivered. Enjoy your new furniture!'
    }
    if (messages[status] && customerId) {
        await supabase.from('notifications').insert({
            user_id: customerId,
            title: `Order ${status}`,
            message: messages[status],
            type: 'delivery'
        })
    }
}

export async function getAllProducts() {
    const { data, error } = await supabase
        .from('products')
        .select(`*, furniture_categories(name), product_photos(photo_url, is_primary)`)
        .order('created_at', { ascending: false })
    if (error) throw error
    return data
}

export async function createProduct(productData, photos) {
    const { data: product, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single()
    if (error) throw error

    // Upload photos
    if (photos && photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
            const file = photos[i]
            const fileName = `products/${product.id}/${Date.now()}-${file.name}`
            const { error: storageError } = await supabase.storage
                .from('product-photos')
                .upload(fileName, file)
            if (storageError) continue

            const { data: { publicUrl } } = supabase.storage
                .from('product-photos')
                .getPublicUrl(fileName)

            await supabase.from('product_photos').insert({
                product_id: product.id,
                photo_url: publicUrl,
                is_primary: i === 0,
                sort_order: i
            })
        }
    }
    return product
}

export async function updateProduct(productId, productData) {
    const { data, error } = await supabase
        .from('products')
        .update({ ...productData, updated_at: new Date().toISOString() })
        .eq('id', productId)
        .select()
        .single()
    if (error) throw error
    return data
}

export async function deleteProduct(productId) {
    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
    if (error) throw error
}

export async function addCategory(name, icon) {
    const { data, error } = await supabase
        .from('furniture_categories')
        .insert({ name, icon })
        .select()
        .single()
    if (error) throw error
    return data
}

export async function deleteCategory(categoryId) {
    const { error } = await supabase
        .from('furniture_categories')
        .delete()
        .eq('id', categoryId)
    if (error) throw error
}

export async function getSalesOverview() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select(`total, created_at, status, order_items(product_name, quantity, subtotal)`)
    if (error) throw error

    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0)
    const thisMonth = new Date()
    thisMonth.setDate(1)
    const ordersThisMonth = orders.filter(o => new Date(o.created_at) >= thisMonth).length
    const pending = orders.filter(o => o.status !== 'Delivered').length

    // Top products
    const productSales = {}
    orders.forEach(order => {
        order.order_items?.forEach(item => {
            if (!productSales[item.product_name]) productSales[item.product_name] = 0
            productSales[item.product_name] += item.quantity
        })
    })
    const topProducts = Object.entries(productSales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, qty]) => ({ name, qty }))

    return { totalRevenue, ordersThisMonth, pending, topProducts, orders }
}
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// load .env.local
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '../.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.split('=').map((s) => s.trim()))
)

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_ROLE_KEY = env['SUPABASE_SECRET_KEY']

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── helpers ────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

// ─── get user ───────────────────────────────────────────────────────────────

const { data: users, error: userErr } = await supabase.from('users').select('id').limit(1)
if (userErr || !users?.length) {
  console.error('No users found. Sign up first, then run this script.', userErr)
  process.exit(1)
}
const USER_ID = users[0].id
console.log('Seeding for user:', USER_ID)

// ─── categories ─────────────────────────────────────────────────────────────

const categoryNames = ['Beverages', 'Snacks', 'Dairy', 'Bread & Bakery', 'Sweets & Candy', 'Household', 'Tobacco']

const { data: categories } = await supabase
  .from('product_categories')
  .upsert(
    categoryNames.map((name) => ({ user_id: USER_ID, name })),
    { onConflict: 'user_id,name', ignoreDuplicates: false }
  )
  .select('id, name')

const catByName = Object.fromEntries(categories.map((c) => [c.name, c.id]))
console.log('✓ Categories:', categoryNames.join(', '))

// ─── products ───────────────────────────────────────────────────────────────

const productDefs = [
  // Beverages
  { name: 'Coca-Cola 500ml',      selling_price: 15.00, category: 'Beverages',      barcode: '5449000000996' },
  { name: 'Fanta Orange 500ml',   selling_price: 15.00, category: 'Beverages',      barcode: '5449000131805' },
  { name: 'Sprite 500ml',         selling_price: 15.00, category: 'Beverages',      barcode: '5449000014535' },
  { name: 'Mineral Water 500ml',  selling_price: 8.00,  category: 'Beverages',      barcode: '6001230100015' },
  { name: 'Energade 500ml',       selling_price: 18.00, category: 'Beverages',      barcode: '6001230200012' },
  // Snacks
  { name: 'Simba Chips 120g',     selling_price: 14.00, category: 'Snacks',         barcode: '6001234500012' },
  { name: 'Nik Naks 135g',        selling_price: 14.00, category: 'Snacks',         barcode: '6001234600019' },
  { name: 'Peanuts 100g',         selling_price: 10.00, category: 'Snacks',         barcode: '6001234700016' },
  { name: 'Biltong 50g',          selling_price: 22.00, category: 'Snacks',         barcode: '6001234800013' },
  // Dairy
  { name: 'Full Cream Milk 1L',   selling_price: 22.00, category: 'Dairy',          barcode: '6001010000018' },
  { name: 'Yogurt 175g',          selling_price: 12.00, category: 'Dairy',          barcode: '6001010100015' },
  { name: 'Cheese Slices 200g',   selling_price: 35.00, category: 'Dairy',          barcode: '6001010200012' },
  { name: 'Eggs x6',              selling_price: 28.00, category: 'Dairy',          barcode: '6001010300019' },
  // Bread & Bakery
  { name: 'White Bread 700g',     selling_price: 18.00, category: 'Bread & Bakery', barcode: '6001020000011' },
  { name: 'Brown Bread 700g',     selling_price: 19.00, category: 'Bread & Bakery', barcode: '6001020100018' },
  { name: 'Vetkoek x2',           selling_price: 6.00,  category: 'Bread & Bakery', barcode: null },
  // Sweets & Candy
  { name: 'Chappies Gum x5',      selling_price: 3.00,  category: 'Sweets & Candy', barcode: '6001030000010' },
  { name: 'Bar One 55g',          selling_price: 14.00, category: 'Sweets & Candy', barcode: '6001030100017' },
  { name: 'Fizz Pop',             selling_price: 2.00,  category: 'Sweets & Candy', barcode: null },
  { name: 'Lollipop',             selling_price: 2.00,  category: 'Sweets & Candy', barcode: null },
  // Household
  { name: 'Sunlight Dish Soap',   selling_price: 28.00, category: 'Household',      barcode: '6001040000019' },
  { name: 'Washing Powder 500g',  selling_price: 32.00, category: 'Household',      barcode: '6001040100016' },
  { name: 'Matches (box)',        selling_price: 5.00,  category: 'Household',      barcode: null },
  // Tobacco
  { name: 'Cigarette (single)',   selling_price: 5.00,  category: 'Tobacco',        barcode: null },
  { name: 'Cigarettes 10-pack',   selling_price: 45.00, category: 'Tobacco',        barcode: '6001050100011' },
]

// fetch existing products for this user to avoid re-inserting
const { data: existingProducts } = await supabase
  .from('products')
  .select('id, name, selling_price')
  .eq('user_id', USER_ID)

const existingNames = new Set(existingProducts.map((p) => p.name))
const toInsert = productDefs.filter((p) => !existingNames.has(p.name))

let newProducts = []
if (toInsert.length > 0) {
  const { data } = await supabase
    .from('products')
    .insert(
      toInsert.map((p) => ({
        user_id: USER_ID,
        name: p.name,
        selling_price: p.selling_price,
        category_id: catByName[p.category],
        barcode: p.barcode ?? null,
        description: null,
      }))
    )
    .select('id, name, selling_price')
  newProducts = data ?? []
}

const products = [...existingProducts, ...newProducts]
const prodByName = Object.fromEntries(products.map((p) => [p.name, p]))
console.log('✓ Products:', products.length)

// ─── customers ──────────────────────────────────────────────────────────────

const customerDefs = [
  { name: 'Sipho Dlamini',   phone: '0711234567', email: null },
  { name: 'Nomsa Khumalo',   phone: '0829876543', email: 'nomsa@gmail.com' },
  { name: 'Thabo Nkosi',     phone: '0763456789', email: null },
  { name: 'Zanele Mokoena',  phone: '0654321098', email: null },
  { name: 'Bongani Zulu',    phone: '0831234567', email: null },
  { name: 'Lerato Sithole',  phone: '0712345678', email: 'lerato@webmail.co.za' },
  { name: 'Mpho Molefe',     phone: '0729876543', email: null },
  { name: 'Thandeka Ndlovu', phone: '0843210987', email: null },
]

const { data: existingCustomers } = await supabase
  .from('customers').select('id, name').eq('user_id', USER_ID)
const existingCustomerNames = new Set(existingCustomers.map((c) => c.name))
const newCustomerDefs = customerDefs.filter((c) => !existingCustomerNames.has(c.name))
let newCustomers = []
if (newCustomerDefs.length > 0) {
  const { data } = await supabase.from('customers')
    .insert(newCustomerDefs.map((c) => ({ user_id: USER_ID, ...c }))).select('id, name')
  newCustomers = data ?? []
}
const customers = [...existingCustomers, ...newCustomers]
console.log('✓ Customers:', customers.length)

// ─── suppliers ──────────────────────────────────────────────────────────────

const supplierDefs = [
  { name: 'Metro Cash & Carry',  phone: '0113456789', email: 'orders@metro.co.za' },
  { name: 'Jumbo Wholesale',     phone: '0114567890', email: 'sales@jumbo.co.za' },
  { name: 'Tiger Brands',        phone: '0115678901', email: null },
  { name: 'Cold Drinks Direct',  phone: '0116789012', email: 'info@cdd.co.za' },
]

const { data: existingSuppliers } = await supabase
  .from('suppliers').select('id, name').eq('user_id', USER_ID)
const existingSupplierNames = new Set(existingSuppliers.map((s) => s.name))
const newSupplierDefs = supplierDefs.filter((s) => !existingSupplierNames.has(s.name))
let newSuppliers = []
if (newSupplierDefs.length > 0) {
  const { data } = await supabase.from('suppliers')
    .insert(newSupplierDefs.map((s) => ({ user_id: USER_ID, ...s }))).select('id, name')
  newSuppliers = data ?? []
}
const suppliers = [...existingSuppliers, ...newSuppliers]
const supByName = Object.fromEntries(suppliers.map((s) => [s.name, s]))
console.log('✓ Suppliers:', suppliers.length)

// ─── purchases (stock in) ────────────────────────────────────────────────────
// 12 purchases spread over 90 days

const purchaseDefs = [
  {
    daysAgoN: 88, supplier: 'Metro Cash & Carry',
    items: [
      { name: 'Coca-Cola 500ml', qty: 48, cost: 9.50 },
      { name: 'Fanta Orange 500ml', qty: 48, cost: 9.50 },
      { name: 'Sprite 500ml', qty: 24, cost: 9.50 },
      { name: 'Mineral Water 500ml', qty: 48, cost: 4.00 },
    ],
  },
  {
    daysAgoN: 85, supplier: 'Jumbo Wholesale',
    items: [
      { name: 'Simba Chips 120g', qty: 36, cost: 8.50 },
      { name: 'Nik Naks 135g', qty: 36, cost: 8.50 },
      { name: 'Peanuts 100g', qty: 24, cost: 6.00 },
      { name: 'Biltong 50g', qty: 20, cost: 15.00 },
    ],
  },
  {
    daysAgoN: 82, supplier: 'Tiger Brands',
    items: [
      { name: 'White Bread 700g', qty: 20, cost: 12.00 },
      { name: 'Brown Bread 700g', qty: 20, cost: 12.50 },
      { name: 'Full Cream Milk 1L', qty: 24, cost: 16.00 },
      { name: 'Eggs x6', qty: 20, cost: 20.00 },
    ],
  },
  {
    daysAgoN: 75, supplier: 'Jumbo Wholesale',
    items: [
      { name: 'Chappies Gum x5', qty: 50, cost: 1.50 },
      { name: 'Bar One 55g', qty: 30, cost: 9.00 },
      { name: 'Lollipop', qty: 60, cost: 1.00 },
      { name: 'Fizz Pop', qty: 60, cost: 1.00 },
    ],
  },
  {
    daysAgoN: 70, supplier: 'Metro Cash & Carry',
    items: [
      { name: 'Sunlight Dish Soap', qty: 12, cost: 20.00 },
      { name: 'Washing Powder 500g', qty: 12, cost: 24.00 },
      { name: 'Matches (box)', qty: 24, cost: 3.00 },
    ],
  },
  {
    daysAgoN: 60, supplier: 'Cold Drinks Direct',
    items: [
      { name: 'Coca-Cola 500ml', qty: 72, cost: 9.00 },
      { name: 'Fanta Orange 500ml', qty: 48, cost: 9.00 },
      { name: 'Sprite 500ml', qty: 48, cost: 9.00 },
      { name: 'Energade 500ml', qty: 36, cost: 12.00 },
    ],
  },
  {
    daysAgoN: 55, supplier: 'Jumbo Wholesale',
    items: [
      { name: 'Simba Chips 120g', qty: 48, cost: 8.50 },
      { name: 'Nik Naks 135g', qty: 48, cost: 8.50 },
      { name: 'Biltong 50g', qty: 24, cost: 14.00 },
    ],
  },
  {
    daysAgoN: 45, supplier: 'Tiger Brands',
    items: [
      { name: 'White Bread 700g', qty: 30, cost: 12.00 },
      { name: 'Brown Bread 700g', qty: 20, cost: 12.50 },
      { name: 'Full Cream Milk 1L', qty: 36, cost: 16.00 },
      { name: 'Yogurt 175g', qty: 24, cost: 8.00 },
      { name: 'Cheese Slices 200g', qty: 12, cost: 26.00 },
    ],
  },
  {
    daysAgoN: 35, supplier: 'Metro Cash & Carry',
    items: [
      { name: 'Cigarette (single)', qty: 200, cost: 3.00 },
      { name: 'Cigarettes 10-pack', qty: 20, cost: 32.00 },
      { name: 'Matches (box)', qty: 24, cost: 3.00 },
    ],
  },
  {
    daysAgoN: 25, supplier: 'Cold Drinks Direct',
    items: [
      { name: 'Coca-Cola 500ml', qty: 96, cost: 9.00 },
      { name: 'Sprite 500ml', qty: 48, cost: 9.00 },
      { name: 'Mineral Water 500ml', qty: 72, cost: 4.00 },
      { name: 'Energade 500ml', qty: 24, cost: 12.00 },
    ],
  },
  {
    daysAgoN: 15, supplier: 'Jumbo Wholesale',
    items: [
      { name: 'Simba Chips 120g', qty: 36, cost: 8.50 },
      { name: 'Nik Naks 135g', qty: 36, cost: 8.50 },
      { name: 'Peanuts 100g', qty: 36, cost: 6.00 },
      { name: 'Chappies Gum x5', qty: 60, cost: 1.50 },
      { name: 'Bar One 55g', qty: 24, cost: 9.00 },
    ],
  },
  {
    daysAgoN: 5, supplier: 'Tiger Brands',
    items: [
      { name: 'White Bread 700g', qty: 20, cost: 12.00 },
      { name: 'Brown Bread 700g', qty: 20, cost: 12.50 },
      { name: 'Full Cream Milk 1L', qty: 24, cost: 16.00 },
      { name: 'Eggs x6', qty: 20, cost: 20.00 },
      { name: 'Yogurt 175g', qty: 18, cost: 8.00 },
    ],
  },
]

for (const p of purchaseDefs) {
  const total = p.items.reduce((s, i) => s + i.qty * i.cost, 0)
  const sup = supByName[p.supplier]

  const { data: purchase } = await supabase
    .from('purchases')
    .insert({
      user_id: USER_ID,
      supplier_id: sup.id,
      supplier_name: sup.name,
      purchase_date: daysAgo(p.daysAgoN).slice(0, 10),
      total_amount: total,
      created_at: daysAgo(p.daysAgoN),
    })
    .select('id')
    .single()

  for (const item of p.items) {
    const prod = prodByName[item.name]
    if (!prod) { console.warn('  ! product not found:', item.name); continue }

    const { data: pi } = await supabase
      .from('purchase_items')
      .insert({
        purchase_id: purchase.id,
        product_id: prod.id,
        quantity: item.qty,
        unit_cost: item.cost,
      })
      .select('id')
      .single()

    await supabase.from('inventory_movements').insert({
      user_id: USER_ID,
      product_id: prod.id,
      purchase_item_id: pi.id,
      quantity: item.qty,
      movement_type: 'purchase',
    })
  }
}
console.log('✓ Purchases:', purchaseDefs.length)

// ─── sales ───────────────────────────────────────────────────────────────────
// ~80 sales spread over 90 days, mix of walk-in and with customer

const allProducts = Object.values(prodByName)
const allCustomers = customers

// pre-build stock tracker so we don't oversell
const stock = {}
for (const p of allProducts) stock[p.id] = 0
for (const p of purchaseDefs) {
  for (const item of p.items) {
    const prod = prodByName[item.name]
    if (prod) stock[prod.id] = (stock[prod.id] || 0) + item.qty
  }
}

// generate sale days: ~1-3 sales per day, denser towards recent days
const saleDays = []
for (let d = 89; d >= 1; d--) {
  const count = d > 30 ? randomBetween(0, 2) : randomBetween(1, 4)
  for (let i = 0; i < count; i++) saleDays.push(d)
}

let salesCount = 0

for (const dayN of saleDays.slice(0, 90)) {
  // pick 1-4 items for this sale
  const itemCount = randomBetween(1, 4)
  const shuffled = shuffle(allProducts)
  const saleItems = []

  for (const prod of shuffled) {
    if (saleItems.length >= itemCount) break
    if ((stock[prod.id] || 0) < 1) continue
    const qty = randomBetween(1, Math.min(3, stock[prod.id]))
    saleItems.push({ prod, qty })
  }

  if (saleItems.length === 0) continue

  const total = saleItems.reduce((s, i) => s + i.qty * Number(i.prod.selling_price), 0)
  const withCustomer = Math.random() < 0.3
  const customer = withCustomer ? pick(allCustomers) : null

  const { data: sale } = await supabase
    .from('sales')
    .insert({
      user_id: USER_ID,
      total_amount: total,
      customer_id: customer?.id ?? null,
      created_at: daysAgo(dayN),
    })
    .select('id')
    .single()

  for (const { prod, qty } of saleItems) {
    await supabase.from('sale_items').insert({
      sale_id: sale.id,
      product_id: prod.id,
      quantity: qty,
      unit_price: prod.selling_price,
    })
    await supabase.from('inventory_movements').insert({
      user_id: USER_ID,
      product_id: prod.id,
      quantity: -qty,
      movement_type: 'sale',
      notes: 'sale ' + sale.id,
    })
    stock[prod.id] -= qty
  }

  salesCount++
}

console.log('✓ Sales:', salesCount)
console.log('\n🎉 Seed complete!')

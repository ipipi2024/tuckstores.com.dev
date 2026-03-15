import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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

function daysAgo(n, hourOffset = 10) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hourOffset, 0, 0, 0)
  return d.toISOString()
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

// ─── get user ────────────────────────────────────────────────────────────────
const { data: users } = await supabase.from('users').select('id').limit(1)
if (!users?.length) { console.error('No users found.'); process.exit(1) }
const USER_ID = users[0].id
console.log('Seeding for user:', USER_ID)

// ─── clear existing transactional data ───────────────────────────────────────
console.log('Clearing old data...')
await supabase.from('inventory_movements').delete().eq('user_id', USER_ID)
await supabase.from('sale_items').delete().in('sale_id',
  (await supabase.from('sales').select('id').eq('user_id', USER_ID)).data?.map(r => r.id) ?? []
)
await supabase.from('sales').delete().eq('user_id', USER_ID)
await supabase.from('purchase_items').delete().in('purchase_id',
  (await supabase.from('purchases').select('id').eq('user_id', USER_ID)).data?.map(r => r.id) ?? []
)
await supabase.from('purchases').delete().eq('user_id', USER_ID)
console.log('✓ Cleared')

// ─── categories ──────────────────────────────────────────────────────────────
const categoryNames = ['Beverages', 'Snacks', 'Dairy', 'Bread & Bakery', 'Sweets & Candy', 'Household', 'Tobacco']
const { data: existingCats } = await supabase.from('product_categories').select('id, name').eq('user_id', USER_ID)
const existingCatNames = new Set(existingCats.map(c => c.name))
const newCatNames = categoryNames.filter(n => !existingCatNames.has(n))
let newCats = []
if (newCatNames.length) {
  const { data } = await supabase.from('product_categories').insert(newCatNames.map(name => ({ user_id: USER_ID, name }))).select('id, name')
  newCats = data ?? []
}
const categories = [...existingCats, ...newCats]
const catByName = Object.fromEntries(categories.map(c => [c.name, c.id]))
console.log('✓ Categories')

// ─── products ────────────────────────────────────────────────────────────────
const productDefs = [
  { name: 'Coca-Cola 500ml',     selling_price: 15.00, category: 'Beverages',      barcode: '5449000000996' },
  { name: 'Fanta Orange 500ml',  selling_price: 15.00, category: 'Beverages',      barcode: '5449000131805' },
  { name: 'Sprite 500ml',        selling_price: 15.00, category: 'Beverages',      barcode: '5449000014535' },
  { name: 'Mineral Water 500ml', selling_price: 8.00,  category: 'Beverages',      barcode: '6001230100015' },
  { name: 'Energade 500ml',      selling_price: 18.00, category: 'Beverages',      barcode: '6001230200012' },
  { name: 'Simba Chips 120g',    selling_price: 14.00, category: 'Snacks',         barcode: '6001234500012' },
  { name: 'Nik Naks 135g',       selling_price: 14.00, category: 'Snacks',         barcode: '6001234600019' },
  { name: 'Peanuts 100g',        selling_price: 10.00, category: 'Snacks',         barcode: '6001234700016' },
  { name: 'Biltong 50g',         selling_price: 22.00, category: 'Snacks',         barcode: '6001234800013' },
  { name: 'Full Cream Milk 1L',  selling_price: 22.00, category: 'Dairy',          barcode: '6001010000018' },
  { name: 'Yogurt 175g',         selling_price: 12.00, category: 'Dairy',          barcode: '6001010100015' },
  { name: 'Cheese Slices 200g',  selling_price: 35.00, category: 'Dairy',          barcode: '6001010200012' },
  { name: 'Eggs x6',             selling_price: 28.00, category: 'Dairy',          barcode: '6001010300019' },
  { name: 'White Bread 700g',    selling_price: 18.00, category: 'Bread & Bakery', barcode: '6001020000011' },
  { name: 'Brown Bread 700g',    selling_price: 19.00, category: 'Bread & Bakery', barcode: '6001020100018' },
  { name: 'Vetkoek x2',          selling_price: 6.00,  category: 'Bread & Bakery', barcode: null },
  { name: 'Chappies Gum x5',     selling_price: 3.00,  category: 'Sweets & Candy', barcode: '6001030000010' },
  { name: 'Bar One 55g',         selling_price: 14.00, category: 'Sweets & Candy', barcode: '6001030100017' },
  { name: 'Fizz Pop',            selling_price: 2.00,  category: 'Sweets & Candy', barcode: null },
  { name: 'Lollipop',            selling_price: 2.00,  category: 'Sweets & Candy', barcode: null },
  { name: 'Sunlight Dish Soap',  selling_price: 28.00, category: 'Household',      barcode: '6001040000019' },
  { name: 'Washing Powder 500g', selling_price: 32.00, category: 'Household',      barcode: '6001040100016' },
  { name: 'Matches (box)',       selling_price: 5.00,  category: 'Household',      barcode: null },
  { name: 'Cigarette (single)',  selling_price: 5.00,  category: 'Tobacco',        barcode: null },
  { name: 'Cigarettes 10-pack',  selling_price: 45.00, category: 'Tobacco',        barcode: '6001050100011' },
]

const { data: existingProds } = await supabase.from('products').select('id, name, selling_price').eq('user_id', USER_ID)
const existingProdNames = new Set(existingProds.map(p => p.name))
const toInsert = productDefs.filter(p => !existingProdNames.has(p.name))
let newProds = []
if (toInsert.length) {
  const { data } = await supabase.from('products').insert(
    toInsert.map(p => ({ user_id: USER_ID, name: p.name, selling_price: p.selling_price, category_id: catByName[p.category], barcode: p.barcode ?? null }))
  ).select('id, name, selling_price')
  newProds = data ?? []
}
const products = [...existingProds, ...newProds]
const prodByName = Object.fromEntries(products.map(p => [p.name, p]))
console.log('✓ Products:', products.length)

// ─── customers ───────────────────────────────────────────────────────────────
const customerDefs = [
  { name: 'Sipho Dlamini',   phone: '0711234567' },
  { name: 'Nomsa Khumalo',   phone: '0829876543', email: 'nomsa@gmail.com' },
  { name: 'Thabo Nkosi',     phone: '0763456789' },
  { name: 'Zanele Mokoena',  phone: '0654321098' },
  { name: 'Bongani Zulu',    phone: '0831234567' },
  { name: 'Lerato Sithole',  phone: '0712345678', email: 'lerato@webmail.co.za' },
  { name: 'Mpho Molefe',     phone: '0729876543' },
  { name: 'Thandeka Ndlovu', phone: '0843210987' },
]
const { data: existingCusts } = await supabase.from('customers').select('id, name').eq('user_id', USER_ID)
const existingCustNames = new Set(existingCusts.map(c => c.name))
const newCustDefs = customerDefs.filter(c => !existingCustNames.has(c.name))
let newCusts = []
if (newCustDefs.length) {
  const { data } = await supabase.from('customers').insert(newCustDefs.map(c => ({ user_id: USER_ID, ...c }))).select('id, name')
  newCusts = data ?? []
}
const customers = [...existingCusts, ...newCusts]
console.log('✓ Customers:', customers.length)

// ─── suppliers ───────────────────────────────────────────────────────────────
const supplierDefs = [
  { name: 'Metro Cash & Carry', phone: '0113456789', email: 'orders@metro.co.za' },
  { name: 'Jumbo Wholesale',    phone: '0114567890', email: 'sales@jumbo.co.za' },
  { name: 'Tiger Brands',       phone: '0115678901' },
  { name: 'Cold Drinks Direct', phone: '0116789012', email: 'info@cdd.co.za' },
]
const { data: existingSups } = await supabase.from('suppliers').select('id, name').eq('user_id', USER_ID)
const existingSupNames = new Set(existingSups.map(s => s.name))
const newSupDefs = supplierDefs.filter(s => !existingSupNames.has(s.name))
let newSups = []
if (newSupDefs.length) {
  const { data } = await supabase.from('suppliers').insert(newSupDefs.map(s => ({ user_id: USER_ID, ...s }))).select('id, name')
  newSups = data ?? []
}
const suppliers = [...existingSups, ...newSups]
const supByName = Object.fromEntries(suppliers.map(s => [s.name, s]))
console.log('✓ Suppliers:', suppliers.length)

// ─── purchases (6 months, varying prices per supplier) ───────────────────────
// Prices drift upward over time (inflation) + each supplier has different base prices
const purchaseDefs = [
  // Month 6 ago (oldest) — low prices
  { daysAgoN: 175, supplier: 'Cold Drinks Direct', items: [
    { name: 'Coca-Cola 500ml', qty: 48, cost: 8.50 },
    { name: 'Fanta Orange 500ml', qty: 48, cost: 8.50 },
    { name: 'Sprite 500ml', qty: 24, cost: 8.50 },
    { name: 'Energade 500ml', qty: 24, cost: 11.00 },
  ]},
  { daysAgoN: 172, supplier: 'Jumbo Wholesale', items: [
    { name: 'Simba Chips 120g', qty: 36, cost: 8.00 },
    { name: 'Nik Naks 135g', qty: 36, cost: 8.00 },
    { name: 'Peanuts 100g', qty: 24, cost: 5.50 },
    { name: 'Chappies Gum x5', qty: 60, cost: 1.20 },
    { name: 'Bar One 55g', qty: 30, cost: 8.50 },
  ]},
  { daysAgoN: 170, supplier: 'Tiger Brands', items: [
    { name: 'White Bread 700g', qty: 20, cost: 11.00 },
    { name: 'Brown Bread 700g', qty: 20, cost: 11.50 },
    { name: 'Full Cream Milk 1L', qty: 24, cost: 15.00 },
    { name: 'Eggs x6', qty: 20, cost: 18.00 },
  ]},
  { daysAgoN: 168, supplier: 'Metro Cash & Carry', items: [
    { name: 'Coca-Cola 500ml', qty: 48, cost: 9.20 },  // Metro is pricier than Cold Drinks
    { name: 'Mineral Water 500ml', qty: 48, cost: 3.80 },
    { name: 'Sunlight Dish Soap', qty: 12, cost: 19.00 },
    { name: 'Washing Powder 500g', qty: 12, cost: 23.00 },
    { name: 'Matches (box)', qty: 24, cost: 2.80 },
  ]},

  // Month 5 ago
  { daysAgoN: 145, supplier: 'Cold Drinks Direct', items: [
    { name: 'Coca-Cola 500ml', qty: 72, cost: 8.70 },
    { name: 'Fanta Orange 500ml', qty: 48, cost: 8.70 },
    { name: 'Sprite 500ml', qty: 48, cost: 8.70 },
    { name: 'Mineral Water 500ml', qty: 72, cost: 3.90 },
  ]},
  { daysAgoN: 142, supplier: 'Tiger Brands', items: [
    { name: 'White Bread 700g', qty: 30, cost: 11.50 },
    { name: 'Brown Bread 700g', qty: 20, cost: 12.00 },
    { name: 'Full Cream Milk 1L', qty: 36, cost: 15.50 },
    { name: 'Yogurt 175g', qty: 24, cost: 7.50 },
    { name: 'Cheese Slices 200g', qty: 12, cost: 25.00 },
  ]},
  { daysAgoN: 140, supplier: 'Jumbo Wholesale', items: [
    { name: 'Simba Chips 120g', qty: 48, cost: 8.20 },
    { name: 'Nik Naks 135g', qty: 48, cost: 8.20 },
    { name: 'Biltong 50g', qty: 24, cost: 13.50 },
    { name: 'Cigarette (single)', qty: 200, cost: 2.90 },
    { name: 'Cigarettes 10-pack', qty: 20, cost: 30.00 },
  ]},
  { daysAgoN: 138, supplier: 'Metro Cash & Carry', items: [
    { name: 'Coca-Cola 500ml', qty: 48, cost: 9.30 },
    { name: 'Sunlight Dish Soap', qty: 12, cost: 19.50 },
    { name: 'Washing Powder 500g', qty: 12, cost: 23.50 },
    { name: 'White Bread 700g', qty: 20, cost: 12.00 }, // Metro stocks bread too, pricier
    { name: 'Eggs x6', qty: 20, cost: 19.00 },
  ]},

  // Month 4 ago — prices starting to rise
  { daysAgoN: 115, supplier: 'Cold Drinks Direct', items: [
    { name: 'Coca-Cola 500ml', qty: 96, cost: 8.80 },
    { name: 'Fanta Orange 500ml', qty: 48, cost: 8.80 },
    { name: 'Sprite 500ml', qty: 48, cost: 8.80 },
    { name: 'Energade 500ml', qty: 36, cost: 11.50 },
  ]},
  { daysAgoN: 112, supplier: 'Tiger Brands', items: [
    { name: 'White Bread 700g', qty: 20, cost: 12.00 },
    { name: 'Brown Bread 700g', qty: 20, cost: 12.50 },
    { name: 'Full Cream Milk 1L', qty: 24, cost: 16.00 },
    { name: 'Eggs x6', qty: 20, cost: 19.50 },
    { name: 'Yogurt 175g', qty: 18, cost: 8.00 },
  ]},
  { daysAgoN: 110, supplier: 'Jumbo Wholesale', items: [
    { name: 'Simba Chips 120g', qty: 36, cost: 8.50 },
    { name: 'Nik Naks 135g', qty: 36, cost: 8.50 },
    { name: 'Peanuts 100g', qty: 36, cost: 6.00 },
    { name: 'Chappies Gum x5', qty: 60, cost: 1.30 },
    { name: 'Bar One 55g', qty: 24, cost: 9.00 },
    { name: 'Lollipop', qty: 60, cost: 1.00 },
  ]},
  { daysAgoN: 108, supplier: 'Metro Cash & Carry', items: [
    { name: 'Coca-Cola 500ml', qty: 48, cost: 9.50 },
    { name: 'Mineral Water 500ml', qty: 72, cost: 4.00 },
    { name: 'Sunlight Dish Soap', qty: 12, cost: 20.00 },
    { name: 'Matches (box)', qty: 24, cost: 3.00 },
    { name: 'Cigarette (single)', qty: 200, cost: 3.10 },
  ]},

  // Month 3 ago
  { daysAgoN: 85, supplier: 'Cold Drinks Direct', items: [
    { name: 'Coca-Cola 500ml', qty: 96, cost: 9.00 },
    { name: 'Fanta Orange 500ml', qty: 48, cost: 9.00 },
    { name: 'Sprite 500ml', qty: 48, cost: 9.00 },
    { name: 'Mineral Water 500ml', qty: 72, cost: 4.00 },
    { name: 'Energade 500ml', qty: 24, cost: 12.00 },
  ]},
  { daysAgoN: 82, supplier: 'Tiger Brands', items: [
    { name: 'White Bread 700g', qty: 30, cost: 12.50 },
    { name: 'Brown Bread 700g', qty: 20, cost: 13.00 },
    { name: 'Full Cream Milk 1L', qty: 36, cost: 16.50 },
    { name: 'Yogurt 175g', qty: 24, cost: 8.00 },
    { name: 'Cheese Slices 200g', qty: 12, cost: 26.00 },
    { name: 'Eggs x6', qty: 20, cost: 20.00 },
  ]},
  { daysAgoN: 80, supplier: 'Jumbo Wholesale', items: [
    { name: 'Simba Chips 120g', qty: 48, cost: 8.50 },
    { name: 'Nik Naks 135g', qty: 48, cost: 8.50 },
    { name: 'Biltong 50g', qty: 20, cost: 14.00 },
    { name: 'Cigarette (single)', qty: 200, cost: 3.00 },
    { name: 'Cigarettes 10-pack', qty: 20, cost: 31.00 },
  ]},
  { daysAgoN: 78, supplier: 'Metro Cash & Carry', items: [
    { name: 'Coca-Cola 500ml', qty: 48, cost: 9.60 },
    { name: 'Sunlight Dish Soap', qty: 12, cost: 20.50 },
    { name: 'Washing Powder 500g', qty: 12, cost: 24.00 },
    { name: 'White Bread 700g', qty: 20, cost: 13.00 },
  ]},

  // Month 2 ago — noticeable price increases
  { daysAgoN: 55, supplier: 'Cold Drinks Direct', items: [
    { name: 'Coca-Cola 500ml', qty: 96, cost: 9.20 },
    { name: 'Fanta Orange 500ml', qty: 48, cost: 9.20 },
    { name: 'Sprite 500ml', qty: 48, cost: 9.20 },
    { name: 'Energade 500ml', qty: 36, cost: 12.50 },
  ]},
  { daysAgoN: 52, supplier: 'Tiger Brands', items: [
    { name: 'White Bread 700g', qty: 20, cost: 13.00 },
    { name: 'Brown Bread 700g', qty: 20, cost: 13.50 },
    { name: 'Full Cream Milk 1L', qty: 24, cost: 17.00 },
    { name: 'Eggs x6', qty: 20, cost: 21.00 },
    { name: 'Yogurt 175g', qty: 18, cost: 8.50 },
  ]},
  { daysAgoN: 50, supplier: 'Jumbo Wholesale', items: [
    { name: 'Simba Chips 120g', qty: 36, cost: 9.00 },
    { name: 'Nik Naks 135g', qty: 36, cost: 9.00 },
    { name: 'Peanuts 100g', qty: 36, cost: 6.50 },
    { name: 'Chappies Gum x5', qty: 60, cost: 1.40 },
    { name: 'Bar One 55g', qty: 24, cost: 9.50 },
  ]},
  { daysAgoN: 48, supplier: 'Metro Cash & Carry', items: [
    { name: 'Coca-Cola 500ml', qty: 48, cost: 9.80 },
    { name: 'Mineral Water 500ml', qty: 72, cost: 4.20 },
    { name: 'Sunlight Dish Soap', qty: 12, cost: 21.00 },
    { name: 'Cigarette (single)', qty: 200, cost: 3.20 },
    { name: 'Cigarettes 10-pack', qty: 20, cost: 33.00 },
  ]},

  // Last month — highest prices
  { daysAgoN: 28, supplier: 'Cold Drinks Direct', items: [
    { name: 'Coca-Cola 500ml', qty: 96, cost: 9.50 },
    { name: 'Fanta Orange 500ml', qty: 72, cost: 9.50 },
    { name: 'Sprite 500ml', qty: 48, cost: 9.50 },
    { name: 'Mineral Water 500ml', qty: 72, cost: 4.20 },
    { name: 'Energade 500ml', qty: 24, cost: 13.00 },
  ]},
  { daysAgoN: 25, supplier: 'Tiger Brands', items: [
    { name: 'White Bread 700g', qty: 30, cost: 13.50 },
    { name: 'Brown Bread 700g', qty: 20, cost: 14.00 },
    { name: 'Full Cream Milk 1L', qty: 36, cost: 17.50 },
    { name: 'Eggs x6', qty: 20, cost: 22.00 },
    { name: 'Yogurt 175g', qty: 24, cost: 9.00 },
    { name: 'Cheese Slices 200g', qty: 12, cost: 27.00 },
  ]},
  { daysAgoN: 22, supplier: 'Jumbo Wholesale', items: [
    { name: 'Simba Chips 120g', qty: 48, cost: 9.00 },
    { name: 'Nik Naks 135g', qty: 48, cost: 9.00 },
    { name: 'Biltong 50g', qty: 24, cost: 15.00 },
    { name: 'Peanuts 100g', qty: 36, cost: 6.50 },
    { name: 'Lollipop', qty: 60, cost: 1.10 },
    { name: 'Fizz Pop', qty: 60, cost: 1.10 },
  ]},
  { daysAgoN: 20, supplier: 'Metro Cash & Carry', items: [
    { name: 'Coca-Cola 500ml', qty: 48, cost: 10.00 },  // Metro prices up sharply — volatile
    { name: 'Sunlight Dish Soap', qty: 12, cost: 22.00 },
    { name: 'Washing Powder 500g', qty: 12, cost: 25.00 },
    { name: 'Matches (box)', qty: 24, cost: 3.20 },
    { name: 'White Bread 700g', qty: 20, cost: 14.00 },
  ]},

  // Recent top-up purchases
  { daysAgoN: 8, supplier: 'Cold Drinks Direct', items: [
    { name: 'Coca-Cola 500ml', qty: 48, cost: 9.50 },
    { name: 'Sprite 500ml', qty: 24, cost: 9.50 },
    { name: 'Energade 500ml', qty: 24, cost: 13.00 },
  ]},
  { daysAgoN: 5, supplier: 'Tiger Brands', items: [
    { name: 'White Bread 700g', qty: 20, cost: 13.50 },
    { name: 'Full Cream Milk 1L', qty: 24, cost: 17.50 },
    { name: 'Eggs x6', qty: 20, cost: 22.00 },
  ]},
  { daysAgoN: 3, supplier: 'Jumbo Wholesale', items: [
    { name: 'Simba Chips 120g', qty: 36, cost: 9.20 },
    { name: 'Nik Naks 135g', qty: 36, cost: 9.20 },
    { name: 'Chappies Gum x5', qty: 60, cost: 1.50 },
    { name: 'Bar One 55g', qty: 24, cost: 9.80 },
  ]},
]

// track stock
const stock = {}
for (const p of products) stock[p.id] = 0

for (const p of purchaseDefs) {
  const total = p.items.reduce((s, i) => s + i.qty * i.cost, 0)
  const sup = supByName[p.supplier]
  const { data: purchase } = await supabase.from('purchases').insert({
    user_id: USER_ID,
    supplier_id: sup.id,
    supplier_name: sup.name,
    purchase_date: daysAgo(p.daysAgoN).slice(0, 10),
    total_amount: total,
    created_at: daysAgo(p.daysAgoN),
  }).select('id').single()

  for (const item of p.items) {
    const prod = prodByName[item.name]
    if (!prod) continue
    const { data: pi } = await supabase.from('purchase_items').insert({
      purchase_id: purchase.id, product_id: prod.id, quantity: item.qty, unit_cost: item.cost,
    }).select('id').single()
    await supabase.from('inventory_movements').insert({
      user_id: USER_ID, product_id: prod.id, purchase_item_id: pi.id,
      quantity: item.qty, movement_type: 'purchase',
    })
    stock[prod.id] = (stock[prod.id] || 0) + item.qty
  }
}
console.log('✓ Purchases:', purchaseDefs.length)

// ─── sales (6 months, growing trend + weekend spikes) ────────────────────────
// Beverage-heavy: Coca-Cola sells 3x more than anything else
const salesCount = { total: 0 }

// weight map — higher = sold more often
const productWeights = {
  'Coca-Cola 500ml': 12, 'Fanta Orange 500ml': 8, 'Sprite 500ml': 7,
  'Mineral Water 500ml': 6, 'Energade 500ml': 4,
  'Simba Chips 120g': 8, 'Nik Naks 135g': 7, 'Peanuts 100g': 5,
  'White Bread 700g': 9, 'Brown Bread 700g': 6, 'Vetkoek x2': 5,
  'Full Cream Milk 1L': 7, 'Eggs x6': 6, 'Yogurt 175g': 3,
  'Chappies Gum x5': 6, 'Bar One 55g': 5, 'Fizz Pop': 4, 'Lollipop': 4,
  'Biltong 50g': 3, 'Cheese Slices 200g': 2,
  'Cigarette (single)': 8, 'Cigarettes 10-pack': 3,
  'Sunlight Dish Soap': 2, 'Washing Powder 500g': 1, 'Matches (box)': 3,
}

// build weighted product pool
const weightedPool = []
for (const [name, weight] of Object.entries(productWeights)) {
  const prod = prodByName[name]
  if (prod) for (let i = 0; i < weight; i++) weightedPool.push(prod)
}

for (let dayN = 180; dayN >= 1; dayN--) {
  const date = new Date()
  date.setDate(date.getDate() - dayN)
  const dayOfWeek = date.getDay() // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

  // growth factor: recent days get more sales
  const growthFactor = 1 + (180 - dayN) / 180 * 1.5  // 1x at start, 2.5x at end

  // base sales count per day
  const baseSales = isWeekend ? randomBetween(5, 9) : randomBetween(2, 5)
  const daySales = Math.round(baseSales * growthFactor)

  for (let s = 0; s < daySales; s++) {
    const itemCount = randomBetween(1, 4)
    const saleItems = []

    const shuffled = shuffle([...weightedPool])
    const seen = new Set()

    for (const prod of shuffled) {
      if (saleItems.length >= itemCount) break
      if (seen.has(prod.id)) continue
      if ((stock[prod.id] || 0) < 1) continue
      seen.add(prod.id)
      const qty = randomBetween(1, Math.min(4, stock[prod.id]))
      saleItems.push({ prod, qty })
    }

    if (saleItems.length === 0) continue

    const total = saleItems.reduce((s, i) => s + i.qty * Number(i.prod.selling_price), 0)
    const withCustomer = Math.random() < 0.25
    const customer = withCustomer ? pick(customers) : null

    // spread sale times throughout the day (8am–8pm)
    const hour = randomBetween(8, 20)
    const saleDate = new Date(date)
    saleDate.setHours(hour, randomBetween(0, 59), 0, 0)

    const { data: sale } = await supabase.from('sales').insert({
      user_id: USER_ID,
      total_amount: total,
      customer_id: customer?.id ?? null,
      created_at: saleDate.toISOString(),
    }).select('id').single()

    for (const { prod, qty } of saleItems) {
      await supabase.from('sale_items').insert({
        sale_id: sale.id, product_id: prod.id, quantity: qty, unit_price: prod.selling_price,
      })
      await supabase.from('inventory_movements').insert({
        user_id: USER_ID, product_id: prod.id, quantity: -qty,
        movement_type: 'sale', notes: 'sale ' + sale.id,
      })
      stock[prod.id] = Math.max(0, (stock[prod.id] || 0) - qty)
    }

    salesCount.total++
  }
}

console.log('✓ Sales:', salesCount.total)
console.log('\n🎉 Seed complete!')

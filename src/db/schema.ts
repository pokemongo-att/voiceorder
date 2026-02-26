import { pgTable, uuid, text, boolean, integer, numeric, timestamp, index } from "drizzle-orm/pg-core";

// ---------- legacy (kept for backward compat) ----------
export const menus = pgTable(
  "menus",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().unique(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    nameIdx: index("menus_name_idx").on(t.name)
  })
);

// ---------- products ----------
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().unique(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull().default("20"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    nameIdx: index("products_name_idx").on(t.name)
  })
);

// ---------- staffs ----------
export const staffs = pgTable(
  "staffs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    role: text("role").notNull().default("staff"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  }
);

// ---------- users (auth) ----------
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("staff"),
    staffId: uuid("staff_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    usernameIdx: index("users_username_idx").on(t.username)
  })
);

// ---------- orders (upgraded) ----------
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rawText: text("raw_text").notNull().default(""),
    createdBy: text("created_by").notNull().default("staff"),
    staffId: uuid("staff_id"),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    totalQty: integer("total_qty").notNull().default(0),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    createdAtIdx: index("orders_created_at_idx").on(t.createdAt),
    statusIdx: index("orders_status_idx").on(t.status)
  })
);

// ---------- order_items (upgraded) ----------
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").notNull(),
    productId: uuid("product_id").notNull(),
    productNameSnapshot: text("product_name_snapshot").notNull(),
    priceSnapshot: numeric("price_snapshot", { precision: 10, scale: 2 }).notNull().default("0"),
    qty: integer("qty").notNull().default(1),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0")
  },
  (t) => ({
    orderIdIdx: index("order_items_order_id_idx").on(t.orderId)
  })
);

// ---------- shop_sessions ----------
export const shopSessions = pgTable(
  "shop_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    openedBy: uuid("opened_by").notNull(),
    closedBy: uuid("closed_by"),
    totalSalesSnapshot: numeric("total_sales_snapshot", { precision: 10, scale: 2 })
  }
);

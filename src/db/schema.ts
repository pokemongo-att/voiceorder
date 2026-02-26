import { pgTable, uuid, text, boolean, integer, timestamp, index } from "drizzle-orm/pg-core";

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

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rawText: text("raw_text").notNull().default(""),
    createdBy: text("created_by").notNull().default("staff"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    createdAtIdx: index("orders_created_at_idx").on(t.createdAt)
  })
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").notNull(),
    menuId: uuid("menu_id").notNull(),
    menuName: text("menu_name").notNull(),
    qty: integer("qty").notNull().default(1)
  },
  (t) => ({
    orderIdIdx: index("order_items_order_id_idx").on(t.orderId)
  })
);

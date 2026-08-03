export type OrderStatus =
  | "sent"
  | "accepted"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "cash" | "card";

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  compareAt?: number;
  category: string;
  image: string;
  imagePosition?: string;
  popular?: boolean;
  isNew?: boolean;
  soldOut?: boolean;
  options?: string[];
  optionGroups?: ProductOptionGroup[];
  packageIncludes?: string[];
  availableFrom?: string;
  availableUntil?: string;
  active?: boolean;
};

export type ProductOptionGroup = {
  id: string;
  label: string;
  choices: string[];
  required?: boolean;
};

export type DailyMenuExtra = {
  name: string;
  price: number;
  active?: boolean;
};

export type CartItem = {
  itemId?: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  notes: string;
  option?: string;
  extras?: Array<{ name: string; price: number }>;
  image: string;
};

export type Order = {
  id: string;
  folio: string;
  tableCode: string;
  status: OrderStatus;
  items: CartItem[];
  notes: string;
  subtotal: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  paymentMethod?: PaymentMethod;
  accessToken?: string;
  source?: "supabase" | "demo";
};

export type DailyMenuConfig = {
  active: boolean;
  availableToday: boolean;
  serviceDate: string;
  availableFrom: string;
  availableUntil: string;
  price: number;
  courses: Record<string, string[]>;
  extras?: DailyMenuExtra[];
  updatedAt?: string;
};

export type SalesReport = {
  from: string;
  to: string;
  summary: {
    orderCount: number;
    grossSales: number;
    itemsSold: number;
    averageTicket: number;
    pendingOrders: number;
    pendingAmount: number;
    cashSales: number;
    cashOrders: number;
    cardSales: number;
    cardOrders: number;
    unassignedSales: number;
    unassignedOrders: number;
  };
  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  dailySales: Array<{
    day: string;
    orderCount: number;
    total: number;
  }>;
  orders: Order[];
};

export type TrialStatus = {
  startedAt: string;
  endsAt: string;
  active: boolean;
  daysRemaining: number;
  hoursRemaining: number;
};

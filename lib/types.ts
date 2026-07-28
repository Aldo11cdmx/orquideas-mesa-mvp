export type OrderStatus =
  | "sent"
  | "accepted"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export type Product = {
  id: string;
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
};

export type CartItem = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  notes: string;
  option?: string;
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
  updatedAt?: string;
};

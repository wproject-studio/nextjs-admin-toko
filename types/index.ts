// types/index.ts
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  created_at: string;
  updated_at: string;
  stock?: Stock;
}

export interface Stock {
  id: string;
  product_id: string;
  quantity: number;
  min_stock_level: number;
  updated_at: string;
}

export interface Purchase {
  id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  status: "pending" | "completed" | "cancelled";
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  admin_notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  role: "admin" | "user";
  created_at: string;
  updated_at: string;
}

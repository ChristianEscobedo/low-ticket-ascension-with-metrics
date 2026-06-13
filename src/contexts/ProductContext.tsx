'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface ProductBonus {
  id: string;
  title: string;
  value: string;
  description?: string;
  image?: string;
  icon?: string;
  is_featured?: boolean;
  note?: string;
  display_order: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  original_price_cents: number;
  has_payment_plan: boolean;
  payment_plan_price_cents?: number;
  payment_plan_count?: number;
  stripe_product_id?: string;
  stripe_price_id?: string;
  stripe_payment_plan_price_id?: string;
  features?: string[];
  bonuses?: ProductBonus[];
}

interface ProductContextType {
  product: Product | null;
  isLoading: boolean;
  error: string | null;
  formatPrice: (cents: number) => string;
  savings: number;
  savingsFormatted: string;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

interface ProductProviderProps {
  children: ReactNode;
  productId: string;
  fallbackProduct?: Product;
}

export function ProductProvider({ children, productId, fallbackProduct }: ProductProviderProps) {
  const [product, setProduct] = useState<Product | null>(fallbackProduct || null);
  const [isLoading, setIsLoading] = useState(!fallbackProduct);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/products?product_id=${productId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.product) {
            setProduct(data.product);
          } else if (!fallbackProduct) {
            setError('Product not found');
          }
        } else if (!fallbackProduct) {
          setError('Failed to load product');
        }
      } catch (err) {
        console.error('Error fetching product:', err);
        if (!fallbackProduct) {
          setError('Failed to load product');
        }
      } finally {
        setIsLoading(false);
      }
    }
    fetchProduct();
  }, [productId, fallbackProduct]);

  const formatPrice = (cents: number): string => {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  };

  const savings = product ? product.original_price_cents - product.price_cents : 0;
  const savingsFormatted = formatPrice(savings);

  return (
    <ProductContext.Provider value={{
      product,
      isLoading,
      error,
      formatPrice,
      savings,
      savingsFormatted,
    }}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProduct() {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error('useProduct must be used within a ProductProvider');
  }
  return context;
}


"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  mrp: number;
  price: number;
  taxPercent: number;
  imageUrl?: string;
  availableStock: number;
  inStock: boolean;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function B2BNewQuotationPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [validityDays, setValidityDays] = useState("7");

  useEffect(() => {
    fetchProducts();
  }, [searchQuery, categoryFilter]);

  const fetchProducts = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      params.set("limit", "50");

      const response = await fetch(`/api/v1/b2b/catalog?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        setProducts(result.products || []);
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
    }
  };

  // Mock products for demonstration
  const mockProducts: Product[] = products.length > 0 ? products : [
    {
      id: "1",
      code: "SKU-001",
      name: "Premium Cotton T-Shirt",
      category: "Apparel",
      brand: "Fashion Co",
      mrp: 500,
      price: 450,
      taxPercent: 18,
      availableStock: 500,
      inStock: true,
    },
    {
      id: "2",
      code: "SKU-002",
      name: "Denim Jeans Classic",
      category: "Apparel",
      brand: "DenimPro",
      mrp: 1200,
      price: 1140,
      taxPercent: 18,
      availableStock: 200,
      inStock: true,
    },
    {
      id: "3",
      code: "SKU-003",
      name: "Running Shoes Pro",
      category: "Footwear",
      brand: "SportMax",
      mrp: 2500,
      price: 2250,
      taxPercent: 18,
      availableStock: 100,
      inStock: true,
    },
    {
      id: "4",
      code: "SKU-004",
      name: "Formal Shirt White",
      category: "Apparel",
      brand: "Fashion Co",
      mrp: 850,
      price: 765,
      taxPercent: 18,
      availableStock: 0,
      inStock: false,
    },
  ];

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.product.id === product.id);
    if (existingItem) {
      updateQuantity(product.id, existingItem.quantity + 1);
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }
    setCart(
      cart.map((item) =>
        item.product.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const getCartItem = (productId: string) => {
    return cart.find((item) => item.product.id === productId);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let taxAmount = 0;

    for (const item of cart) {
      const lineTotal = item.product.price * item.quantity;
      const lineTax = lineTotal * (item.product.taxPercent / 100);
      subtotal += lineTotal;
      taxAmount += lineTax;
    }

    return {
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    };
  };

  const totals = calculateTotals();

  const handleSubmit = async () => {
    if (cart.length === 0) {
      alert("Please add at least one item to your quotation request");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/b2b/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            skuId: item.product.id,
            quantity: item.quantity,
          })),
          notes,
          validityDays: parseInt(validityDays),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        router.push(`/portal/quotations/${result.quotation.id}`);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to submit quotation request");
      }
    } catch (error) {
      console.error("Failed to submit quotation:", error);
      alert("Failed to submit quotation request");
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [...new Set(mockProducts.map((p) => p.category).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Request Quotation</h1>
          <p className="text-gray-500">Select products and quantities for your quote request</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Product Selection */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search and Filter */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search products..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category || "uncategorized"}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Product Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Available Products</CardTitle>
              <CardDescription>{mockProducts.length} products found</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : mockProducts.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {mockProducts.map((product) => {
                    const cartItem = getCartItem(product.id);
                    return (
                      <div
                        key={product.id}
                        className={`border rounded-lg p-4 ${!product.inStock ? "opacity-60" : ""}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{product.name}</h4>
                            <p className="text-xs text-gray-500">{product.code}</p>
                          </div>
                          {!product.inStock && (
                            <Badge variant="secondary" className="ml-2">
                              Out of Stock
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div>
                            <p className="font-bold">
                              {product.price.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                            </p>
                            {product.mrp > product.price && (
                              <p className="text-xs text-gray-400 line-through">
                                {product.mrp.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                              </p>
                            )}
                          </div>
                          {product.inStock && (
                            <div>
                              {cartItem ? (
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-8 text-center font-medium">{cartItem.quantity}</span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Button size="sm" onClick={() => addToCart(product)}>
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Tax: {product.taxPercent}% | Stock: {product.availableStock}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No products found</h3>
                  <p className="text-gray-500 mt-1">Try adjusting your search criteria</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cart / Quote Summary */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Quote Summary
              </CardTitle>
              <CardDescription>
                {cart.length === 0 ? "No items added" : `${cart.length} products, ${totals.itemCount} units`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length > 0 ? (
                <>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex items-start justify-between gap-2 py-2 border-b">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.product.name}</p>
                          <p className="text-xs text-gray-500">
                            {item.product.price.toLocaleString("en-IN", { style: "currency", currency: "INR" })} x {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {(item.product.price * item.quantity).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subtotal</span>
                      <span>{totals.subtotal.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Est. Tax (GST)</span>
                      <span>{totals.taxAmount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base pt-2 border-t">
                      <span>Est. Total</span>
                      <span>{totals.total.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="validity">Quote Validity</Label>
                      <Select value={validityDays} onValueChange={setValidityDays}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="notes">Additional Notes</Label>
                      <Textarea
                        id="notes"
                        placeholder="Any special requirements or notes..."
                        className="mt-1"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Add products to request a quotation</p>
                </div>
              )}
            </CardContent>
            {cart.length > 0 && (
              <CardFooter>
                <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Quote Request"}
                </Button>
              </CardFooter>
            )}
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">
                <strong>Note:</strong> This is a quotation request. Final prices may vary based on quantity,
                availability, and negotiated terms. Our team will review and respond within 24-48 hours.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

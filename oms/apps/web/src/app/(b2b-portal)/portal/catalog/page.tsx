"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Filter,
  ShoppingCart,
  Plus,
  Minus,
  Package,
  Grid,
  List,
} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  mrp: number;
  minOrderQty: number;
  stock: number;
  image?: string;
}

interface CartItem extends Product {
  quantity: number;
}

export default function B2BCatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [categoryFilter]);

  const fetchProducts = async () => {
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);

      const response = await fetch(`/api/portal/catalog?${params.toString()}`);
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
    { id: "1", code: "SKU-001", name: "Premium Cotton T-Shirt", category: "Apparel", brand: "StyleCraft", price: 450, mrp: 599, minOrderQty: 10, stock: 500 },
    { id: "2", code: "SKU-002", name: "Denim Jeans Classic", category: "Apparel", brand: "DenimCo", price: 1200, mrp: 1499, minOrderQty: 5, stock: 250 },
    { id: "3", code: "SKU-003", name: "Running Shoes Pro", category: "Footwear", brand: "SportMax", price: 2500, mrp: 3499, minOrderQty: 3, stock: 120 },
    { id: "4", code: "SKU-004", name: "Leather Belt Premium", category: "Accessories", brand: "LeatherCraft", price: 800, mrp: 999, minOrderQty: 12, stock: 800 },
    { id: "5", code: "SKU-005", name: "Formal Shirt White", category: "Apparel", brand: "StyleCraft", price: 850, mrp: 1099, minOrderQty: 6, stock: 350 },
    { id: "6", code: "SKU-006", name: "Sports Cap", category: "Accessories", brand: "SportMax", price: 250, mrp: 349, minOrderQty: 24, stock: 1000 },
  ];

  const categories = ["all", ...new Set(mockProducts.map((p) => p.category))];

  const filteredProducts = mockProducts.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + product.minOrderQty }
            : item
        );
      }
      return [...prev, { ...product, quantity: product.minOrderQty }];
    });
    toast.success(`Added ${product.name} to cart`);
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty < item.minOrderQty) return item;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;

    try {
      const response = await fetch("/api/portal/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            skuId: item.id,
            quantity: item.quantity,
            price: item.price,
          })),
        }),
      });

      if (response.ok) {
        toast.success("Order placed successfully!");
        setCart([]);
        setCartOpen(false);
      } else {
        toast.error("Failed to place order");
      }
    } catch (error) {
      toast.error("Failed to place order");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Product Catalog</h1>
          <p className="text-gray-500">Browse and order products</p>
        </div>

        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetTrigger asChild>
            <Button className="relative">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Cart
              {cartItemCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-red-500">
                  {cartItemCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Shopping Cart ({cart.length} items)</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex-1 overflow-y-auto">
              {cart.length > 0 ? (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                        <Package className="h-8 w-8 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{item.name}</h4>
                        <p className="text-sm text-gray-500">{item.code}</p>
                        <p className="text-sm font-medium text-blue-600">
                          {item.price.toLocaleString("en-IN", {
                            style: "currency",
                            currency: "INR",
                          })}{" "}
                          / unit
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateCartQuantity(item.id, -item.minOrderQty)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-12 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateCartQuantity(item.id, item.minOrderQty)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 ml-auto"
                            onClick={() => removeFromCart(item.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Your cart is empty</p>
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <SheetFooter className="mt-6">
                <div className="w-full space-y-4">
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>
                      {cartTotal.toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                      })}
                    </span>
                  </div>
                  <Button className="w-full" size="lg" onClick={placeOrder}>
                    Place Order
                  </Button>
                </div>
              </SheetFooter>
            )}
          </SheetContent>
        </Sheet>
      </div>

      {/* Filters */}
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
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat === "all" ? "All Categories" : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filteredProducts.length > 0 ? (
        <div
          className={
            viewMode === "grid"
              ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "space-y-4"
          }
        >
          {filteredProducts.map((product) => (
            <Card key={product.id} className={viewMode === "list" ? "flex flex-row" : ""}>
              <div
                className={`${
                  viewMode === "list" ? "w-32 h-32" : "aspect-square"
                } bg-gray-100 flex items-center justify-center rounded-t-lg ${
                  viewMode === "list" ? "rounded-l-lg rounded-tr-none" : ""
                }`}
              >
                <Package className="h-16 w-16 text-gray-300" />
              </div>
              <div className="flex-1">
                <CardHeader className={viewMode === "list" ? "pb-2" : ""}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-gray-500">{product.code}</p>
                      <CardTitle className="text-base">{product.name}</CardTitle>
                    </div>
                    {product.stock < 50 && (
                      <Badge variant="destructive" className="text-xs">
                        Low Stock
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2 text-xs text-gray-500">
                    <span>{product.brand}</span>
                    <span>•</span>
                    <span>{product.category}</span>
                  </div>
                </CardHeader>
                <CardContent className={viewMode === "list" ? "pb-2" : ""}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-blue-600">
                      {product.price.toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                      })}
                    </span>
                    <span className="text-sm text-gray-400 line-through">
                      {product.mrp.toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Min. Order: {product.minOrderQty} units
                  </p>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => addToCart(product)}
                    disabled={product.stock === 0}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Add to Cart
                  </Button>
                </CardFooter>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No products found</h3>
            <p className="text-gray-500 mt-1">Try adjusting your search criteria</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FolderTree,
  Search,
  Tag,
  RefreshCw,
  XCircle,
  Package,
} from "lucide-react";

interface SKU {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  subcategory: string | null;
  status: string;
  isActive: boolean;
}

interface CategorySummary {
  name: string;
  skuCount: number;
  activeCount: number;
  status: "active" | "empty";
}

export default function CategoriesPage() {
  const [search, setSearch] = useState("");

  // Fetch SKUs and extract unique categories
  const {
    data: skus,
    isLoading,
    error,
    refetch,
  } = useQuery<SKU[]>({
    queryKey: ["categories-skus"],
    queryFn: async () => {
      const res = await fetch("/api/v1/skus?limit=5000");
      if (!res.ok) throw new Error("Failed to fetch SKUs");
      const result = await res.json();
      const items: SKU[] = Array.isArray(result)
        ? result
        : result?.items || result?.data || [];
      return items;
    },
  });

  // Derive categories from SKU data
  const categories = useMemo<CategorySummary[]>(() => {
    const items = skus || [];
    const categoryMap = new Map<
      string,
      { count: number; activeCount: number }
    >();

    for (const sku of items) {
      const cat = sku.category || "Uncategorized";
      const existing = categoryMap.get(cat) || { count: 0, activeCount: 0 };
      existing.count += 1;
      if (sku.isActive || sku.status === "ACTIVE") {
        existing.activeCount += 1;
      }
      categoryMap.set(cat, existing);
    }

    return Array.from(categoryMap.entries())
      .map(([name, data]) => ({
        name,
        skuCount: data.count,
        activeCount: data.activeCount,
        status: (data.count > 0 ? "active" : "empty") as "active" | "empty",
      }))
      .sort((a, b) => b.skuCount - a.skuCount);
  }, [skus]);

  // Filter categories by search term
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const term = search.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(term));
  }, [categories, search]);

  // Stats
  const totalCategories = categories.filter(
    (c) => c.name !== "Uncategorized"
  ).length;
  const totalSKUs = (skus || []).length;
  const uncategorizedCount =
    categories.find((c) => c.name === "Uncategorized")?.skuCount || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <XCircle className="h-12 w-12 text-red-500" />
        <p className="text-muted-foreground">Failed to load SKU data</p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">
            Organize your products into categories and subcategories
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Categories
            </CardTitle>
            <FolderTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCategories}</div>
            <p className="text-xs text-muted-foreground">
              Extracted from {totalSKUs} SKUs
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total SKUs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSKUs}</div>
            <p className="text-xs text-muted-foreground">
              Across all categories
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Uncategorized SKUs
            </CardTitle>
            <Tag className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uncategorizedCount}</div>
            <p className="text-xs text-muted-foreground">
              {uncategorizedCount > 0
                ? "Need category assignment"
                : "All SKUs categorized"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Table */}
      <Card>
        <CardHeader>
          <CardTitle>Category List</CardTitle>
          <CardDescription>
            Categories derived from your SKU catalog
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderTree className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">
                {search ? "No Matching Categories" : "No Categories Found"}
              </h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                {search
                  ? `No categories match "${search}". Try a different search term.`
                  : "Categories will appear once SKUs with category information are created."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category Name</TableHead>
                  <TableHead>SKU Count</TableHead>
                  <TableHead>Active SKUs</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map((category) => (
                  <TableRow key={category.name}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FolderTree className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{category.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{category.skuCount}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {category.activeCount}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          category.name === "Uncategorized"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                        }
                      >
                        {category.name === "Uncategorized"
                          ? "Needs Review"
                          : "Active"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import {
  ArrowLeft,
  FileText,
  Plus,
  Trash2,
  Save,
  Send,
  Search,
  CalendarIcon,
  Building2,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

interface Customer {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  priceListId?: string;
}

interface SKU {
  id: string;
  code: string;
  name: string;
  mrp: number;
  sellingPrice: number;
  taxRate: number;
  availableQuantity: number;
}

interface QuotationItem {
  id: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: "PERCENTAGE" | "FIXED";
  taxRate: number;
  total: number;
  notes?: string;
}

function NewQuotationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("customerId");

  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [searchingSKUs, setSearchingSKUs] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [skuSearch, setSkuSearch] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [skuOpen, setSkuOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const [formData, setFormData] = useState({
    customerId: preselectedCustomerId || "",
    customerName: "",
    validUntil: addDays(new Date(), 30),
    notes: "",
    termsAndConditions: "",
  });

  const [items, setItems] = useState<QuotationItem[]>([]);

  const searchCustomers = useCallback(async (search: string) => {
    try {
      setSearchingCustomers(true);
      const response = await fetch(
        `/api/customers?search=${encodeURIComponent(search)}&limit=10`
      );
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.data || []);
      }
    } catch (error) {
      console.error("Error searching customers:", error);
    } finally {
      setSearchingCustomers(false);
    }
  }, []);

  const searchSKUs = useCallback(async (search: string) => {
    try {
      setSearchingSKUs(true);
      const response = await fetch(
        `/api/skus?search=${encodeURIComponent(search)}&limit=10`
      );
      if (response.ok) {
        const data = await response.json();
        setSkus(data.data || []);
      }
    } catch (error) {
      console.error("Error searching SKUs:", error);
    } finally {
      setSearchingSKUs(false);
    }
  }, []);

  const fetchCustomerById = useCallback(async (customerId: string) => {
    try {
      const response = await fetch(`/api/customers/${customerId}`);
      if (response.ok) {
        const customer = await response.json();
        setFormData((prev) => ({
          ...prev,
          customerId: customer.id,
          customerName: customer.name,
        }));
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
    }
  }, []);

  useEffect(() => {
    if (preselectedCustomerId) {
      fetchCustomerById(preselectedCustomerId);
    }
  }, [preselectedCustomerId, fetchCustomerById]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (customerSearch.length >= 2) {
        searchCustomers(customerSearch);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [customerSearch, searchCustomers]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (skuSearch.length >= 2) {
        searchSKUs(skuSearch);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [skuSearch, searchSKUs]);

  const handleSelectCustomer = (customer: Customer) => {
    setFormData({
      ...formData,
      customerId: customer.id,
      customerName: customer.name,
    });
    setCustomerOpen(false);
    setCustomerSearch("");
  };

  const handleAddItem = (sku: SKU) => {
    // Check if SKU already exists
    if (items.some((item) => item.skuId === sku.id)) {
      toast.error("SKU already added to quotation");
      return;
    }

    const newItem: QuotationItem = {
      id: `temp-${Date.now()}`,
      skuId: sku.id,
      skuCode: sku.code,
      skuName: sku.name,
      quantity: 1,
      unitPrice: sku.sellingPrice,
      discount: 0,
      discountType: "PERCENTAGE",
      taxRate: sku.taxRate,
      total: sku.sellingPrice * (1 + sku.taxRate / 100),
      notes: "",
    };

    setItems([...items, newItem]);
    setSkuOpen(false);
    setSkuSearch("");
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter((item) => item.id !== itemId));
  };

  const handleItemChange = (
    itemId: string,
    field: keyof QuotationItem,
    value: number | string
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const updated = { ...item, [field]: value };

        // Recalculate total
        let subtotal = updated.quantity * updated.unitPrice;
        if (updated.discount > 0) {
          if (updated.discountType === "PERCENTAGE") {
            subtotal = subtotal * (1 - updated.discount / 100);
          } else {
            subtotal = subtotal - updated.discount;
          }
        }
        updated.total = subtotal * (1 + updated.taxRate / 100);

        return updated;
      })
    );
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;

    items.forEach((item) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      subtotal += itemSubtotal;

      if (item.discount > 0) {
        if (item.discountType === "PERCENTAGE") {
          discountTotal += itemSubtotal * (item.discount / 100);
        } else {
          discountTotal += item.discount;
        }
      }

      const afterDiscount =
        item.discountType === "PERCENTAGE"
          ? itemSubtotal * (1 - item.discount / 100)
          : itemSubtotal - item.discount;
      taxTotal += afterDiscount * (item.taxRate / 100);
    });

    const total = subtotal - discountTotal + taxTotal;

    return { subtotal, discountTotal, taxTotal, total };
  };

  const handleSave = async (submit: boolean = false) => {
    if (!formData.customerId) {
      toast.error("Please select a customer");
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    try {
      setSaving(true);
      const totals = calculateTotals();

      const response = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formData.customerId,
          validUntil: formData.validUntil.toISOString(),
          notes: formData.notes,
          termsAndConditions: formData.termsAndConditions,
          items: items.map((item) => ({
            skuId: item.skuId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            discountType: item.discountType,
            taxRate: item.taxRate,
            notes: item.notes,
          })),
          ...totals,
          submitForApproval: submit,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create quotation");
      }

      const data = await response.json();
      toast.success(
        submit
          ? "Quotation created and submitted for approval"
          : "Quotation saved as draft"
      );
      router.push(`/b2b/quotations/${data.id}`);
    } catch (error) {
      console.error("Error creating quotation:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create quotation"
      );
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6" />
              New Quotation
            </h1>
            <p className="text-muted-foreground">
              Create a new quotation for a customer
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            <Save className="mr-2 h-4 w-4" />
            Save as Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            <Send className="mr-2 h-4 w-4" />
            Save & Submit
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Customer</Label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-start"
                  >
                    {formData.customerName ? (
                      <span>{formData.customerName}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        Search customers...
                      </span>
                    )}
                    <Search className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search by name or code..."
                      value={customerSearch}
                      onValueChange={setCustomerSearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {searchingCustomers
                          ? "Searching..."
                          : customerSearch.length < 2
                          ? "Type to search..."
                          : "No customers found"}
                      </CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            onSelect={() => handleSelectCustomer(customer)}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{customer.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {customer.code} | {customer.email || "No email"}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quotation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Valid Until</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.validUntil, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.validUntil}
                    onSelect={(date) => {
                      if (date) {
                        setFormData({ ...formData, validUntil: date });
                        setDateOpen(false);
                      }
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Quotation Items
            </CardTitle>
            <CardDescription>Add products to the quotation</CardDescription>
          </div>
          <Popover open={skuOpen} onOpenChange={setSkuOpen}>
            <PopoverTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="end">
              <Command>
                <CommandInput
                  placeholder="Search SKU by code or name..."
                  value={skuSearch}
                  onValueChange={setSkuSearch}
                />
                <CommandList>
                  <CommandEmpty>
                    {searchingSKUs
                      ? "Searching..."
                      : skuSearch.length < 2
                      ? "Type to search..."
                      : "No SKUs found"}
                  </CommandEmpty>
                  <CommandGroup>
                    {skus.map((sku) => (
                      <CommandItem
                        key={sku.id}
                        onSelect={() => handleAddItem(sku)}
                      >
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm">{sku.code}</span>
                            <span className="font-medium">
                              {formatCurrency(sku.sellingPrice)}
                            </span>
                          </div>
                          <span className="text-sm">{sku.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Stock: {sku.availableQuantity} | Tax: {sku.taxRate}%
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No items added. Click "Add Item" to add products.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-24">Qty</TableHead>
                    <TableHead className="w-32">Unit Price</TableHead>
                    <TableHead className="w-24">Discount</TableHead>
                    <TableHead className="w-20">Tax %</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.skuCode}
                      </TableCell>
                      <TableCell>{item.skuName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              "quantity",
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="h-8 w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              "unitPrice",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="h-8 w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discount}
                            onChange={(e) =>
                              handleItemChange(
                                item.id,
                                "discount",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-8 w-16"
                          />
                          <Select
                            value={item.discountType}
                            onValueChange={(value) =>
                              handleItemChange(
                                item.id,
                                "discountType",
                                value as "PERCENTAGE" | "FIXED"
                              )
                            }
                          >
                            <SelectTrigger className="h-8 w-14">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PERCENTAGE">%</SelectItem>
                              <SelectItem value="FIXED">Rs</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.taxRate}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              "taxRate",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="h-8 w-16"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.total)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-4" />

              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(totals.subtotal)}</span>
                  </div>
                  {totals.discountTotal > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(totals.discountTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrency(totals.taxTotal)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(totals.total)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>
              Internal notes or special instructions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Add any notes about this quotation..."
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Terms & Conditions</CardTitle>
            <CardDescription>
              Payment terms and conditions for the customer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.termsAndConditions}
              onChange={(e) =>
                setFormData({ ...formData, termsAndConditions: e.target.value })
              }
              placeholder="Add terms and conditions..."
              rows={4}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function NewQuotationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
    >
      <NewQuotationPageContent />
    </Suspense>
  );
}

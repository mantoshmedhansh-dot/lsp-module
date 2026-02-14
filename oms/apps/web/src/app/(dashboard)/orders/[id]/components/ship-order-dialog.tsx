"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Truck,
  Package,
  CheckCircle,
  Loader2,
  ExternalLink,
  Download,
  Zap,
  IndianRupee,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface RateQuote {
  carrierCode: string;
  carrierName: string;
  rate: number;
  codCharges: number;
  estimatedDays: number;
  serviceType: string;
}

interface ShipResult {
  success: boolean;
  deliveryNo: string;
  awbNumber: string;
  trackingUrl: string;
  labelUrl: string;
  carrier: string;
}

interface ShipOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNo: string;
  onShipped: () => void;
}

export function ShipOrderDialog({
  open,
  onOpenChange,
  orderId,
  orderNo,
  onShipped,
}: ShipOrderDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [quotes, setQuotes] = useState<RateQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<RateQuote | null>(null);
  const [weightGrams, setWeightGrams] = useState(500);
  const [lengthCm, setLengthCm] = useState(10);
  const [breadthCm, setBreadthCm] = useState(10);
  const [heightCm, setHeightCm] = useState(10);
  const [shipResult, setShipResult] = useState<ShipResult | null>(null);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/rate-check`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setQuotes(data.quotes || []);
      } else {
        toast.error(data.error || "Failed to fetch rates");
      }
    } catch {
      toast.error("Failed to fetch shipping rates");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setStep(1);
      setQuotes([]);
      setSelectedCarrier(null);
      setShipResult(null);
      setWeightGrams(500);
      setLengthCm(10);
      setBreadthCm(10);
      setHeightCm(10);
      fetchRates();
    }
    onOpenChange(isOpen);
  };

  const handleShip = async () => {
    if (!selectedCarrier) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrierCode: selectedCarrier.carrierCode,
          weightGrams,
          lengthCm,
          breadthCm,
          heightCm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShipResult(data);
        setStep(3);
        toast.success("Order shipped successfully!");
        onShipped();
      } else {
        toast.error(data.detail || data.error || "Failed to ship order");
      }
    } catch {
      toast.error("Failed to ship order");
    } finally {
      setLoading(false);
    }
  };

  // Find cheapest and fastest
  const cheapest = quotes.length > 0 ? quotes.reduce((a, b) => (a.rate < b.rate ? a : b)) : null;
  const fastest = quotes.length > 0 ? quotes.reduce((a, b) => {
    if (a.estimatedDays === 0) return b;
    if (b.estimatedDays === 0) return a;
    return a.estimatedDays < b.estimatedDays ? a : b;
  }) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Ship Order {orderNo}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Compare carrier rates and select a shipping partner"}
            {step === 2 && "Confirm shipping details before dispatching"}
            {step === 3 && "Order shipped successfully"}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <CheckCircle className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step 1: Rate Comparison */}
        {step === 1 && (
          <div>
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Fetching rates from carriers...</p>
              </div>
            ) : quotes.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Package className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No carrier rates available. Configure carriers in Logistics settings.
                </p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Carrier</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">COD</TableHead>
                      <TableHead className="text-center">Est. Days</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotes.map((q, i) => (
                      <TableRow
                        key={`${q.carrierCode}-${i}`}
                        className={
                          selectedCarrier?.carrierCode === q.carrierCode
                            ? "bg-primary/5 border-primary"
                            : "cursor-pointer hover:bg-muted/50"
                        }
                        onClick={() => setSelectedCarrier(q)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{q.carrierName}</span>
                            {cheapest && q.carrierCode === cheapest.carrierCode && (
                              <Badge variant="secondary" className="text-xs">
                                <IndianRupee className="h-3 w-3 mr-0.5" />
                                Cheapest
                              </Badge>
                            )}
                            {fastest && q.carrierCode === fastest.carrierCode && fastest.carrierCode !== cheapest?.carrierCode && (
                              <Badge variant="outline" className="text-xs">
                                <Zap className="h-3 w-3 mr-0.5" />
                                Fastest
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ₹{q.rate.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {q.codCharges > 0 ? `₹${q.codCharges.toFixed(2)}` : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {q.estimatedDays > 0 ? `${q.estimatedDays}d` : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {q.serviceType || "Standard"}
                        </TableCell>
                        <TableCell>
                          {selectedCarrier?.carrierCode === q.carrierCode && (
                            <CheckCircle className="h-4 w-4 text-primary" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedCarrier}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Confirm Details */}
        {step === 2 && selectedCarrier && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Carrier</span>
                <span className="font-medium">{selectedCarrier.carrierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Rate</span>
                <span className="font-mono">₹{selectedCarrier.rate.toFixed(2)}</span>
              </div>
              {selectedCarrier.estimatedDays > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Est. Delivery</span>
                  <span>{selectedCarrier.estimatedDays} days</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Package Details (optional override)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Weight (grams)</label>
                  <Input
                    type="number"
                    value={weightGrams}
                    onChange={(e) => setWeightGrams(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Length (cm)</label>
                  <Input
                    type="number"
                    value={lengthCm}
                    onChange={(e) => setLengthCm(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Breadth (cm)</label>
                  <Input
                    type="number"
                    value={breadthCm}
                    onChange={(e) => setBreadthCm(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Height (cm)</label>
                  <Input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleShip} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Shipping...
                  </>
                ) : (
                  <>
                    <Truck className="mr-2 h-4 w-4" />
                    Ship Order
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 3 && shipResult && (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center space-y-3">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
              <p className="text-lg font-semibold">Order Shipped!</p>
              <p className="text-sm text-muted-foreground">
                Delivery #{shipResult.deliveryNo}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">AWB Number</span>
                <span className="font-mono font-medium">{shipResult.awbNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Carrier</span>
                <span>{shipResult.carrier}</span>
              </div>
            </div>

            <div className="flex gap-2">
              {shipResult.labelUrl && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(shipResult.labelUrl, "_blank")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Label
                </Button>
              )}
              {shipResult.trackingUrl && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(shipResult.trackingUrl, "_blank")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Track Shipment
                </Button>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

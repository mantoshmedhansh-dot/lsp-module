"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IndianRupee, TrendingUp, Clock, AlertTriangle, CheckCircle, Download } from "lucide-react";

export default function ClientFinanceDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your financial metrics and reconciliation status
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Download Statement
        </Button>
      </div>

      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">₹12,45,678</p>
                <p className="text-sm text-muted-foreground">Total Revenue (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">₹3,45,000</p>
                <p className="text-sm text-muted-foreground">Pending COD</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">₹12,340</p>
                <p className="text-sm text-muted-foreground">Disputed Amount</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">+18%</p>
                <p className="text-sm text-muted-foreground">vs Last Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>COD Reconciliation</CardTitle>
            <CardDescription>Cash on delivery status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total COD Collected</span>
                <span className="font-bold">₹8,90,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Remitted</span>
                <span className="text-green-600 font-medium">₹5,45,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Pending Remittance</span>
                <span className="text-yellow-600 font-medium">₹3,45,000</span>
              </div>
              <div className="pt-2">
                <Button variant="outline" className="w-full">View Details</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Freight Charges</CardTitle>
            <CardDescription>Shipping cost summary</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Freight (MTD)</span>
                <span className="font-bold">₹1,23,456</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Weight Discrepancy</span>
                <span className="text-orange-600 font-medium">₹8,900</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Disputed</span>
                <span className="text-red-600 font-medium">₹3,440</span>
              </div>
              <div className="pt-2">
                <Button variant="outline" className="w-full">View Details</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common financial operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button variant="outline">COD Report</Button>
            <Button variant="outline">Weight Discrepancy</Button>
            <Button variant="outline">Freight Invoice</Button>
            <Button variant="outline">Payment Ledger</Button>
            <Button variant="outline">Download Statement</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

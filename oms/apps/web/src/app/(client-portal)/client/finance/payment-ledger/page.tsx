"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IndianRupee, ArrowUp, ArrowDown, Download } from "lucide-react";

export default function ClientPaymentLedgerPage() {
  const transactions = [
    {
      id: "TXN-001",
      date: "2024-01-15",
      description: "COD Remittance - Delhivery",
      type: "CREDIT",
      amount: 122500,
      balance: 345678,
    },
    {
      id: "TXN-002",
      date: "2024-01-15",
      description: "Freight Charges - BlueDart",
      type: "DEBIT",
      amount: 45312,
      balance: 223178,
    },
    {
      id: "TXN-003",
      date: "2024-01-14",
      description: "COD Remittance - Ekart",
      type: "CREDIT",
      amount: 66150,
      balance: 268490,
    },
    {
      id: "TXN-004",
      date: "2024-01-14",
      description: "Refund Adjustment",
      type: "DEBIT",
      amount: 2499,
      balance: 202340,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Ledger</h1>
          <p className="text-muted-foreground">
            Transaction history and account balance
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Download Statement
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">₹3,45,678</p>
                <p className="text-sm text-muted-foreground">Current Balance</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ArrowUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">₹5,45,000</p>
                <p className="text-sm text-muted-foreground">Credits (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ArrowDown className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">₹1,99,322</p>
                <p className="text-sm text-muted-foreground">Debits (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold">45</p>
              <p className="text-sm text-muted-foreground">Transactions (MTD)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Recent account transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="font-mono">{txn.id}</TableCell>
                  <TableCell className="text-muted-foreground">{txn.date}</TableCell>
                  <TableCell>{txn.description}</TableCell>
                  <TableCell>
                    <Badge className={txn.type === "CREDIT" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      <span className="flex items-center gap-1">
                        {txn.type === "CREDIT" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {txn.type}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${txn.type === "CREDIT" ? "text-green-600" : "text-red-600"}`}>
                    {txn.type === "CREDIT" ? "+" : "-"}₹{txn.amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-bold">₹{txn.balance.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

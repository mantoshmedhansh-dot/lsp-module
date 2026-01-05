"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  CreditCard,
  Trash2,
  Star,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@cjdquick/ui";

interface BankAccount {
  id: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName: string | null;
  accountType: string;
  isVerified: boolean;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
}

async function fetchBankAccounts() {
  const res = await fetch("/api/client/bank-accounts");
  return res.json();
}

export default function ClientBankPage() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["client-bank-accounts"],
    queryFn: fetchBankAccounts,
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await fetch(`/api/client/bank-accounts/${accountId}/set-primary`, {
        method: "POST",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-bank-accounts"] });
    },
  });

  const accounts: BankAccount[] = data?.data || [];
  const primaryAccount = accounts.find((a) => a.isPrimary);

  const maskAccountNumber = (number: string) => {
    if (number.length <= 4) return number;
    return "XXXX" + number.slice(-4);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bank Details</h1>
          <p className="text-gray-600">
            Manage your bank accounts for COD remittance
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/client/bank/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Bank Account
            </Button>
          </Link>
        </div>
      </div>

      {/* Info Banner */}
      {accounts.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-4">
          <AlertCircle className="h-6 w-6 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800">
              No Bank Account Added Yet
            </p>
            <p className="text-sm text-amber-600">
              Add a bank account to receive COD remittances. This is a necessary
              action for you to ship COD orders.
            </p>
          </div>
        </div>
      )}

      {/* Bank Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary-600" />
            Bank Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-gray-300" />
              <p className="mt-4 text-gray-500">
                Seems like no Bank Account is added yet
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Add a bank account to facilitate COD remittances
              </p>
              <Link href="/client/bank/new">
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Bank Account
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className={`p-4 border rounded-lg ${
                    account.isPrimary
                      ? "border-primary-300 bg-primary-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {account.bankName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.isPrimary && (
                        <Badge variant="primary" size="sm">
                          <Star className="h-3 w-3 mr-1" />
                          Primary
                        </Badge>
                      )}
                      {account.isVerified ? (
                        <Badge variant="success" size="sm">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account Holder</span>
                      <span className="text-gray-900">
                        {account.accountHolderName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account Number</span>
                      <span className="text-gray-900 font-mono">
                        {maskAccountNumber(account.accountNumber)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">IFSC Code</span>
                      <span className="text-gray-900 font-mono">
                        {account.ifscCode}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account Type</span>
                      <span className="text-gray-900">{account.accountType}</span>
                    </div>
                    {account.branchName && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Branch</span>
                        <span className="text-gray-900">{account.branchName}</span>
                      </div>
                    )}
                  </div>

                  {!account.isPrimary && (
                    <div className="mt-4 pt-4 border-t flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPrimaryMutation.mutate(account.id)}
                        isLoading={setPrimaryMutation.isPending}
                      >
                        Set as Primary
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* COD Remittance Info */}
      <Card>
        <CardHeader>
          <CardTitle>COD Remittance Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Weekly Settlement:</strong> COD amounts are remitted to
              your primary bank account every Monday for orders delivered in the
              previous week.
            </p>
            <p className="text-sm text-blue-600 mt-2">
              Freight charges and COD handling fees will be deducted from the
              remittance amount.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

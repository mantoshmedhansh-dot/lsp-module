"use client";

import { useState, useEffect } from "react";
import { Package, Truck, RotateCcw, ArrowRightLeft, FileEdit, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type GRNSourceType = "external-po" | "asn" | "return" | "sto" | "manual";

interface SourceCounts {
  externalPo: number;
  asn: number;
  returns: number;
  sto: number;
}

interface GRNSourceSelectorProps {
  onSelect: (source: GRNSourceType) => void;
  selectedSource?: GRNSourceType;
}

interface SourceCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  count?: number;
  countLabel?: string;
  selected: boolean;
  onClick: () => void;
  loading?: boolean;
}

function SourceCard({
  icon,
  title,
  description,
  count,
  countLabel,
  selected,
  onClick,
  loading,
}: SourceCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
        selected && "border-primary ring-2 ring-primary/20"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div
            className={cn(
              "p-3 rounded-full",
              selected ? "bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            {icon}
          </div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {count !== undefined && (
            <div className="text-sm">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className={cn("font-medium", count > 0 ? "text-primary" : "text-muted-foreground")}>
                  {count} {countLabel || "pending"}
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function GRNSourceSelector({ onSelect, selectedSource }: GRNSourceSelectorProps) {
  const [counts, setCounts] = useState<SourceCounts>({
    externalPo: 0,
    asn: 0,
    returns: 0,
    sto: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCounts();
  }, []);

  async function fetchCounts() {
    try {
      setLoading(true);

      // Fetch counts in parallel
      const [poRes, asnRes, returnRes, stoRes] = await Promise.all([
        fetch("/api/v1/external-pos/count?status=OPEN").catch(() => null),
        fetch("/api/v1/asns/count?status=ARRIVED").catch(() => null),
        fetch("/api/v1/returns/count?status=PENDING").catch(() => null),
        fetch("/api/v1/stock-transfers/count?status=IN_TRANSIT").catch(() => null),
      ]);

      const poCount = poRes?.ok ? await poRes.json() : { count: 0 };
      const asnCount = asnRes?.ok ? await asnRes.json() : { count: 0 };
      const returnCount = returnRes?.ok ? await returnRes.json() : { count: 0 };
      const stoCount = stoRes?.ok ? await stoRes.json() : { count: 0 };

      setCounts({
        externalPo: poCount.count || 0,
        asn: asnCount.count || 0,
        returns: returnCount.count || 0,
        sto: stoCount.count || 0,
      });
    } catch (error) {
      console.error("Error fetching source counts:", error);
    } finally {
      setLoading(false);
    }
  }

  const sources = [
    {
      type: "external-po" as GRNSourceType,
      icon: <Package className="h-6 w-6" />,
      title: "External PO",
      description: "From purchase orders",
      count: counts.externalPo,
      countLabel: "open",
    },
    {
      type: "asn" as GRNSourceType,
      icon: <Truck className="h-6 w-6" />,
      title: "ASN",
      description: "Advance shipping notice",
      count: counts.asn,
      countLabel: "arrived",
    },
    {
      type: "return" as GRNSourceType,
      icon: <RotateCcw className="h-6 w-6" />,
      title: "Return",
      description: "Sales returns & RTO",
      count: counts.returns,
      countLabel: "pending",
    },
    {
      type: "sto" as GRNSourceType,
      icon: <ArrowRightLeft className="h-6 w-6" />,
      title: "Stock Transfer",
      description: "Inter-warehouse transfer",
      count: counts.sto,
      countLabel: "in transit",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Select Inbound Source</h2>
        <p className="text-sm text-muted-foreground">
          Choose the type of inbound document to create a Goods Receipt from
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {sources.map((source) => (
          <SourceCard
            key={source.type}
            icon={source.icon}
            title={source.title}
            description={source.description}
            count={source.count}
            countLabel={source.countLabel}
            selected={selectedSource === source.type}
            onClick={() => onSelect(source.type)}
            loading={loading}
          />
        ))}
      </div>

      <div className="pt-4 border-t">
        <SourceCard
          icon={<FileEdit className="h-6 w-6" />}
          title="Manual Entry"
          description="Create GRN without a source document (for direct receipts)"
          selected={selectedSource === "manual"}
          onClick={() => onSelect("manual")}
        />
      </div>
    </div>
  );
}

export default GRNSourceSelector;

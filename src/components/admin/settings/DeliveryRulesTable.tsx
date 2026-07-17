import { Pencil, Trash2, MapPin } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { PageEmpty } from "@/components/admin/page/PageEmpty";
import type { DeliveryFeeRule } from "@/lib/settings-api";

interface Props {
  rules: DeliveryFeeRule[];
  loading?: boolean;
  onEdit?: (rule: DeliveryFeeRule) => void;
  onDelete?: (rule: DeliveryFeeRule) => void;
  onCreate?: () => void;
}

function formatFee(cents?: number | null) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function DeliveryRulesTable({
  rules,
  loading,
  onEdit,
  onDelete,
  onCreate,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <PageEmpty
        icon={MapPin}
        title="Nenhuma regra cadastrada"
        description="Adicione taxas fixas ou por bairro."
        action={onCreate ? { label: "Nova regra", onClick: onCreate } : undefined}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Bairro</TableHead>
            <TableHead className="text-right">Taxa</TableHead>
            <TableHead className="text-right">Estimativa</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>
                <Badge variant={r.type === "FLAT" ? "secondary" : "outline"}>
                  {r.type === "FLAT" ? "Fixa" : "Bairro"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {r.neighborhood ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatFee(r.feeInCents)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.estimatedMinutes != null ? `${r.estimatedMinutes} min` : "—"}
              </TableCell>
              <TableCell>
                {r.active ? <Badge>Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {onEdit && (
                    <Button variant="ghost" size="icon" onClick={() => onEdit(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(r)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

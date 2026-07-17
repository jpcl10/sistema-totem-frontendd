import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Rota de compatibilidade.
 *
 * A antiga tela /admin/online-orders foi absorvida pela Central Operacional
 * unificada em /admin/orders. Mantemos este arquivo apenas para preservar
 * deep links existentes, redirecionando para a central com o filtro de
 * origem já aplicado.
 */
export const Route = createFileRoute("/admin/online-orders")({
  beforeLoad: () => {
    throw redirect({
      to: "/admin/orders",
      search: { origin: "ONLINE" },
      replace: true,
    });
  },
});

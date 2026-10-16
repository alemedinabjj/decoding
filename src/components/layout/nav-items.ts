import { LayoutDashboard, Sparkles, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: "/" | "/iris";
  label: string;
  description: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", description: "Indicadores, funil e oportunidades", icon: LayoutDashboard },
  { href: "/iris", label: "Iris", description: "Assistente de IA da operação comercial", icon: Sparkles },
];

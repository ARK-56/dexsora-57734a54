import { useOrg } from "@/contexts/OrgContext";
import { Building2, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const OrgSwitcher = () => {
  const { organizations, currentOrg, setCurrentOrgId } = useOrg();

  if (organizations.length <= 1) {
    // Single org — just show org name as badge
    return currentOrg ? (
      <div className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 h-9 text-xs font-medium text-white/90">
        <Building2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline max-w-[140px] truncate">{currentOrg.name}</span>
      </div>
    ) : null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 h-9 text-xs font-medium text-white/90 transition-colors hover:bg-white/20">
          <Building2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline max-w-[140px] truncate">
            {currentOrg?.name || "Select org"}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => setCurrentOrgId(org.id)}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{org.name}</span>
            </div>
            {org.id === currentOrg?.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

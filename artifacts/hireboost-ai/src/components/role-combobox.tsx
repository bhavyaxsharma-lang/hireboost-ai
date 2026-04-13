import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const ROLE_GROUPS = [
  {
    label: "Technology",
    roles: [
      "Software Engineer", "Frontend Developer", "Backend Developer",
      "Full Stack Developer", "Mobile Developer (iOS/Android)",
      "DevOps / Platform Engineer", "Cloud Engineer",
      "Site Reliability Engineer (SRE)", "QA / Test Engineer",
      "AI / ML Engineer", "Data Scientist", "Data Analyst",
      "Data Engineer", "RPA Developer", "Cybersecurity Analyst",
      "Security Engineer", "Blockchain Developer", "Embedded Systems Engineer",
    ],
  },
  {
    label: "Finance",
    roles: [
      "Financial Analyst", "Investment Banker", "Portfolio Manager",
      "Risk Analyst", "Credit Analyst", "Equity Research Analyst",
      "Treasury Analyst", "Budget Analyst", "Financial Controller",
      "Chief Financial Officer (CFO)", "Finance Manager",
      "Quantitative Analyst", "Mergers & Acquisitions Analyst",
      "Private Equity Analyst",
    ],
  },
  {
    label: "Audit & Accounting",
    roles: [
      "Internal Auditor", "External Auditor", "IT Auditor",
      "Forensic Accountant", "Chartered Accountant (CA)",
      "Certified Public Accountant (CPA)", "Tax Consultant / Tax Analyst",
      "Management Accountant", "Cost Accountant",
      "Accounts Payable / Receivable", "Compliance Officer",
      "Anti-Money Laundering (AML) Analyst",
    ],
  },
  {
    label: "Product & Design",
    roles: [
      "Product Manager", "Product Owner", "UX / UI Designer",
      "UX Researcher", "Product Designer", "Visual Designer", "Design Lead",
    ],
  },
  {
    label: "Marketing",
    roles: [
      "Digital Marketing Manager", "SEO / SEM Specialist",
      "Content Strategist", "Brand Manager", "Social Media Manager",
      "Growth Hacker", "Marketing Analyst", "Email Marketing Specialist",
      "Performance Marketing Manager", "Public Relations Manager",
    ],
  },
  {
    label: "Sales & Business Development",
    roles: [
      "Sales Manager", "Account Executive", "Business Development Manager",
      "Customer Success Manager", "Sales Engineer",
      "Inside Sales Representative", "Key Account Manager",
    ],
  },
  {
    label: "Operations & Supply Chain",
    roles: [
      "Operations Manager", "Supply Chain Manager", "Logistics Coordinator",
      "Procurement Manager", "Inventory Analyst", "Warehouse Manager",
    ],
  },
  {
    label: "Human Resources",
    roles: [
      "HR Manager", "Talent Acquisition Specialist",
      "Recruiter / Headhunter", "HR Business Partner",
      "Learning & Development Manager", "Compensation & Benefits Analyst",
    ],
  },
  {
    label: "Project & Program Management",
    roles: [
      "Project Manager", "Program Manager", "Business Analyst",
      "Scrum Master", "Agile Coach", "PMO Analyst",
    ],
  },
  {
    label: "Legal & Compliance",
    roles: [
      "Legal Counsel / Corporate Lawyer", "Contract Manager",
      "Compliance Manager", "Paralegal", "Regulatory Affairs Specialist",
    ],
  },
  {
    label: "Healthcare",
    roles: [
      "Healthcare Administrator", "Clinical Data Analyst",
      "Medical Coder", "Hospital Administrator", "Pharmaceutical Sales Rep",
    ],
  },
  {
    label: "Consulting",
    roles: [
      "Management Consultant", "Strategy Consultant",
      "IT Consultant", "Business Transformation Consultant",
    ],
  },
];

export const ALL_ROLES = ROLE_GROUPS.flatMap((g) => g.roles);

interface RoleComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RoleCombobox({ value, onChange, placeholder = "Select or search a role…", disabled }: RoleComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? ROLE_GROUPS
        .map((g) => ({ ...g, roles: g.roles.filter((r) => r.toLowerCase().includes(search.toLowerCase())) }))
        .filter((g) => g.roles.length > 0)
    : ROLE_GROUPS;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search roles…" value={search} onValueChange={setSearch} />
          <CommandList className="max-h-72">
            <CommandEmpty>No roles found.</CommandEmpty>
            {filtered.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.roles.map((role) => (
                  <CommandItem
                    key={role}
                    value={role}
                    onSelect={() => {
                      onChange(role === value ? "" : role);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === role ? "opacity-100" : "opacity-0")} />
                    {role}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

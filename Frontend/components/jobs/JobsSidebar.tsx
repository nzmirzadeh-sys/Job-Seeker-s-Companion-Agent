"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Briefcase, ClipboardList, FileText, LogOut, Sparkles, User } from "lucide-react";
import { clearToken } from "@/lib/api";
import { jobsTheme } from "./theme";

const NAV_ITEMS = [
  { href: "/jobs", label: "آگهی‌ها", icon: Briefcase },
  { href: "/applications", label: "درخواست‌ها", icon: ClipboardList },
  { href: "/resume", label: "رزومه", icon: FileText },
  { href: "/settings", label: "پروفایل", icon: User },
];

export default function JobsSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.push("/");
  }

  return (
    <aside
      className="flex w-16 shrink-0 flex-col items-center gap-2 rounded-3xl py-4 shadow-[0_4px_30px_rgba(124,92,252,0.12)] md:w-20"
      style={{ backgroundColor: jobsTheme.sidebarBg, border: `1px solid ${jobsTheme.cardBorder}` }}
    >
      <div
        className="mb-3 flex size-10 items-center justify-center rounded-2xl text-white"
        style={{ background: `linear-gradient(135deg, ${jobsTheme.primary}, ${jobsTheme.primaryDark})` }}
        aria-hidden
      >
        <Sparkles className="size-5" />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              className="flex size-11 items-center justify-center rounded-2xl transition-colors"
              style={{
                backgroundColor: active ? jobsTheme.primarySoft : "transparent",
                color: active ? jobsTheme.primaryDark : jobsTheme.textFaint,
              }}
            >
              <Icon className="size-5" />
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        title="خروج"
        aria-label="خروج"
        className="flex size-11 items-center justify-center rounded-2xl transition-colors hover:bg-[#FDE8EE]"
        style={{ color: jobsTheme.danger }}
      >
        <LogOut className="size-5" />
      </button>
    </aside>
  );
}

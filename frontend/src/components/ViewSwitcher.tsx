'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CheckSquare } from 'lucide-react';

export function ViewSwitcher() {
  const pathname = usePathname();

  const linkClass = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
      active
        ? 'bg-brand-accent text-brand-primary'
        : 'text-gray-600 hover:bg-gray-100'
    }`;

  const isHome = pathname === '/';
  const isTasks = pathname === '/tasks';

  return (
    <nav className="flex flex-col gap-0.5 px-1 mb-3">
      <Link href="/" className={linkClass(isHome)}>
        <Home className="w-4 h-4" />
        Home
      </Link>
      <Link href="/tasks" className={linkClass(isTasks)}>
        <CheckSquare className="w-4 h-4" />
        Tasks
      </Link>
    </nav>
  );
}

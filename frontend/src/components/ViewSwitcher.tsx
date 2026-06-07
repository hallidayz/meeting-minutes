'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, CheckSquare } from 'lucide-react';

export function ViewSwitcher() {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      pathname === path || (path === '/' && pathname === '/')
        ? 'bg-brand-accent text-brand-primary'
        : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <nav className="flex flex-col gap-1 px-2 mb-4">
      <Link href="/" className={linkClass('/')}>
        <CalendarDays className="w-4 h-4" />
        Meetings
      </Link>
      <Link href="/tasks" className={linkClass('/tasks')}>
        <CheckSquare className="w-4 h-4" />
        Tasks
      </Link>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import '@/styles/navigation.css';

const navItems = [
  { href: '/', label: 'Leagues' },
  { href: '/steam-moves', label: 'Steam Moves' },
  { href: '/track-record', label: 'Track Record' },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="navigation">
      <div className="navigation__container">
        <Link href="/" className="navigation__logo">
          OddsLab
        </Link>
        <div className="navigation__links">
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            const className = isActive
              ? 'navigation__link navigation__link--active'
              : 'navigation__link';

            return (
              <Link key={item.href} href={item.href} className={className}>
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

import { Home, Compass, Search, MapPin, Sparkles, LayoutDashboard, Store, Wallet, ShoppingCart, Menu } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";

type MobileBottomNavProps = {
  variant: "public" | "app";
  onMenu: () => void;
};

const publicItems = [
  { name: "Home", path: "/", icon: Home },
  { name: "Discover", path: "/discover", icon: Compass },
  { name: "Search", path: "/search", icon: Search },
  { name: "AI", path: "/ai", icon: Sparkles },
];

const appItems = [
  { name: "Dashboard", path: "/os/dashboard", icon: LayoutDashboard },
  { name: "Store", path: "/store", icon: Store },
  { name: "Pay", path: "/os/pay", icon: Wallet },
  { name: "Orders", path: "/os/orders", icon: ShoppingCart },
];

export default function MobileBottomNav({ variant, onMenu }: MobileBottomNavProps) {
  const location = useLocation();
  const items = variant === "public" ? publicItems : appItems;

  return (
    <nav
      aria-label="Mobile navigation"
      className="mobile-bottom-nav md:hidden"
    >
      <div className="mobile-bottom-nav-inner">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn("mobile-nav-item", isActive && "mobile-nav-item-active")}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.name}</span>
            </Link>
          );
        })}
        <button type="button" onClick={onMenu} className="mobile-nav-item">
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}

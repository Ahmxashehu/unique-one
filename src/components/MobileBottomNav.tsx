import { Home, Compass, Search, Sparkles, Menu } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";

type MobileBottomNavProps = {
  variant: "public" | "app";
  onMenu: () => void;
};

const publicItems = [
  { name: "Home", path: "/", icon: Home },
  { name: "Active Edge", path: "/discover", icon: Compass },
  { name: "Search", path: "/search", icon: Search },
  { name: "AI", path: "/ai", icon: Sparkles },
];

const appItems = [
  { name: "Home", path: "/os/dashboard", icon: Home },
  { name: "Active Edge", path: "/discover", icon: Compass },
  { name: "Search", path: "/search", icon: Search },
  { name: "AI", path: "/os/ai", icon: Sparkles },
];

export default function MobileBottomNav({ variant, onMenu }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const items = variant === "public" ? publicItems : appItems;

  return (
    <nav aria-label="Mobile navigation" className="mobile-bottom-nav">
      <div className="mobile-bottom-nav-inner">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          return (
            <a
              key={item.name}
              href={item.path}
              onClick={(event) => {
                if (variant === "app" && item.name === "Home") {
                  event.preventDefault();
                  window.location.assign("/os/dashboard");
                }
              }}
              className={cn("mobile-nav-item", isActive && "mobile-nav-item-active")}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.name}</span>
            </a>
          );
        })}
        <button type="button" onClick={onMenu} className="mobile-nav-item" aria-label="Open UniqueOS menu">
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}

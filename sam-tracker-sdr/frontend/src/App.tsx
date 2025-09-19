import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  ArrowDownToLine,
  BarChart3,
  Menu,
  Target,
} from "lucide-react";
import LoadingScreen from "./components/LoadingScreen";
import { Dashboard } from "./pages/Dashboard";
import { Intake } from "./pages/Intake";
import { Scoring } from "./pages/Scoring";
import { Queue } from "./pages/Queue";

interface NavItem {
  to: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  renderIcon?: () => ReactNode;
  exact?: boolean;
}

function QueueBadge({ value }: { value: string }) {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-card text-xs font-semibold leading-none text-current">
      {value}
    </span>
  );
}

function Navigation() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem("sdrNavCollapsed");
      return saved === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("sdrNavCollapsed", isCollapsed.toString());
    } catch {}
  }, [isCollapsed]);

  const navItems: NavItem[] = [
    { to: "/", label: "Dashboard", icon: BarChart3, exact: true },
    { to: "/intake", label: "Intake", icon: ArrowDownToLine },
    { to: "/scoring", label: "Scoring", icon: Target },
    { to: "/queue/1", label: "Queue 1", renderIcon: () => <QueueBadge value="1" /> },
    { to: "/queue/2", label: "Queue 2", renderIcon: () => <QueueBadge value="2" /> },
    { to: "/queue/3", label: "Queue 3", renderIcon: () => <QueueBadge value="3" /> },
    { to: "/queue/4", label: "Queue 4", renderIcon: () => <QueueBadge value="4" /> },
    { to: "/queue/5", label: "Queue 5", renderIcon: () => <QueueBadge value="5" /> },
  ];

  return (
    <aside
      className={`${
        isCollapsed ? "w-16" : "w-64"
      } bg-card border-r border-border flex flex-col transition-all duration-300`}
    >
      <div className="flex items-center justify-between px-4 py-4">
        <h2 className={`text-lg font-bold ${isCollapsed ? "hidden" : "block"}`}>
          Navigation
        </h2>
        <button
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="rounded-lg p-1 transition-colors hover:bg-muted"
          aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-2 px-4 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `w-full flex items-center ${
                  isCollapsed ? "justify-center" : "gap-3"
                } rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`
              }
              title={isCollapsed ? item.label : undefined}
            >
              {item.renderIcon ? (
                <span className="flex-shrink-0">
                  {item.renderIcon()}
                </span>
              ) : Icon ? (
                <Icon className="h-4 w-4 flex-shrink-0" />
              ) : null}
              {!isCollapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>
      {!isCollapsed && (
        <div className="border-t border-border px-4 py-4 text-xs text-muted-foreground">
          <p>Last updated: Skeleton build</p>
        </div>
      )}
    </aside>
  );
}

function AppShell() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      {isLoading && <LoadingScreen onComplete={() => setIsLoading(false)} />}

      <header className="border-b border-border bg-card shadow-sm">
        <div className="flex items-center gap-4 px-6 py-4">
          <img src="/logo.png" alt="SAM Tracker" className="h-8 w-8 rounded" />
          <div>
            <h1 className="text-xl font-bold text-card-foreground">
              SAM Tracker SDR
            </h1>
            <p className="text-sm text-muted-foreground">
              Sales Development Workspace
            </p>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        <Navigation />
        <main className="flex-1 min-h-0">
          <div className="h-full min-h-0 overflow-y-auto p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/intake" element={<Intake />} />
              <Route path="/scoring" element={<Scoring />} />
              <Route path="/queue/:queueId" element={<Queue />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    // Placeholder for analytics hooks or route-based effects.
  }, [location.pathname]);

  return <AppShell />;
}

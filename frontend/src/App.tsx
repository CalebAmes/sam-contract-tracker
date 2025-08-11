import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { BarChart3, FileText, Search, Brain, Menu, X } from "lucide-react";
import ThemeToggle from "./components/ThemeToggle";
import LoadingScreen from "./components/LoadingScreen";
import Dashboard from "./pages/Dashboard";
import Contracts from "./pages/Contracts";
import ContractView from "./pages/ContractView";
import SearchSam from "./pages/SearchSam";
import Analyze from "./pages/Analyze";

function Navigation() {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Load collapsed state from localStorage
    const saved = localStorage.getItem("navCollapsed");
    return saved === "true";
  });

  useEffect(() => {
    // Save collapsed state to localStorage
    localStorage.setItem("navCollapsed", isCollapsed.toString());
  }, [isCollapsed]);

  const isActive = (path: string) => location.pathname === path;

  const toggleNav = () => setIsCollapsed(!isCollapsed);

  return (
    <aside
      className={`${
        isCollapsed ? "w-16" : "w-64"
      } bg-card border-r border-border flex flex-col transition-all duration-300`}
    >
      <div className="flex items-center justify-between p-4">
        <h2 className={`font-bold text-lg ${isCollapsed ? "hidden" : "block"}`}>
          Navigation
        </h2>
        <button
          onClick={toggleNav}
          className="p-1 rounded-lg hover:bg-muted transition-colors"
          aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
      <nav className="flex-1 px-4 py-2 space-y-2">
        <Link
          to="/"
          className={`w-full flex items-center ${
            isCollapsed ? "justify-center" : "gap-3"
          } px-3 py-2 rounded-lg text-left transition-colors ${
            isActive("/")
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
          title={isCollapsed ? "Dashboard" : undefined}
        >
          <BarChart3 className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="font-medium">Dashboard</span>}
        </Link>

        <Link
          to="/contracts"
          className={`w-full flex items-center ${
            isCollapsed ? "justify-center" : "gap-3"
          } px-3 py-2 rounded-lg text-left transition-colors ${
            isActive("/contracts") ||
            location.pathname.startsWith("/contracts/")
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
          title={isCollapsed ? "Contracts" : undefined}
        >
          <FileText className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="font-medium">Contracts</span>}
        </Link>

        <Link
          to="/analyze"
          className={`w-full flex items-center ${
            isCollapsed ? "justify-center" : "gap-3"
          } px-3 py-2 rounded-lg text-left transition-colors ${
            isActive("/analyze")
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
          title={isCollapsed ? "Analyze Contract" : undefined}
        >
          <Brain className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && (
            <span className="font-medium">Analyze Contract</span>
          )}
        </Link>

        <Link
          to="/search"
          className={`w-full flex items-center ${
            isCollapsed ? "justify-center" : "gap-3"
          } px-3 py-2 rounded-lg text-left transition-colors ${
            isActive("/search")
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
          title={isCollapsed ? "Search SAM.gov" : undefined}
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && (
            <span className="font-medium">Search SAM.gov (wip)</span>
          )}
        </Link>
      </nav>

      {!isCollapsed && (
        <div className="px-4 py-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            <p>Last updated: Just now</p>
          </div>
        </div>
      )}
    </aside>
  );
}

function App() {
  const [isLoading, setIsLoading] = useState(true);

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground transition-colors">
        {isLoading && <LoadingScreen onComplete={handleLoadingComplete} />}

        <header className="bg-card shadow-sm border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold font-heading text-card-foreground">
                  SAM Contract Tracker
                </h1>
                <span className="text-sm text-muted-foreground">
                  Government Contract Analysis Platform
                </span>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="flex h-[calc(100vh-73px)]">
          <Navigation />

          <main className="flex-1 overflow-auto">
            <div className="p-6">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/contracts" element={<Contracts />} />
                <Route path="/contracts/:id" element={<ContractView />} />
                <Route path="/analyze" element={<Analyze />} />
                <Route path="/search" element={<SearchSam />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;

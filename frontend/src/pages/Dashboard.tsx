import React, { useState, useEffect } from "react";
import {
  FileText,
  TrendingUp,
  Clock,
  Archive,
  AlertCircle,
  CheckCircle,
  Users,
  Calendar,
  BarChart3,
  RefreshCw,
  Activity,
  Plus,
  Edit,
  Trash2,
  Flag,
  MessageSquare,
  Brain,
  ArchiveRestore,
  ChevronRight,
} from "lucide-react";
import { ActivityLog, ActivityType } from "../types";
import ActivityModal from "../components/ActivityModal";
import { API_CONFIG } from "../config/api";

interface ContractMetrics {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  archived: number;
  recentlyAdded: number;
  dueSoon: number;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<ContractMetrics | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [allActivities, setAllActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showActivityModal, setShowActivityModal] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsResponse, activityResponse, allActivityResponse] =
        await Promise.all([
          fetch(`${API_CONFIG.baseUrl}/api/dashboard/metrics`),
          fetch(`${API_CONFIG.baseUrl}/api/dashboard/activity?limit=5`),
          fetch(`${API_CONFIG.baseUrl}/api/dashboard/activity?limit=50`),
        ]);

      if (!metricsResponse.ok) {
        throw new Error(`Failed to fetch metrics: ${metricsResponse.status}`);
      }

      if (!activityResponse.ok) {
        throw new Error(`Failed to fetch activity: ${activityResponse.status}`);
      }

      if (!allActivityResponse.ok) {
        throw new Error(
          `Failed to fetch all activity: ${allActivityResponse.status}`
        );
      }

      const metricsData = await metricsResponse.json();
      const activityData = await activityResponse.json();
      const allActivityData = await allActivityResponse.json();

      setMetrics(metricsData.metrics);
      setActivities(activityData.activities || []);
      setAllActivities(allActivityData.activities || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch dashboard data"
      );
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    new: "text-blue-600 dark:text-blue-400",
    investigating: "text-yellow-600 dark:text-yellow-400",
    interested: "text-green-600 dark:text-green-400",
    dismissed: "text-gray-600 dark:text-gray-400",
    applied: "text-purple-600 dark:text-purple-400",
  };

  const priorityColors = {
    low: "text-gray-600 dark:text-gray-400",
    medium: "text-blue-600 dark:text-blue-400",
    high: "text-yellow-600 dark:text-yellow-400",
    critical: "text-red-600 dark:text-red-400",
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold font-heading mb-2">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of your contract analysis activity
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-card p-6 rounded-lg shadow-sm border border-border animate-pulse"
            >
              <div className="h-8 bg-muted rounded mb-2"></div>
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold font-heading mb-2">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of your contract analysis activity
          </p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <p className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">
              Error Loading Dashboard
            </p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button
              onClick={fetchDashboardData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-heading mb-2">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of your contract analysis activity
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="inline-flex items-center gap-2 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-500" />
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {metrics?.total || 0}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Contracts
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {metrics?.byPriority?.high || 0}
              </div>
              <div className="text-sm text-muted-foreground">High Priority</div>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-500" />
            <div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {metrics?.dueSoon || 0}
              </div>
              <div className="text-sm text-muted-foreground">Due Soon</div>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-purple-500" />
            <div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {metrics?.recentlyAdded || 0}
              </div>
              <div className="text-sm text-muted-foreground">
                Added This Week
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status and Priority Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-lg font-semibold font-heading mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            By Status
          </h3>
          <div className="space-y-3">
            {Object.entries(metrics?.byStatus || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${statusColors[
                      status as keyof typeof statusColors
                    ]?.replace("text-", "bg-")}`}
                  ></div>
                  <span className="text-sm font-medium capitalize">
                    {status}
                  </span>
                </div>
                <span
                  className={`text-sm font-bold ${
                    statusColors[status as keyof typeof statusColors]
                  }`}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-lg font-semibold font-heading mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            By Priority
          </h3>
          <div className="space-y-3">
            {Object.entries(metrics?.byPriority || {}).map(
              ([priority, count]) => (
                <div
                  key={priority}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${priorityColors[
                        priority as keyof typeof priorityColors
                      ]?.replace("text-", "bg-")}`}
                    ></div>
                    <span className="text-sm font-medium capitalize">
                      {priority}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      priorityColors[priority as keyof typeof priorityColors]
                    }`}
                  >
                    {count}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Additional Info and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Additional Info */}
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-lg font-semibold font-heading mb-4 flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Additional Information
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-gray-600 dark:text-gray-400">
                {metrics?.archived || 0}
              </div>
              <div className="text-sm text-muted-foreground">
                Archived Contracts
              </div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {(metrics?.total || 0) - (metrics?.archived || 0)}
              </div>
              <div className="text-sm text-muted-foreground">
                Active Contracts
              </div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {metrics?.total
                  ? Math.round(((metrics?.dueSoon || 0) / metrics.total) * 100)
                  : 0}
                %
              </div>
              <div className="text-sm text-muted-foreground">Due Soon Rate</div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold font-heading flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Recent Activity
            </h3>
            {allActivities.length > 5 && (
              <button
                onClick={() => setShowActivityModal(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                Show All
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No recent activity</p>
                <p className="text-sm">
                  Activity will appear here when you make changes to contracts
                </p>
              </div>
            ) : (
              <>
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {getActivityIcon(activity.activityType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {activity.contractTitle}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatActivityTime(activity.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {activity.description}
                      </p>
                    </div>
                  </div>
                ))}
                {allActivities.length > activities.length && (
                  <button
                    onClick={() => setShowActivityModal(true)}
                    className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-muted rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    View {allActivities.length - activities.length} more
                    activities
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Activity Modal */}
      <ActivityModal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        activities={allActivities}
      />
    </div>
  );

  function getActivityIcon(type: ActivityType) {
    const iconClass = "w-4 h-4";

    switch (type) {
      case ActivityType.CONTRACT_CREATED:
        return <Plus className={`${iconClass} text-green-500`} />;
      case ActivityType.STATUS_CHANGED:
        return <CheckCircle className={`${iconClass} text-blue-500`} />;
      case ActivityType.PRIORITY_CHANGED:
        return <Flag className={`${iconClass} text-yellow-500`} />;
      case ActivityType.FLAGS_UPDATED:
        return <Flag className={`${iconClass} text-purple-500`} />;
      case ActivityType.NOTE_ADDED:
        return <MessageSquare className={`${iconClass} text-green-500`} />;
      case ActivityType.NOTE_UPDATED:
        return <Edit className={`${iconClass} text-blue-500`} />;
      case ActivityType.NOTE_DELETED:
        return <Trash2 className={`${iconClass} text-red-500`} />;
      case ActivityType.CONTRACT_ARCHIVED:
        return <Archive className={`${iconClass} text-gray-500`} />;
      case ActivityType.CONTRACT_UNARCHIVED:
        return <ArchiveRestore className={`${iconClass} text-green-500`} />;
      case ActivityType.ANALYSIS_STARTED:
        return <Brain className={`${iconClass} text-blue-500`} />;
      case ActivityType.ANALYSIS_COMPLETED:
        return <Brain className={`${iconClass} text-green-500`} />;
      default:
        return <Activity className={`${iconClass} text-gray-500`} />;
    }
  }

  function formatActivityTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return "Just now";
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}

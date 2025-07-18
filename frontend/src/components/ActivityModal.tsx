import React from 'react';
import { X, Activity, Plus, CheckCircle, Flag, MessageSquare, Edit, Trash2, Archive, ArchiveRestore, Brain } from 'lucide-react';
import { ActivityLog, ActivityType } from '../types';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activities: ActivityLog[];
}

const ActivityModal: React.FC<ActivityModalProps> = ({ isOpen, onClose, activities }) => {
  if (!isOpen) return null;

  const getActivityIcon = (type: ActivityType) => {
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
  };

  const formatActivityTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6" />
            All Recent Activity
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No activity to display</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex-shrink-0 mt-1">
                    {getActivityIcon(activity.activityType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {activity.contractTitle}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {activity.description}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatActivityTime(activity.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityModal;
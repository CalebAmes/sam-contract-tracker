export type ContractStatus = 
  | 'queue'        // Newly discovered, awaiting review
  | 'pre-bid'      // Moved to pre-bid tracking pipeline  
  | 'submitted'    // Bid has been submitted
  | 'awarded'      // Contract was awarded (to us or others)
  | 'lost'         // We lost the bid
  | 'discarded'    // Manually discarded/not pursuing
  | 'case-study';  // Marked for case study analysis

export type ContractSetAside = 
  | 'none'
  | 'small-business'
  | 'hubzone'
  | 'sdvosb'  // Service-Disabled Veteran-Owned Small Business
  | 'wosb'    // Women-Owned Small Business
  | '8a'      // 8(a) Business Development Program
  | 'other';

export interface ContractScores {
  fit: number;                    // 0-100: How well this matches our capabilities
  complexity: number;             // 0-100: Technical/delivery complexity
  urgency: number;               // 0-100: How urgent/time-sensitive
  caseStudyPotential: number;    // 0-100: Potential for case study value
}

export interface Contract {
  id: string;
  
  // Basic Contract Info
  title: string;
  description?: string;
  agency: string;
  office?: string;
  naicsCode: string;
  naicsDescription?: string;
  setAside: ContractSetAside;
  
  // URLs and References
  samUrl: string;
  solicitationNumber?: string;
  
  // Timeline
  postedDate?: Date;
  dueDate?: Date;
  responseDeadline?: Date;
  
  // Classification and Scoring
  status: ContractStatus;
  scores?: ContractScores;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  
  // User Data
  notes: string;
  internalConfidence?: number;  // 0-100: Our confidence in winning
  
  // Workflow Tracking
  assignedTo?: string;
  lastReviewed?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Post-submission data (when applicable)
  submissionDate?: Date;
  submissionMethod?: 'sam' | 'email' | 'portal' | 'other';
  submittedBy?: string;
  
  // Award data (when applicable)
  awardDate?: Date;
  awardAmount?: number;
  awardee?: string;
  
  // Loss analysis (when applicable)
  lossReason?: string;
  feedback?: string;
  reviewLater?: boolean;
}

export interface ContractFilter {
  keywords?: string;
  naicsCodes?: string[];
  agencies?: string[];
  setAsides?: ContractSetAside[];
  statuses?: ContractStatus[];
  tags?: string[];
  dueDateRange?: {
    start?: Date;
    end?: Date;
  };
  minFitScore?: number;
  priorities?: ('low' | 'medium' | 'high')[];
}

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  filter: ContractFilter;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
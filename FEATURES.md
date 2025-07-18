# SAM Contract Tracker - Feature Roadmap

This document tracks the development progress of the SAM Contract Tracker application across 5 main feature areas.

---

## 🧲 1. Inbound Discovery & Prioritization
**Status: 🟡 In Progress**  
**Priority: High (Current Focus)**

**Goal:** Efficiently find high-potential contracts and reduce noise.

### Key Features:
- [ ] **SAM.gov URL Input** → scrape listings or full search results
- [ ] **Saved Filters** → NAICS codes, keywords, set-aside types, etc.
- [ ] **Result Queue UI** → view new results and summaries
- [ ] **Gemini Scoring & Tagging** → auto-score each listing with:
  - [ ] Fit Score
  - [ ] Complexity Score  
  - [ ] Urgency Score
  - [ ] Case Study Potential
- [ ] **Manual Actions:**
  - [ ] ✅ Move to "Pre-Bid Tracking"
  - [ ] 🧠 Mark as "Case Study"
  - [ ] 🗑️ Discard
- [ ] **Flags/Labels System**
- [ ] **Auto-collapse low-scoring items** (optional)

### Implementation Notes:
- Starting with basic URL input and manual contract management
- Gemini integration planned for Phase 2
- Local state management initially, backend integration later

---

## ⏳ 2. Pre-Bid Tracking
**Status: 🔴 Not Started**  
**Priority: Medium**

**Goal:** Track active opportunities before bid submission.

### Key Features:
- [ ] **Pipeline View (Kanban-style):**
  - [ ] Researching
  - [ ] Team Review
  - [ ] Drafting
  - [ ] Finalizing
- [ ] **Lifecycle Documentation** in-app
  - [ ] "SAM.gov lifecycle explained" side panel
- [ ] **Date-based Reminders** (Q&A due, submission deadline)
- [ ] **Notes / Tasks** per contract item
- [ ] **Status Check API/Parser** (optional auto-refresh)

---

## 📤 3. Post-Bid Tracking
**Status: 🔴 Not Started**  
**Priority: Medium**

**Goal:** Track submitted bids and monitor for responses.

### Key Features:
- [ ] **Submission Log** (date, method, submitter)
- [ ] **Attached Documents** (tech volume, pricing, etc.)
- [ ] **"Waiting on Award" stage**
- [ ] **Internal Confidence Score** (subjective or Gemini-assisted)

---

## 🏁 4. Post-Award Tracking
**Status: 🔴 Not Started**  
**Priority: Low**

**Goal:** Mark wins, track delivery, and organize artifacts.

### Key Features:
- [ ] **Awarded Tag**
- [ ] **Award Info Parser** (auto fetch awardee, amount, period of performance)
- [ ] **Link to Delivery Docs**
- [ ] **Delivery Experience Notes**
- [ ] **Post-mortem Field** (optional)

---

## ❌ 5. Post Non-Award (Loss Analysis)
**Status: 🔴 Not Started**  
**Priority: Low**

**Goal:** Learn from losses, refine Gemini model & strategy.

### Key Features:
- [ ] **Mark as Lost**
- [ ] **Loss Reason** (dropdown + freeform notes)
  - [ ] "Lost to incumbent"
  - [ ] "No feedback"
  - [ ] "Too complex"
- [ ] **Feedback Tracker**
- [ ] **"Review Later" flag** (for future recompetes)
- [ ] **Score Adjustment Suggestion** (manual or Gemini-assist)

---

## Technical Architecture

### Current Stack:
- **Frontend:** React 19 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Express.js + SQLite (planned)
- **AI Integration:** Google Gemini API (planned)
- **Deployment:** TBD

### Data Models (Draft):
```typescript
interface Contract {
  id: string;
  title: string;
  agency: string;
  naicsCode: string;
  dueDate: Date;
  samUrl: string;
  status: 'queue' | 'pre-bid' | 'submitted' | 'awarded' | 'lost' | 'discarded';
  scores?: {
    fit: number;
    complexity: number; 
    urgency: number;
    caseStudyPotential: number;
  };
  tags: string[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Development Phases

### Phase 1 (Current): Foundation
- [x] Project structure & theming
- [ ] Feature 1: Basic discovery workflow
- [ ] Contract data models
- [ ] Manual contract management

### Phase 2: AI Integration  
- [ ] Gemini API integration
- [ ] Automated scoring
- [ ] Backend scraping service

### Phase 3: Pipeline Management
- [ ] Feature 2: Pre-bid tracking
- [ ] Kanban boards
- [ ] Reminder system

### Phase 4: Post-Submission
- [ ] Features 3-5: Post-bid workflows
- [ ] Analytics and reporting
- [ ] Loss analysis and learning

---

*Last Updated: 2025-01-17*
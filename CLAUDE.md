# SAM Contract Tracker - AI Assistant Guidelines

## UI Framework

**🎨 UI Library**: This project uses **shadcn/ui** components with Tailwind CSS

### Important Notes:
- **DO NOT** use Material-UI (MUI) components - we have migrated away from MUI
- **DO** use shadcn/ui components for all new UI elements
- **DO** use Tailwind CSS classes for styling
- All components are copied into the project for full customization control

### Available shadcn/ui Components:
- `Button` - All button variations
- `Input` - Form inputs
- `Card` - Container components
- `Badge` - Status indicators and chips
- `Table` - Data tables with TanStack Table
- `Alert` - Error and info messages
- `Toast` - Notifications
- `DropdownMenu` - Dropdowns and menus
- `Tooltip` - Hover information

### Styling Guidelines:
- Use Tailwind CSS classes for all styling
- Follow existing theme variables for consistency
- Support both light and dark themes
- Components are in `frontend/src/components/ui/`

### Development Commands:
```bash
# Add new shadcn/ui components
npx shadcn@latest add [component-name]

# Run development server
npm run dev

# Build for production
npm run build
```

### Project Structure:
```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/          # shadcn/ui components
│   │   └── custom/      # Custom components
│   ├── lib/
│   │   └── utils.ts     # Utility functions (cn, etc.)
│   └── styles/
│       └── globals.css  # Tailwind CSS imports
```

## Backend
- Express.js with TypeScript
- SQLite database
- Located in `backend/` directory

## Development
- Use `npm run dev` from root to start both frontend and backend
- Frontend runs on port 3000
- Backend runs on port 3001

## Application Workflow

### Primary User Flow:

1. **Contract Discovery**
   - User pastes SAM.gov contract URLs into the Analyze page
   - System fetches contract data and attachments using Client API (default) or Public API
   - Contract data is automatically saved to database with tracking metadata

2. **Contract Management**
   - All fetched contracts appear in the **Contracts** tab as row items
   - Each row displays: Title, Organization, Posted Date, Deadline, Status
   - Click any row to open a **full-page modal** with complete contract details

3. **Contract Analysis**
   - Both row items and modals have an **"Analyze"** button
   - Analysis uses AI to detect wrapper contract indicators
   - Analysis results are saved and displayed in the modal
   - Contracts can be tracked through various status states

4. **Data Persistence**
   - All contract data, attachments, and analysis results stored in SQLite
   - Comprehensive tracking metadata (fetch method, timestamps, etc.)
   - Contract status management and history tracking

### UI Components:

- **Analyze Page**: URL input with API method toggle switch
- **Contracts Page**: Sortable table of all tracked contracts
- **Contract Modal**: Full-screen overlay with complete contract details
- **Analysis Component**: AI-powered wrapper detection results

### Technical Implementation Details:

#### Database Schema Updates Needed:
- **Tracking Metadata**: Add fields for fetch method, source API, timestamps
- **Analysis State**: Track analysis status (pending, in_progress, completed, failed)
- **User Interactions**: Track when contracts are viewed, analyzed, status changed
- **Performance Metrics**: API response times, success rates, error tracking

#### Frontend Components to Build:
1. **ContractsTable**: Sortable table with pagination, filtering, and search
2. **ContractRow**: Individual row component with status badges and action buttons
3. **ContractModal**: Full-screen modal with tabs for details, attachments, analysis
4. **AnalyzeButton**: Reusable component for triggering analysis with loading states
5. **StatusBadge**: Visual indicator for contract status (new, analyzing, reviewed, etc.)

#### Backend API Extensions:
- **GET /api/contracts**: List all contracts with pagination and filtering
- **GET /api/contracts/:id**: Get individual contract with full details
- **POST /api/contracts/:id/analyze**: Trigger AI analysis for a contract
- **PUT /api/contracts/:id/status**: Update contract status
- **GET /api/contracts/:id/analysis**: Get analysis results

#### Analysis Integration:
- **AI Analysis Queue**: Background job processing for wrapper detection
- **Analysis Results**: Structured data with confidence scores and evidence
- **Status Tracking**: Real-time updates on analysis progress
- **Caching**: Store analysis results to avoid re-processing

## SAM.gov API Integration

### Two Data Fetching Methods:

1. **Client API** (`/api/fetch-contract-client`) - **DEFAULT**
   - Uses SAM.gov's internal client API (same as their website)
   - Requires session tokens from browser
   - More reliable, bypasses public API rate limits
   - **Environment Variables Required:**
     - `CLIENT_API_SESSION` - Session token from cookie
     - `CLIENT_API_XSRF_TOKEN` - XSRF token from cookie  
     - `CLIENT_API_AUTH_TOKEN` - Auth token from x-auth-token header
     - `CLIENT_API_COOKIES` - Full cookie string (alternative)

2. **Public API** (`/api/fetch-contract`) - **FALLBACK**
   - Uses documented SAM.gov API with API keys
   - Requires `SAM_API_KEY_1`, `SAM_API_KEY_2`, `SAM_API_KEY_3` environment variables
   - Subject to rate limits but provides structured data

### Session Token Setup:

To use the Client API (recommended):
1. Open SAM.gov in browser and log in
2. Open Developer Tools > Network tab
3. Navigate to any contract page
4. Find the API request to `/api/prod/opps/v2/opportunities/`
5. Copy the session tokens from headers and cookies
6. Add them to your `.env` file (see `.env.example`)

### Attachment Handling:

The system attempts to fetch attachments from the client API. If no attachments are found, it logs the status but continues processing the contract data.

## Critical Backend Rules
- **EVERY ERROR RETURNED TO CLIENT MUST HAVE A SERVER LOG**
- **NO CLIENT ERRORS WITHOUT SERVER LOGS - EVER**
- Log errors cleanly - just the actual error message, not stack traces
- Use proper HTTP status codes that match the actual error
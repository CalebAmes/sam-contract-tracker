import axios from 'axios';
import { Contract, ContractStatus, AnalysisStatus, ContractPriority } from '../../database';

export interface SearchFilters {
  q?: string;
  qMode?: 'ALL' | 'ANY' | 'EXACT';
  naics?: string[];
  notice_type?: string[];
  set_aside?: string[];
  is_active?: boolean;
  responseDate?: {
    gte?: string;
    lte?: string;
  };
  publishDate?: {
    gte?: string;
    lte?: string;
  };
  sort?: string;
  size?: number;
  page?: number;
}

export interface SearchResult {
  contracts: Contract[];
  pagination: {
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  searchParams: SearchFilters;
  searchedAt: string;
  searchDuration: number;
}

export interface SAMOpportunity {
  _id: string;
  title: string;
  type: {
    code: string;
    value: string;
  };
  descriptions: Array<{
    content: string;
    lastModifiedDate: string;
  }>;
  solicitationNumber: string;
  responseDate: string;
  responseDateActual: string;
  publishDate: string;
  modifiedDate: string;
  organizationHierarchy: Array<{
    organizationId: string;
    name: string;
    type: string;
    level: number;
  }>;
  isCanceled: boolean;
  isActive: boolean;
  modifications?: {
    count: number;
  };
  award?: {
    awardee: {
      name: string | null;
      ueiSAM: string | null;
    };
  };
}

export interface SAMSearchResponse {
  _embedded: {
    results: SAMOpportunity[];
  };
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
    maxAllowedRecords: number;
  };
  _links: {
    self: {
      href: string;
    };
  };
}

export class SAMSearchService {
  private static readonly BASE_URL = 'https://sam.gov/api/prod/sgs/v1/search/';
  private static readonly CLIENT_API_BASE_URL = 'https://sam.gov/api/prod/opps/v2/opportunities/';
  private static readonly DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'referer': 'https://sam.gov/search/',
  };

  private static getSessionTokens() {
    return {
      session: process.env.CLIENT_API_SESSION,
      xsrfToken: process.env.CLIENT_API_XSRF_TOKEN,
      authToken: process.env.CLIENT_API_AUTH_TOKEN,
      cookies: process.env.CLIENT_API_COOKIES,
    };
  }

  /**
   * Parse a SAM.gov search URL to extract filters
   */
  static parseSearchUrl(url: string): SearchFilters {
    try {
      const urlObj = new URL(url);
      const searchParams = new URLSearchParams(urlObj.search);
      
      const filters: SearchFilters = {};
      
      // Check if this is a frontend URL (has sfm parameters) or API URL
      const isFrontendUrl = Array.from(searchParams.keys()).some(key => key.startsWith('sfm'));
      
      if (isFrontendUrl) {
        console.log('Parsing frontend URL format');
        return this.parseFrontendUrl(searchParams);
      } else {
        console.log('Parsing API URL format');
        return this.parseApiUrl(searchParams);
      }
    } catch (error) {
      console.error('Error parsing search URL:', error);
      return {};
    }
  }

  /**
   * Parse SAM.gov frontend URL format (with sfm parameters)
   */
  private static parseFrontendUrl(searchParams: URLSearchParams): SearchFilters {
    const filters: SearchFilters = {};
    
    // Basic parameters
    if (searchParams.has('sort')) filters.sort = searchParams.get('sort') || '-modifiedDate';
    if (searchParams.has('pageSize')) filters.size = parseInt(searchParams.get('pageSize') || '100');
    if (searchParams.has('page')) {
      // Frontend uses 1-based page numbering, API uses 0-based
      const frontendPage = parseInt(searchParams.get('page') || '1');
      filters.page = Math.max(0, frontendPage - 1);
    }
    
    // Parse sfm parameters
    const naicsCodes: string[] = [];
    const noticeTypes: string[] = [];
    const setAsides: string[] = [];
    
    // Extract NAICS codes from sfm[serviceClassificationWrapper][naics][N][key]
    for (const [key, value] of searchParams.entries()) {
      if (key.includes('sfm[serviceClassificationWrapper][naics]') && key.includes('[key]')) {
        naicsCodes.push(value);
      }
      
      // Extract notice types from sfm[typeOfNotice][N][key]
      if (key.includes('sfm[typeOfNotice]') && key.includes('[key]')) {
        noticeTypes.push(value);
      }
      
      // Extract set aside from sfm[setAside][N][key]
      if (key.includes('sfm[setAside]') && key.includes('[key]')) {
        setAsides.push(value);
      }
    }
    
    // Check for active status
    if (searchParams.has('sfm[status][is_active]')) {
      filters.is_active = searchParams.get('sfm[status][is_active]') === 'true';
    }
    
    // Check for keyword search
    if (searchParams.has('sfm[simpleSearch][keywordRadio]')) {
      filters.qMode = searchParams.get('sfm[simpleSearch][keywordRadio]') as 'ALL' | 'ANY' | 'EXACT';
    }
    
    // Set extracted arrays
    if (naicsCodes.length > 0) filters.naics = naicsCodes;
    if (noticeTypes.length > 0) filters.notice_type = noticeTypes;
    if (setAsides.length > 0) filters.set_aside = setAsides;
    
    // Default values
    if (!filters.q) filters.q = '';
    if (!filters.qMode) filters.qMode = 'ALL';
    if (filters.is_active === undefined) filters.is_active = true;
    
    console.log('Parsed frontend filters:', JSON.stringify(filters, null, 2));
    return filters;
  }

  /**
   * Parse SAM.gov API URL format
   */
  private static parseApiUrl(searchParams: URLSearchParams): SearchFilters {
    const filters: SearchFilters = {};
    
    // Basic parameters
    if (searchParams.has('q')) filters.q = searchParams.get('q') || '';
    if (searchParams.has('qMode')) filters.qMode = searchParams.get('qMode') as 'ALL' | 'ANY' | 'EXACT';
    if (searchParams.has('is_active')) filters.is_active = searchParams.get('is_active') === 'true';
    if (searchParams.has('sort')) filters.sort = searchParams.get('sort') || '-modifiedDate';
    if (searchParams.has('size')) filters.size = parseInt(searchParams.get('size') || '100');
    if (searchParams.has('page')) filters.page = parseInt(searchParams.get('page') || '0');
    
    // Array parameters
    if (searchParams.has('naics')) {
      filters.naics = searchParams.get('naics')?.split(',').filter(Boolean);
    }
    if (searchParams.has('notice_type')) {
      filters.notice_type = searchParams.get('notice_type')?.split(',').filter(Boolean);
    }
    if (searchParams.has('set_aside')) {
      filters.set_aside = searchParams.get('set_aside')?.split(',').filter(Boolean);
    }
    
    console.log('Parsed API filters:', JSON.stringify(filters, null, 2));
    return filters;
  }

  /**
   * Search SAM.gov opportunities with filters
   */
  static async searchOpportunities(filters: SearchFilters): Promise<SearchResult> {
    const startTime = Date.now();
    
    try {
      const params = new URLSearchParams({
        random: Date.now().toString(),
        index: 'opp',
        mode: 'search',
        responseType: 'json',
        page: (filters.page || 0).toString(),
        size: (filters.size || 100).toString(),
        sort: filters.sort || '-modifiedDate',
      });

      // Add search query
      if (filters.q) {
        params.set('q', filters.q);
        params.set('qMode', filters.qMode || 'ALL');
      } else {
        params.set('q', '');
        params.set('qMode', 'ALL');
      }

      // Add filters
      if (filters.is_active !== undefined) {
        params.set('is_active', filters.is_active.toString());
      } else {
        params.set('is_active', 'true'); // Default to active opportunities
      }

      if (filters.naics && filters.naics.length > 0) {
        params.set('naics', filters.naics.join(','));
      }

      if (filters.notice_type && filters.notice_type.length > 0) {
        params.set('notice_type', filters.notice_type.join(','));
      }

      if (filters.set_aside && filters.set_aside.length > 0) {
        params.set('set_aside', filters.set_aside.join(','));
      }

      // Add date filters if provided - using correct SAM.gov parameter names
      if (filters.responseDate?.gte) {
        params.set('response_date.from', `${filters.responseDate.gte}+02:00`);
      }
      if (filters.responseDate?.lte) {
        params.set('response_date.to', `${filters.responseDate.lte}+02:00`);
      }
      if (filters.publishDate?.gte) {
        params.set('modified_date.from', `${filters.publishDate.gte}+02:00`);
      }
      if (filters.publishDate?.lte) {
        params.set('modified_date.to', `${filters.publishDate.lte}+02:00`);
      }

      const sessionTokens = this.getSessionTokens();
      const url = `${this.BASE_URL}?${params.toString()}`;
      console.log('SAM.gov search URL (with client API):', url);

      const response = await axios.get<SAMSearchResponse>(url, {
        headers: {
          ...this.DEFAULT_HEADERS,
          ...(sessionTokens.cookies && { "cookie": sessionTokens.cookies }),
          ...(sessionTokens.authToken && { "x-auth-token": sessionTokens.authToken }),
        },
        timeout: 30000,
      });

      if (response.status !== 200) {
        throw new Error(`SAM.gov API returned status ${response.status}`);
      }

      const searchDuration = Date.now() - startTime;
      const samData = response.data;

      // Convert SAM opportunities to Contract objects
      const contracts = samData._embedded.results.map(opportunity => this.convertSAMOpportunityToContract(opportunity));

      return {
        contracts,
        pagination: {
          page: samData.page.number,
          size: samData.page.size,
          totalElements: samData.page.totalElements,
          totalPages: samData.page.totalPages,
          hasNext: samData.page.number < samData.page.totalPages - 1,
          hasPrevious: samData.page.number > 0,
        },
        searchParams: filters,
        searchedAt: new Date().toISOString(),
        searchDuration,
      };
    } catch (error) {
      console.error('SAM.gov search error:', error);
      throw error;
    }
  }

  /**
   * Search with pagination - now just makes a single request per page
   */
  static async searchWithPagination(
    filters: SearchFilters,
    maxPages: number = 1,
    delayMs: number = 2000
  ): Promise<SearchResult> {
    // For now, just make a single request - proper pagination will be handled by frontend
    const result = await this.searchOpportunities(filters);
    
    console.log(`Search returned ${result.contracts.length} contracts (Page ${result.pagination.page + 1} of ${result.pagination.totalPages}, ${result.pagination.totalElements} total)`);
    
    return result;
  }

  /**
   * Convert SAM opportunity to Contract object
   */
  private static convertSAMOpportunityToContract(opportunity: SAMOpportunity): Contract {
    // Get primary organization (usually the highest level)
    const primaryOrg = opportunity.organizationHierarchy?.[0] || null;
    
    // Extract description from descriptions array
    const description = opportunity.descriptions?.[0]?.content || '';
    
    // Parse HTML tags and truncate if needed
    const cleanDescription = description.replace(/<[^>]*>/g, '').trim();
    
    return {
      id: opportunity._id,
      title: opportunity.title,
      url: `https://sam.gov/opp/${opportunity._id}/view`,
      description: cleanDescription,
      postedDate: opportunity.publishDate,
      deadline: opportunity.responseDate,
      status: ContractStatus.NEW,
      aiScore: 0,
      attachments: [], // Will be populated separately if needed
      flags: [],
      priority: ContractPriority.MEDIUM,
      organizationId: primaryOrg?.organizationId || undefined,
      solicitationNumber: opportunity.solicitationNumber,
      classificationCode: undefined, // Not provided in search results
      setAside: undefined, // Would need to be inferred from search filters
      naicsCodes: [], // Not provided in search results
      fetchMethod: 'search-api',
      apiSource: 'sam-search',
      fetchDurationMs: 0,
      lastViewedAt: undefined,
      viewCount: 0,
      analysisStatus: AnalysisStatus.PENDING,
      isArchived: false,
      archivedAt: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get search suggestions based on query
   */
  static async getSearchSuggestions(query: string): Promise<string[]> {
    // This would typically call a suggestions API
    // For now, return empty array
    return [];
  }
}

export default SAMSearchService;
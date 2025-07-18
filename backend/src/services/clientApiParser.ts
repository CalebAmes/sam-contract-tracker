import { Contract, ContractStatus, Attachment, AnalysisStatus } from '../../database';
import axios from 'axios';

export interface ClientApiResponse {
  opportunityId: string;
  data2: {
    title: string;
    naics: Array<{
      code: string[];
      type: string;
    }>;
    solicitation: {
      setAside: string;
      deadlines: {
        response: string;
        responseTz: string;
      };
    };
    organizationId: string;
    pointOfContact: Array<{
      fax: string;
      type: string;
      email: string;
      phone: string;
      title: string;
      fullName: string;
    }>;
    classificationCode: string;
    placeOfPerformance: {
      zip: string;
      city: { name: string };
      state: { name: string };
      country: { name: string };
      streetAddress: string;
      streetAddress2: string;
    };
    solicitationNumber: string;
    additionalReporting: string[];
  };
  additionalInfo: {
    sections: Array<{
      id: string;
      status: string;
    }>;
  };
  parent: any;
  related: any;
  status: {
    code: string;
    value: string;
  };
  archived: boolean;
  cancelled: boolean;
  latest: boolean;
  deleted: boolean;
  postedDate: string;
  modifiedDate: string;
  createdDate: string;
  modifiedBy: string;
  createdBy: string;
  description: Array<{
    opportunityId: string;
    descriptionId: string;
    modifiedOn: string;
    body: string;
  }>;
  totalCount: number;
  roleIds: string;
  domainIds: string;
  _links: any;
  id: string;
}

export class ClientApiParser {
  /**
   * Parse the client API response into our Contract interface
   */
  public static parseClientApiResponse(
    apiResponse: ClientApiResponse,
    opportunityId: string,
    fetchMethod?: string,
    fetchDurationMs?: number
  ): Contract {
    const now = new Date().toISOString();
    
    // Extract basic contract information
    const title = apiResponse.data2?.title || 'Unknown Title';
    const description = apiResponse.description?.[0]?.body || '';
    const postedDate = apiResponse.postedDate || now;
    const deadline = apiResponse.data2?.solicitation?.deadlines?.response || '';
    
    // Generate contract URL
    const url = `https://sam.gov/opp/${opportunityId}/view`;
    
    // Map status - SAM.gov uses different status codes
    let status: ContractStatus = ContractStatus.NEW;
    switch (apiResponse.status?.code) {
      case 'published':
        status = ContractStatus.NEW;
        break;
      case 'archived':
        status = ContractStatus.DISMISSED;
        break;
      default:
        status = ContractStatus.NEW;
    }
    
    return {
      id: opportunityId,
      title,
      url,
      description,
      postedDate,
      deadline,
      status,
      aiScore: 0, // Will be calculated later by AI analysis
      attachments: [], // Will be populated separately
      flags: [], // Initialize with empty flags array
      // New tracking fields
      organizationId: apiResponse.data2?.organizationId,
      solicitationNumber: apiResponse.data2?.solicitationNumber,
      classificationCode: apiResponse.data2?.classificationCode,
      setAside: apiResponse.data2?.solicitation?.setAside,
      naicsCodes: apiResponse.data2?.naics?.map(n => n.code).flat(),
      fetchMethod: fetchMethod || 'client-api',
      apiSource: 'client-api',
      fetchDurationMs: fetchDurationMs,
      viewCount: 0,
      analysisStatus: AnalysisStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Extract additional contract metadata from the client API response
   */
  public static extractMetadata(apiResponse: ClientApiResponse) {
    return {
      organizationId: apiResponse.data2?.organizationId || '',
      solicitationNumber: apiResponse.data2?.solicitationNumber || '',
      classificationCode: apiResponse.data2?.classificationCode || '',
      setAside: apiResponse.data2?.solicitation?.setAside || '',
      naicsCodes: apiResponse.data2?.naics?.map(n => n.code).flat() || [],
      pointOfContact: apiResponse.data2?.pointOfContact || [],
      placeOfPerformance: apiResponse.data2?.placeOfPerformance || {},
      apiStatus: apiResponse.status || {},
      modifiedBy: apiResponse.modifiedBy || '',
      createdBy: apiResponse.createdBy || '',
    };
  }

  /**
   * Attempt to fetch attachments from the client API
   * This is experimental - we need to investigate the actual endpoint
   */
  public static async fetchAttachmentsFromClientApi(
    opportunityId: string,
    sessionTokens: {
      session?: string;
      xsrfToken?: string;
      authToken?: string;
      cookies?: string;
    }
  ): Promise<Attachment[]> {
    try {
      // Use the correct v3 resources endpoint for attachments
      const possibleEndpoints = [
        `https://sam.gov/api/prod/opps/v3/opportunities/${opportunityId}/resources`,
        `https://sam.gov/api/prod/opps/v2/opportunities/${opportunityId}/attachments`,
        `https://sam.gov/api/prod/opps/v2/opportunities/${opportunityId}/documents`,
        `https://sam.gov/api/prod/opps/v2/opportunities/${opportunityId}/files`,
      ];

      for (const endpoint of possibleEndpoints) {
        try {
          console.log(`Attempting to fetch attachments from: ${endpoint}`);
          
          const response = await axios.get(endpoint, {
            timeout: 10000,
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
              "Accept": "application/json, text/plain, */*",
              "Accept-Language": "en-US,en;q=0.9",
              "Accept-Encoding": "gzip, deflate, br, zstd",
              "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": '"macOS"',
              "sec-fetch-dest": "empty",
              "sec-fetch-mode": "cors",
              "sec-fetch-site": "same-origin",
              "referer": `https://sam.gov/opp/${opportunityId}/view`,
              ...(sessionTokens.cookies && { "cookie": sessionTokens.cookies }),
              ...(sessionTokens.authToken && { "x-auth-token": sessionTokens.authToken }),
            },
            params: {
              random: Date.now(),
              ...(endpoint.includes('v3/opportunities') && {
                excludeDeleted: false,
                withScanResult: false
              }),
            },
          });

          if (response.status === 200 && response.data) {
            console.log(`Successfully fetched attachments from ${endpoint}`);
            return this.parseAttachmentsFromApiResponse(response.data, opportunityId);
          }
        } catch (error) {
          console.log(`Failed to fetch from ${endpoint}:`, error instanceof Error ? error.message : 'Unknown error');
          continue;
        }
      }

      console.log('No attachment endpoints found, will fallback to HTML parsing');
      return [];
    } catch (error) {
      console.error('Error fetching attachments from client API:', error);
      return [];
    }
  }

  /**
   * Parse attachments from API response (format depends on actual SAM.gov API)
   */
  private static parseAttachmentsFromApiResponse(
    apiResponse: any,
    opportunityId: string
  ): Attachment[] {
    const attachments: Attachment[] = [];
    
    // This is a placeholder - actual format depends on SAM.gov API structure
    if (Array.isArray(apiResponse.attachments)) {
      apiResponse.attachments.forEach((attachment: any, index: number) => {
        attachments.push({
          id: attachment.id || `attachment_${index}`,
          name: attachment.name || attachment.filename || `Document ${index + 1}`,
          url: attachment.url || attachment.downloadUrl || '',
          type: this.getFileType(attachment.name || attachment.filename || ''),
          size: attachment.size || undefined,
          downloaded: false,
          downloadedAt: undefined,
          content: undefined,
        });
      });
    }

    return attachments;
  }

  /**
   * Determine file type from filename or URL
   */
  private static getFileType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'doc':
      case 'docx':
        return 'application/msword';
      case 'xls':
      case 'xlsx':
        return 'application/vnd.ms-excel';
      case 'txt':
        return 'text/plain';
      case 'zip':
        return 'application/zip';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Validate that the API response has the expected structure
   */
  public static validateApiResponse(apiResponse: any): boolean {
    return (
      apiResponse &&
      typeof apiResponse === 'object' &&
      apiResponse.opportunityId &&
      apiResponse.data2 &&
      apiResponse.data2.title
    );
  }

  /**
   * Extract all useful information from the client API response
   */
  public static extractAllData(
    apiResponse: ClientApiResponse, 
    opportunityId: string,
    fetchMethod?: string,
    fetchDurationMs?: number
  ) {
    const contract = this.parseClientApiResponse(apiResponse, opportunityId, fetchMethod, fetchDurationMs);
    const metadata = this.extractMetadata(apiResponse);
    
    return {
      contract,
      metadata,
      rawResponse: apiResponse, // Keep for debugging
    };
  }
}

export default ClientApiParser;
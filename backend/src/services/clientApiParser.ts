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
   * Fetch attachments from the SAM.gov v3 resources API
   * This uses the confirmed working endpoint structure
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
      // Use the confirmed working v3 resources endpoint
      const endpoint = `https://sam.gov/api/prod/opps/v3/opportunities/${opportunityId}/resources`;
      
      console.log(`Fetching attachments from: ${endpoint}`);
      
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
          excludeDeleted: false,
          withScanResult: false,
        },
      });

      if (response.status === 200 && response.data) {
        console.log(`Successfully fetched attachments from ${endpoint}`);
        return this.parseAttachmentsFromApiResponse(response.data, opportunityId);
      }

      console.log('No attachments found in response');
      return [];
    } catch (error) {
      console.error('Error fetching attachments from client API:', error);
      return [];
    }
  }

  /**
   * Parse attachments from the v3 resources API response
   */
  private static parseAttachmentsFromApiResponse(
    apiResponse: any,
    opportunityId: string
  ): Attachment[] {
    const attachments: Attachment[] = [];
    
    try {
      // Handle the actual API response structure:
      // { "_embedded": { "opportunityAttachmentList": [{ "attachments": [...] }] } }
      const embedded = apiResponse._embedded;
      if (embedded && embedded.opportunityAttachmentList && embedded.opportunityAttachmentList.length > 0) {
        const attachmentList = embedded.opportunityAttachmentList[0].attachments;
        
        if (Array.isArray(attachmentList)) {
          attachmentList.forEach((attachment: any) => {
            // Skip deleted attachments
            if (attachment.deletedFlag === "1") {
              return;
            }
            
            // Create download URL using resourceId
            const downloadUrl = `https://sam.gov/api/prod/opps/v3/opportunities/resources/files/${attachment.resourceId}/download`;
            
            attachments.push({
              id: attachment.attachmentId || attachment.resourceId,
              name: attachment.name || `Document ${attachment.attachmentOrder}`,
              url: downloadUrl,
              type: this.getFileType(attachment.name || ''),
              size: attachment.size || undefined,
              downloaded: false,
              downloadedAt: undefined,
              content: undefined,
            });
          });
        }
      }
    } catch (error) {
      console.error('Error parsing attachments from API response:', error);
    }

    console.log(`Parsed ${attachments.length} attachments from API response`);
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
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { FileConverter, ConvertedFile } from './fileConverter';

export interface WrapperAnalysis {
  wrapperScore: number;
  contractType: 'SaaS Reseller' | 'Hardware Reseller' | 'Professional Services' | 'Hybrid' | 'Custom Development' | 'Unknown';
  summary: string;
  redFlags: Array<{
    flag: string;
    detail: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  incumbentInfo: {
    vendor: string | null;
    contractNumber: string | null;
    expirationDate: string | null;
  };
  recommendedAction: string;
  keyDates: {
    currentDeadline: string;
    contractStart: string;
    urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  };
  estimatedValue: string;
  competitionLevel: 'low' | 'medium' | 'high';
  competitionNotes: string;
}

const SYSTEM_PROMPT = `You are an expert government contracting analyst specializing in identifying "wrapper contracts" - small business set-asides that actually need a middleman for a larger vendor.

Analyze the provided documents and return a JSON response with this exact structure:

{
  "wrapperScore": [0-100 score based on likelihood this is a wrapper contract],
  "contractType": [one of: "SaaS Reseller", "Hardware Reseller", "Professional Services", "Hybrid", "Custom Development", "Unknown"],
  "summary": "[1-2 paragraph analysis explaining your conclusion]",
  "redFlags": [
    {
      "flag": "[type of red flag]",
      "detail": "[specific evidence from documents]",
      "severity": "[high/medium/low]"
    }
  ],
  "incumbentInfo": {
    "vendor": "[vendor name if found, else null]",
    "contractNumber": "[contract number if found, else null]",
    "expirationDate": "[YYYY-MM-DD if found, else null]"
  },
  "recommendedAction": "[specific actionable advice]",
  "keyDates": {
    "currentDeadline": "[YYYY-MM-DD]",
    "contractStart": "[YYYY-MM-DD]",
    "urgencyLevel": "[critical/high/medium/low]"
  },
  "estimatedValue": "[best estimate with timeframe]",
  "competitionLevel": "[low/medium/high]",
  "competitionNotes": "[explanation of competition assessment]"
}

Red flags to look for:
- Named incumbent vendors or systems
- "Follow-on contract" language
- Requirements impossible for small businesses (FedRAMP, high insurance, etc.)
- Very short implementation timelines
- Multiple deadline extensions
- Enterprise requirements with small business set-aside
- References to "current system" or "existing contractor"
- Migration requirements from specific systems`;

export type GeminiModel = '2.0-flash' | '2.5-flash' | '2.5-pro';

export class GeminiAnalyzer {
  private static BASE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  private static getModelEndpoint(model: GeminiModel): string {
    const modelMap = {
      '2.0-flash': 'gemini-2.0-flash',
      '2.5-flash': 'gemini-2.5-flash',
      '2.5-pro': 'gemini-2.5-pro'
    };
    return `${this.BASE_API_URL}/${modelMap[model]}:generateContent`;
  }

  static async analyzeContract(
    contractData: any,
    uploadedFilePaths: string[],
    apiKey: string,
    progressCallback?: (progress: number, message: string) => Promise<void>,
    model: GeminiModel = '2.0-flash'
  ): Promise<WrapperAnalysis> {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    try {
      if (progressCallback) {
        await progressCallback(35, 'Preparing contract data for analysis...');
      }
      
      // Prepare the parts array with contract data and file uploads
      const parts: any[] = [
        {
          text: `${SYSTEM_PROMPT}\n\nContract Information:\nTitle: ${contractData.title}\nOrganization: ${contractData.organizationId || 'Unknown'}\nPosted Date: ${contractData.postedDate}\nDeadline: ${contractData.deadline}\nDescription: ${contractData.description || 'No description'}\nSet Aside: ${contractData.setAside || 'Unknown'}\nClassification: ${contractData.classificationCode || 'Unknown'}`
        }
      ];

      // Track converted files for cleanup
      const convertedFiles: ConvertedFile[] = [];
      
      try {
        // Add uploaded documents as inline data
        for (let i = 0; i < uploadedFilePaths.length; i++) {
          const filePath = uploadedFilePaths[i];
          if (progressCallback) {
            await progressCallback(
              40 + (i / uploadedFilePaths.length) * 20, 
              `Processing document ${i + 1} of ${uploadedFilePaths.length}...`
            );
          }
          
          let actualFilePath = filePath;
          let mimeType = FileConverter.getMimeType(filePath);
          
          // Check if file needs conversion
          if (!FileConverter.isSupportedByGemini(mimeType)) {
            console.log(`File ${path.basename(filePath)} (${mimeType}) needs conversion`);
            
            const converted = await FileConverter.convertFile(filePath);
            if (converted) {
              convertedFiles.push(converted);
              actualFilePath = converted.convertedPath;
              mimeType = converted.convertedMimeType;
              console.log(`Converted ${path.basename(filePath)} to ${mimeType}`);
              
              if (converted.conversionNotes && progressCallback) {
                await progressCallback(
                  40 + (i / uploadedFilePaths.length) * 20,
                  `${converted.conversionNotes}`
                );
              }
            }
          }
          
          const fileData = await fs.readFile(actualFilePath);
          
          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: fileData.toString('base64')
            }
          });
        }
      } finally {
        // Always clean up converted files
        if (convertedFiles.length > 0) {
          console.log(`Cleaning up ${convertedFiles.length} converted files`);
          await FileConverter.cleanupConversions(convertedFiles);
        }
      }

      if (progressCallback) {
        await progressCallback(65, 'Sending documents to Gemini AI for analysis...');
      }

      const endpoint = this.getModelEndpoint(model);
      console.log(`Using Gemini model: ${model} at endpoint: ${endpoint}`);
      
      // Configure generation parameters based on model
      const generationConfig = {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: model === '2.5-pro' ? 10000 : model === '2.5-flash' ? 10000 : 2048,
      };

      const response = await axios.post(
        `${endpoint}?key=${apiKey}`,
        {
          contents: [{
            parts: parts
          }],
          generationConfig,
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE"
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (progressCallback) {
        await progressCallback(85, 'Processing Gemini AI response...');
      }

      // Check response structure and log for debugging
      console.log('Gemini API Response Status:', response.status);
      console.log('Gemini API Response Data:', JSON.stringify(response.data, null, 2));
      
      if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
        console.error('Invalid Gemini API response structure:', response.data);
        throw new Error(`Invalid Gemini API response: ${JSON.stringify(response.data)}`);
      }

      const candidate = response.data.candidates[0];
      
      // Handle MAX_TOKENS finish reason
      if (candidate.finishReason === 'MAX_TOKENS') {
        console.error('Gemini response was cut off due to max tokens limit');
        throw new Error(`Analysis incomplete: The ${model} model reached its maximum token limit. Try using a simpler prompt or switch to a model with higher limits.`);
      }
      
      // Handle other finish reasons that might not have content
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        console.error('Gemini response finished with reason:', candidate.finishReason);
        throw new Error(`Analysis failed: The model finished with reason "${candidate.finishReason}". Please try again or use a different model.`);
      }

      if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
        console.error('Invalid candidate structure:', candidate);
        throw new Error(`Invalid candidate structure: ${JSON.stringify(candidate)}`);
      }

      const result = candidate.content.parts[0].text;
      
      // Clean up the response - sometimes Gemini returns JSON wrapped in markdown
      let cleanedResult = result;
      if (result.includes('```json')) {
        cleanedResult = result.match(/```json\n([\s\S]*?)\n```/)?.[1] || result;
      } else if (result.includes('```')) {
        cleanedResult = result.match(/```\n([\s\S]*?)\n```/)?.[1] || result;
      }
      
      // Parse the JSON response
      const analysis = JSON.parse(cleanedResult);
      
      return analysis as WrapperAnalysis;
    } catch (error) {
      console.error('Error analyzing contract with Gemini:', error instanceof Error ? error.message : error);
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:');
        console.error('- Status:', error.response?.status);
        console.error('- Status text:', error.response?.statusText);
        console.error('- Request URL:', error.config?.url);
        console.error('- Request Method:', error.config?.method);
        console.error('- Response headers:', error.response?.headers);
        console.error('- Response data:', JSON.stringify(error.response?.data, null, 2));
      }
      throw error;
    }
  }

}
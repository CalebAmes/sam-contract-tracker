import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

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

export class GeminiAnalyzer {
  private static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  static async analyzeContract(
    contractData: any,
    uploadedFilePaths: string[],
    apiKey: string
  ): Promise<WrapperAnalysis> {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    try {
      // Prepare the parts array with contract data and file uploads
      const parts: any[] = [
        {
          text: `${SYSTEM_PROMPT}\n\nContract Information:\nTitle: ${contractData.title}\nOrganization: ${contractData.organizationId || 'Unknown'}\nPosted Date: ${contractData.postedDate}\nDeadline: ${contractData.deadline}\nDescription: ${contractData.description || 'No description'}\nSet Aside: ${contractData.setAside || 'Unknown'}\nClassification: ${contractData.classificationCode || 'Unknown'}`
        }
      ];

      // Add uploaded documents as inline data
      for (const filePath of uploadedFilePaths) {
        const fileData = await fs.readFile(filePath);
        const mimeType = this.getMimeType(filePath);
        
        parts.push({
          inline_data: {
            mime_type: mimeType,
            data: fileData.toString('base64')
          }
        });
      }

      const response = await axios.post(
        `${this.API_URL}?key=${apiKey}`,
        {
          contents: [{
            parts: parts
          }],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
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

      const result = response.data.candidates[0].content.parts[0].text;
      
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
      console.error('Error analyzing contract with Gemini:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
      }
      throw error;
    }
  }

  private static getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.pdf':
        return 'application/pdf';
      case '.doc':
        return 'application/msword';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case '.txt':
        return 'text/plain';
      default:
        return 'application/octet-stream';
    }
  }
}
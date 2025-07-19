import * as fs from 'fs/promises';
import * as path from 'path';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';

export interface ConvertedFile {
  originalPath: string;
  convertedPath: string;
  originalMimeType: string;
  convertedMimeType: string;
  conversionNotes?: string;
}

export class FileConverter {
  private static tempDir = path.join(process.cwd(), 'temp', 'conversions');

  static async ensureTempDir(): Promise<void> {
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  /**
   * Check if a file type is supported by Gemini API
   */
  static isSupportedByGemini(mimeType: string): boolean {
    const supportedTypes = [
      'application/pdf',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    return supportedTypes.includes(mimeType);
  }

  /**
   * Get MIME type from file extension
   */
  static getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Convert Excel file to text
   */
  static async convertExcelToText(filePath: string): Promise<string> {
    try {
      const workbook = XLSX.readFile(filePath);
      let textContent = '';
      
      // Process each sheet
      workbook.SheetNames.forEach((sheetName, index) => {
        const sheet = workbook.Sheets[sheetName];
        const csvData = XLSX.utils.sheet_to_csv(sheet);
        
        textContent += `\n--- Sheet ${index + 1}: ${sheetName} ---\n`;
        textContent += csvData;
        textContent += '\n';
      });
      
      return textContent.trim();
    } catch (error) {
      console.error('Error converting Excel file:', error);
      throw new Error(`Failed to convert Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert Word document to text
   */
  static async convertWordToText(filePath: string): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      
      if (result.messages.length > 0) {
        console.warn('Word conversion warnings:', result.messages);
      }
      
      return result.value;
    } catch (error) {
      console.error('Error converting Word file:', error);
      throw new Error(`Failed to convert Word file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert PowerPoint to text (basic implementation)
   * Note: For a more complete solution, consider using python-pptx or similar
   */
  static async convertPowerPointToText(filePath: string): Promise<string> {
    // For now, we'll treat PPTX files similar to XLSX (they're both zip archives)
    try {
      // Try to extract text using XLSX library (works for some PPTX files)
      const data = await fs.readFile(filePath);
      const textContent = `PowerPoint presentation: ${path.basename(filePath)}\n\n` +
        `Note: Full PowerPoint text extraction is limited. Consider converting to PDF for better analysis.\n\n` +
        `File size: ${data.length} bytes`;
      
      return textContent;
    } catch (error) {
      console.error('Error converting PowerPoint file:', error);
      throw new Error(`Failed to convert PowerPoint file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert a file to a Gemini-supported format
   */
  static async convertFile(filePath: string): Promise<ConvertedFile | null> {
    await this.ensureTempDir();
    
    const mimeType = this.getMimeType(filePath);
    
    // If already supported, return null (no conversion needed)
    if (this.isSupportedByGemini(mimeType)) {
      return null;
    }
    
    const baseName = path.basename(filePath, path.extname(filePath));
    const convertedFileName = `${baseName}_converted_${Date.now()}.txt`;
    const convertedPath = path.join(this.tempDir, convertedFileName);
    
    let textContent = '';
    let conversionNotes = '';
    
    try {
      switch (mimeType) {
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.ms-excel':
          console.log(`Converting Excel file: ${filePath}`);
          textContent = await this.convertExcelToText(filePath);
          conversionNotes = 'Converted from Excel spreadsheet to text format';
          break;
          
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          console.log(`Converting Word file: ${filePath}`);
          textContent = await this.convertWordToText(filePath);
          conversionNotes = 'Converted from Word document to text format';
          break;
          
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        case 'application/vnd.ms-powerpoint':
          console.log(`Converting PowerPoint file: ${filePath}`);
          textContent = await this.convertPowerPointToText(filePath);
          conversionNotes = 'Limited conversion from PowerPoint - only basic metadata extracted';
          break;
          
        default:
          console.warn(`Unsupported file type for conversion: ${mimeType}`);
          // Create a placeholder text file with metadata
          textContent = `File: ${path.basename(filePath)}\n` +
            `Type: ${mimeType}\n` +
            `Note: This file type is not supported for content extraction.\n`;
          conversionNotes = 'File type not supported - metadata only';
      }
      
      // Add header to converted file
      const header = `=== CONVERTED DOCUMENT ===\n` +
        `Original File: ${path.basename(filePath)}\n` +
        `Original Type: ${mimeType}\n` +
        `Conversion Note: ${conversionNotes}\n` +
        `Converted At: ${new Date().toISOString()}\n` +
        `${'='.repeat(25)}\n\n`;
      
      await fs.writeFile(convertedPath, header + textContent, 'utf-8');
      
      return {
        originalPath: filePath,
        convertedPath,
        originalMimeType: mimeType,
        convertedMimeType: 'text/plain',
        conversionNotes
      };
    } catch (error) {
      console.error(`Error converting file ${filePath}:`, error);
      // Even on error, create a placeholder file
      const errorContent = `=== CONVERSION ERROR ===\n` +
        `Original File: ${path.basename(filePath)}\n` +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
      
      await fs.writeFile(convertedPath, errorContent, 'utf-8');
      
      return {
        originalPath: filePath,
        convertedPath,
        originalMimeType: mimeType,
        convertedMimeType: 'text/plain',
        conversionNotes: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Clean up temporary conversion files
   */
  static async cleanupConversions(convertedFiles: ConvertedFile[]): Promise<void> {
    for (const file of convertedFiles) {
      try {
        await fs.unlink(file.convertedPath);
      } catch (error) {
        console.error(`Error cleaning up converted file ${file.convertedPath}:`, error);
      }
    }
  }
}
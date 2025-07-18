import * as cheerio from 'cheerio';

interface ParsedContract {
  id: string;
  title: string;
  url: string;
  description: string;
  organization: string;
  postedDate: string;
  deadline: string;
  attachments: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
  }>;
}

export class SamHtmlParser {
  private $: cheerio.CheerioAPI;

  constructor(html: string) {
    this.$ = cheerio.load(html);
  }

  parseContract(opportunityId: string, originalUrl: string): ParsedContract {
    console.log(`Parsing contract HTML for opportunity ID: ${opportunityId}`);

    const title = this.extractTitle();
    const organization = this.extractOrganization();
    const postedDate = this.extractPostedDate();
    const deadline = this.extractDeadline();
    const description = this.extractDescription();
    const attachments = this.extractAttachments();

    console.log(`Extracted: title="${title}", org="${organization}", posted="${postedDate}", deadline="${deadline}"`);

    return {
      id: opportunityId,
      title,
      url: originalUrl,
      description,
      organization,
      postedDate,
      deadline,
      attachments,
    };
  }

  private extractTitle(): string {
    const selectors = [
      'h1',
      '.page-title',
      '[data-cy="opportunity-title"]',
      '.opportunity-title',
      '.title',
      '.contract-title',
      'title'
    ];

    for (const selector of selectors) {
      const element = this.$(selector).first();
      if (element.length && element.text().trim()) {
        const title = element.text().trim();
        console.log(`Found title with selector "${selector}": ${title}`);
        return title;
      }
    }

    // Fallback: look for any heading with "opportunity" or "contract" in nearby text
    const headings = this.$('h1, h2, h3').toArray();
    for (const heading of headings) {
      const text = this.$(heading).text().trim();
      if (text && text.length > 10) {
        console.log(`Fallback title found: ${text}`);
        return text;
      }
    }

    return 'Contract title not found';
  }

  private extractOrganization(): string {
    const selectors = [
      '[data-cy="organization"]',
      '.organization',
      '.agency',
      '.department',
      '.contracting-office',
      '.office'
    ];

    for (const selector of selectors) {
      const element = this.$(selector).first();
      if (element.length && element.text().trim()) {
        const org = element.text().trim();
        console.log(`Found organization with selector "${selector}": ${org}`);
        return org;
      }
    }

    // Look for text patterns
    const patterns = [
      /Agency[:\s]+([^\\n]+)/i,
      /Department[:\s]+([^\\n]+)/i,
      /Office[:\s]+([^\\n]+)/i,
      /Organization[:\s]+([^\\n]+)/i,
      /Contracting Office[:\s]+([^\\n]+)/i,
    ];

    const bodyText = this.$('body').text();
    for (const pattern of patterns) {
      const match = bodyText.match(pattern);
      if (match && match[1]) {
        const org = match[1].trim();
        console.log(`Found organization with pattern: ${org}`);
        return org;
      }
    }

    return 'Organization not found';
  }

  private extractPostedDate(): string {
    return this.extractDateByPattern([
      /Posted[:\s]+([^\\n]+)/i,
      /Posted Date[:\s]+([^\\n]+)/i,
      /Date Posted[:\s]+([^\\n]+)/i,
      /Publication Date[:\s]+([^\\n]+)/i,
    ], 'posted date');
  }

  private extractDeadline(): string {
    return this.extractDateByPattern([
      /Deadline[:\s]+([^\\n]+)/i,
      /Due Date[:\s]+([^\\n]+)/i,
      /Response Due[:\s]+([^\\n]+)/i,
      /Proposal Due[:\s]+([^\\n]+)/i,
      /Closing Date[:\s]+([^\\n]+)/i,
    ], 'deadline');
  }

  private extractDateByPattern(patterns: RegExp[], type: string): string {
    const bodyText = this.$('body').text();
    
    for (const pattern of patterns) {
      const match = bodyText.match(pattern);
      if (match && match[1]) {
        const dateStr = match[1].trim();
        console.log(`Found ${type} with pattern: ${dateStr}`);
        
        // Try to parse and standardize the date
        try {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date.toISOString();
          }
        } catch (e) {
          // If parsing fails, return the original string
          return dateStr;
        }
      }
    }

    return `${type} not found`;
  }

  private extractDescription(): string {
    const selectors = [
      '[data-cy="description"]',
      '.description',
      '.contract-description',
      '.opportunity-description',
      '.summary',
      '.overview',
      '.details'
    ];

    for (const selector of selectors) {
      const element = this.$(selector).first();
      if (element.length && element.text().trim()) {
        const desc = element.text().trim();
        console.log(`Found description with selector "${selector}": ${desc.substring(0, 100)}...`);
        return desc;
      }
    }

    // Look for paragraphs with substantial content
    const paragraphs = this.$('p').toArray();
    for (const p of paragraphs) {
      const text = this.$(p).text().trim();
      if (text && text.length > 100) {
        console.log(`Fallback description found: ${text.substring(0, 100)}...`);
        return text;
      }
    }

    return 'Description not found';
  }

  private extractAttachments(): Array<{id: string; name: string; url: string; type: string}> {
    const attachments: Array<{id: string; name: string; url: string; type: string}> = [];

    const selectors = [
      'a[href*=".pdf"]',
      'a[href*=".doc"]',
      'a[href*=".docx"]',
      'a[href*="download"]',
      '.attachment a',
      '.document a',
      '.file a'
    ];

    for (const selector of selectors) {
      this.$(selector).each((index, element) => {
        const link = this.$(element);
        const href = link.attr('href');
        const name = link.text().trim() || link.attr('title') || `Document ${index + 1}`;
        
        if (href && name) {
          const fullUrl = href.startsWith('http') ? href : `https://sam.gov${href}`;
          const fileType = this.getFileType(href);
          
          attachments.push({
            id: `attachment_${index}`,
            name,
            url: fullUrl,
            type: fileType
          });
        }
      });
    }

    console.log(`Found ${attachments.length} attachments`);
    return attachments;
  }

  private getFileType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'PDF Document';
      case 'doc':
      case 'docx':
        return 'Word Document';
      case 'xls':
      case 'xlsx':
        return 'Excel Spreadsheet';
      case 'txt':
        return 'Text File';
      default:
        return 'Document';
    }
  }
}

export const parseSamContract = (html: string, opportunityId: string, originalUrl: string): ParsedContract => {
  const parser = new SamHtmlParser(html);
  return parser.parseContract(opportunityId, originalUrl);
};
import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, CheckCircle } from 'lucide-react';
import ContractTable from '../components/ContractTable';
import ContractPreviewModal from '../components/ContractPreviewModal';

interface Contract {
  id: string;
  title: string;
  url: string;
  description: string;
  postedDate: string;
  deadline: string;
  status: string;
  aiScore: number;
  attachments: any[];
  createdAt: string;
  updatedAt: string;
}

interface SearchResult {
  contracts: Contract[];
  totalFound: number;
  searchUrl: string;
  scrapedAt: string;
  pagination?: {
    offset: number;
    limit: number;
    totalRecords: number;
    hasMore: boolean;
  };
}

export default function SearchSam() {
  const [samUrl, setSamUrl] = useState(() => localStorage.getItem('samSearch_url') || '');
  const [isValidUrl, setIsValidUrl] = useState<boolean | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(() => {
    const saved = localStorage.getItem('samSearch_results');
    return saved ? JSON.parse(saved) : null;
  });
  const [error, setError] = useState<string | null>(null);
  
  // Search form state with localStorage persistence
  const [title, setTitle] = useState(() => localStorage.getItem('samSearch_title') || '');
  const [ncode, setNcode] = useState(() => localStorage.getItem('samSearch_ncode') || '');
  const [ccode, setCcode] = useState(() => localStorage.getItem('samSearch_ccode') || '');
  const [setAsideType, setSetAsideType] = useState(() => localStorage.getItem('samSearch_setAsideType') || '');
  const [noticeTypes, setNoticeTypes] = useState<string[]>(() => {
    const saved = localStorage.getItem('samSearch_noticeTypes');
    return saved ? JSON.parse(saved) : [];
  });
  const [organizationCode, setOrganizationCode] = useState(() => localStorage.getItem('samSearch_organizationCode') || '');
  const [organizationName, setOrganizationName] = useState(() => localStorage.getItem('samSearch_organizationName') || '');
  const [state, setState] = useState(() => localStorage.getItem('samSearch_state') || '');
  const [zip, setZip] = useState(() => localStorage.getItem('samSearch_zip') || '');
  const [daysBack, setDaysBack] = useState(() => localStorage.getItem('samSearch_daysBack') || '30');
  const [responseFromDays, setResponseFromDays] = useState(() => localStorage.getItem('samSearch_responseFromDays') || '');
  const [responseToDays, setResponseToDays] = useState(() => localStorage.getItem('samSearch_responseToDays') || '');
  const [currentOffset, setCurrentOffset] = useState(0);
  const [lastSearchParams, setLastSearchParams] = useState<any>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pageSize, setPageSize] = useState(() => localStorage.getItem('samSearch_pageSize') || '25');
  const [currentPage, setCurrentPage] = useState(0);

  // Save to localStorage whenever values change
  useEffect(() => {
    localStorage.setItem('samSearch_url', samUrl);
  }, [samUrl]);

  useEffect(() => {
    if (searchResult) {
      localStorage.setItem('samSearch_results', JSON.stringify(searchResult));
    }
  }, [searchResult]);

  useEffect(() => {
    localStorage.setItem('samSearch_title', title);
  }, [title]);

  useEffect(() => {
    localStorage.setItem('samSearch_ncode', ncode);
  }, [ncode]);

  useEffect(() => {
    localStorage.setItem('samSearch_ccode', ccode);
  }, [ccode]);

  useEffect(() => {
    localStorage.setItem('samSearch_setAsideType', setAsideType);
  }, [setAsideType]);

  useEffect(() => {
    localStorage.setItem('samSearch_noticeTypes', JSON.stringify(noticeTypes));
  }, [noticeTypes]);

  useEffect(() => {
    localStorage.setItem('samSearch_organizationCode', organizationCode);
  }, [organizationCode]);

  useEffect(() => {
    localStorage.setItem('samSearch_organizationName', organizationName);
  }, [organizationName]);

  useEffect(() => {
    localStorage.setItem('samSearch_state', state);
  }, [state]);

  useEffect(() => {
    localStorage.setItem('samSearch_zip', zip);
  }, [zip]);

  useEffect(() => {
    localStorage.setItem('samSearch_daysBack', daysBack);
  }, [daysBack]);

  useEffect(() => {
    localStorage.setItem('samSearch_responseFromDays', responseFromDays);
  }, [responseFromDays]);

  useEffect(() => {
    localStorage.setItem('samSearch_responseToDays', responseToDays);
  }, [responseToDays]);

  useEffect(() => {
    localStorage.setItem('samSearch_pageSize', pageSize);
  }, [pageSize]);

  // Validate URL on component mount if URL is loaded from localStorage
  useEffect(() => {
    if (samUrl) {
      validateSamUrl(samUrl);
    }
  }, []);

  const validateSamUrl = (url: string) => {
    if (!url) {
      setIsValidUrl(null);
      return;
    }
    
    try {
      const urlObj = new URL(url);
      const isValid = urlObj.hostname === 'sam.gov' || urlObj.hostname === 'www.sam.gov';
      setIsValidUrl(isValid);
      
      // If valid, parse and populate filters
      if (isValid) {
        parseSamUrl(url);
      }
    } catch {
      setIsValidUrl(false);
    }
  };

  const parseSamUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      const searchString = urlObj.search;
      
      // Handle both simple and complex SAM.gov URL structures
      console.log('Parsing SAM.gov URL:', url);
      
      // Parse set-aside types from complex structure: sfm[setAside][0][key]=SBA
      const setAsideMatch = searchString.match(/sfm%5BsetAside%5D%5B\d+%5D%5Bkey%5D=([^&]+)/);
      if (setAsideMatch) {
        const setAsideValue = decodeURIComponent(setAsideMatch[1]);
        console.log('Found set-aside:', setAsideValue);
        setSetAsideType(setAsideValue);
      }
      
      // Parse notice types from complex structure: sfm[typeOfNotice][0][key]=r
      const noticeTypeMatches = searchString.matchAll(/sfm%5BtypeOfNotice%5D%5B\d+%5D%5Bkey%5D=([^&]+)/g);
      const noticeTypeKeys = Array.from(noticeTypeMatches, match => decodeURIComponent(match[1]));
      if (noticeTypeKeys.length > 0) {
        console.log('Found notice types:', noticeTypeKeys);
        setNoticeTypes(noticeTypeKeys);
      }
      
      // Parse NAICS codes from complex structure: sfm[serviceClassificationWrapper][naics][0][key]=541512
      const naicsMatches = searchString.matchAll(/sfm%5BserviceClassificationWrapper%5D%5Bnaics%5D%5B\d+%5D%5Bkey%5D=([^&]+)/g);
      const naicsCodes = Array.from(naicsMatches, match => decodeURIComponent(match[1]));
      if (naicsCodes.length > 0) {
        console.log('Found NAICS codes:', naicsCodes);
        setNcode(naicsCodes.join(','));
      }
      
      // Parse keywords from simple search
      const params = new URLSearchParams(urlObj.search);
      const titleParam = params.get('title') || params.get('q') || '';
      if (titleParam) {
        console.log('Found title:', titleParam);
        setTitle(titleParam);
      }
      
      // Parse other simple parameters
      const codeParam = params.get('ccode') || params.get('psc') || '';
      if (codeParam) setCcode(codeParam);
      
      const stateCode = params.get('state') || '';
      if (stateCode) setState(stateCode);
      
      const zipCode = params.get('zip') || '';
      if (zipCode) setZip(zipCode);
      
      const orgCode = params.get('organizationCode') || '';
      if (orgCode) setOrganizationCode(orgCode);
      
      const orgName = params.get('organizationName') || '';
      if (orgName) setOrganizationName(orgName);
      
      // Handle date range if present
      const postedFrom = params.get('postedFrom');
      const postedTo = params.get('postedTo');
      if (postedFrom && postedTo) {
        const fromDate = new Date(postedFrom);
        const toDate = new Date();
        const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Set closest days back option
        if (daysDiff <= 7) setDaysBack('7');
        else if (daysDiff <= 30) setDaysBack('30');
        else if (daysDiff <= 60) setDaysBack('60');
        else setDaysBack('90');
      }
      
      console.log('URL parsing completed');
      
    } catch (error) {
      console.error('Error parsing SAM.gov URL:', error);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setSamUrl(url);
    validateSamUrl(url);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!isValidUrl || !samUrl) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:3001/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: samUrl,
          maxResults: 100
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: SearchResult = await response.json();
      setSearchResult(result);
    } catch (err) {
      console.error('Error fetching contracts:', err instanceof Error ? err.message : 'Unknown error');
      setError('Failed to fetch contracts. Please check your connection and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDirectSearch = async (offset = 0) => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      // Calculate date range
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - parseInt(daysBack));
      
      const searchParams: any = {
        q: title || '',
        qMode: 'ALL',
        naics: ncode ? ncode.split(',').map(n => n.trim()) : [],
        notice_type: noticeTypes,
        set_aside: setAsideType ? [setAsideType] : [],
        is_active: true,
        publishDate: {
          gte: fromDate.toISOString().split('T')[0],
          lte: toDate.toISOString().split('T')[0]
        },
        size: parseInt(pageSize),
        page: Math.floor(offset / parseInt(pageSize)) || 0
      };

      // Add response deadline filters if specified
      if (responseFromDays || responseToDays) {
        searchParams.responseDate = {};
        if (responseFromDays) {
          const rdlFromDate = new Date();
          rdlFromDate.setDate(rdlFromDate.getDate() + parseInt(responseFromDays));
          searchParams.responseDate.gte = rdlFromDate.toISOString().split('T')[0];
        }
        if (responseToDays) {
          const rdlToDate = new Date();
          rdlToDate.setDate(rdlToDate.getDate() + parseInt(responseToDays));
          searchParams.responseDate.lte = rdlToDate.toISOString().split('T')[0];
        }
      }
      
      // Save search params for pagination
      setLastSearchParams(searchParams);
      setCurrentOffset(offset);
      
      const response = await fetch('http://localhost:3001/api/search-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters: searchParams,
          maxPages: 1,
          delayMs: 2000
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: SearchResult = await response.json();
      
      // If this is a new search (offset 0), replace results
      // If this is pagination, append results
      if (offset === 0) {
        setSearchResult(result);
      } else {
        setSearchResult(prev => prev ? {
          ...result,
          contracts: [...prev.contracts, ...result.contracts]
        } : result);
      }
    } catch (err) {
      console.error('Error searching contracts:', err instanceof Error ? err.message : 'Unknown error');
      setError('Failed to search contracts. Please check your connection and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLoadMore = () => {
    if (lastSearchParams && searchResult?.pagination?.hasMore) {
      handleDirectSearch(currentOffset + 100);
    }
  };

  const handleStatusChange = async (contractId: string, newStatus: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/contracts/${contractId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        // Update local state
        setSearchResult(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            contracts: prev.contracts.map(contract =>
              contract.id === contractId
                ? { ...contract, status: newStatus }
                : contract
            )
          };
        });
      } else {
        console.error('Failed to update contract status');
      }
    } catch (err) {
      console.error('Error updating contract status:', err);
    }
  };

  const handleContractClick = (contractId: string) => {
    setSelectedContractId(contractId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedContractId(null);
  };

  const handleSaveContract = async (contractData: any) => {
    // Refresh the saved contracts state in ContractTable
    if (searchResult) {
      // Update the search results to show the contract as saved
      setSearchResult(prev => prev ? {
        ...prev,
        contracts: prev.contracts.map(contract =>
          contract.id === contractData.id
            ? { ...contract, status: contractData.status }
            : contract
        )
      } : prev);
    }
    
    // Show success message
    console.log('Contract saved successfully:', contractData.id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-heading mb-2">Search SAM.gov</h2>
        <p className="text-muted-foreground">
          Search government contracts by URL or using filters
        </p>
      </div>
      
      {/* Integrated Search */}
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold font-heading">Search SAM.gov Opportunities</h3>
          <button
            onClick={() => {
              // Clear all filters
              setTitle('');
              setNcode('');
              setCcode('');
              setSetAsideType('');
              setNoticeTypes([]);
              setOrganizationCode('');
              setOrganizationName('');
              setState('');
              setZip('');
              setResponseFromDays('');
              setResponseToDays('');
              setSamUrl('');
              setIsValidUrl(null);
              setSearchResult(null);
              setCurrentOffset(0);
              setCurrentPage(0);
              setPageSize('25');
              
              // Clear localStorage
              localStorage.removeItem('samSearch_url');
              localStorage.removeItem('samSearch_results');
              localStorage.removeItem('samSearch_title');
              localStorage.removeItem('samSearch_ncode');
              localStorage.removeItem('samSearch_ccode');
              localStorage.removeItem('samSearch_setAsideType');
              localStorage.removeItem('samSearch_noticeTypes');
              localStorage.removeItem('samSearch_organizationCode');
              localStorage.removeItem('samSearch_organizationName');
              localStorage.removeItem('samSearch_state');
              localStorage.removeItem('samSearch_zip');
              localStorage.removeItem('samSearch_responseFromDays');
              localStorage.removeItem('samSearch_responseToDays');
              localStorage.setItem('samSearch_daysBack', '30'); // Reset to default
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear All Filters
          </button>
        </div>

        {/* URL Input */}
        <div className="mb-6">
          <label htmlFor="sam-url" className="block text-sm font-medium mb-2">
            Quick Start: Paste SAM.gov Search URL (auto-populates filters)
          </label>
          <div className="relative">
            <input
              type="url"
              id="sam-url"
              value={samUrl}
              onChange={handleUrlChange}
              placeholder="https://sam.gov/search/... (paste your SAM.gov search URL here)"
              className={`w-full px-3 py-2 pr-10 border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 transition-colors ${
                isValidUrl === false 
                  ? 'border-red-500 focus:border-red-500' 
                  : isValidUrl === true 
                  ? 'border-green-500 focus:border-green-500'
                  : 'border-border focus:border-blue-500'
              }`}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {isValidUrl === true && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {isValidUrl === false && (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
            </div>
          </div>
          {isValidUrl === false && (
            <p className="text-sm text-red-600 mt-1">
              Please enter a valid SAM.gov URL
            </p>
          )}
          {isValidUrl === true && (
            <p className="text-sm text-green-600 mt-1">
              ✓ URL parsed - filters populated below
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="border-t border-border pt-6">
          <h4 className="text-md font-medium mb-4">Filter Options</h4>
          
          {/* Basic Search */}
          <div className="mb-6">
            <h5 className="text-sm font-medium text-muted-foreground mb-3">BASIC SEARCH</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium mb-2">
                  Title Keywords
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="contracting, software, consulting..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label htmlFor="ncode" className="block text-sm font-medium mb-2">
                  NAICS Code
                </label>
                <input
                  type="text"
                  id="ncode"
                  value={ncode}
                  onChange={(e) => setNcode(e.target.value)}
                  placeholder="541511, 541512..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="ccode" className="block text-sm font-medium mb-2">
                  Classification/PSC Code
                </label>
                <input
                  type="text"
                  id="ccode"
                  value={ccode}
                  onChange={(e) => setCcode(e.target.value)}
                  placeholder="D302, R408..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Procurement Filters */}
          <div className="mb-6">
            <h5 className="text-sm font-medium text-muted-foreground mb-3">PROCUREMENT FILTERS</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="setaside" className="block text-sm font-medium mb-2">
                  Set-Aside Type
                </label>
                <select
                  id="setaside"
                  value={setAsideType}
                  onChange={(e) => setSetAsideType(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="SBA">SBA - Small Business Set-Aside</option>
                  <option value="8A">8A - 8(a) Program</option>
                  <option value="HZC">HZC - HUBZone Sole Source</option>
                  <option value="HZS">HZS - HUBZone Set-Aside</option>
                  <option value="SDVOSBC">SDVOSBC - Service-Disabled Veteran-Owned Small Business</option>
                  <option value="WOSB">WOSB - Women-Owned Small Business</option>
                  <option value="EDWOSB">EDWOSB - Economically Disadvantaged Women-Owned Small Business</option>
                  <option value="VSA">VSA - Veteran Set Aside</option>
                  <option value="VSS">VSS - Veteran Sole Source</option>
                  <option value="BI">BI - Buy Indian</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Notice Types
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto border border-border rounded-lg p-3 bg-input">
                  {[
                    { value: 'o', label: 'Solicitation' },
                    { value: 'p', label: 'Pre-solicitation' },
                    { value: 'k', label: 'Combined Synopsis/Solicitation' },
                    { value: 'r', label: 'Sources Sought' },
                    { value: 'a', label: 'Award Notice' },
                    { value: 's', label: 'Special Notice' },
                    { value: 'g', label: 'Sale of Surplus Property' },
                    { value: 'u', label: 'Justification (J&A)' },
                    { value: 'i', label: 'Intent to Bundle Requirements (DoD)' }
                  ].map(({ value, label }) => (
                    <label key={value} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                      <input
                        type="checkbox"
                        value={value}
                        checked={noticeTypes.includes(value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNoticeTypes([...noticeTypes, value]);
                          } else {
                            setNoticeTypes(noticeTypes.filter(t => t !== value));
                          }
                        }}
                        className="rounded border-border text-blue-500 focus:ring-blue-500"
                      />
                      <span>{value} - {label}</span>
                    </label>
                  ))}
                </div>
                {noticeTypes.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Selected: {noticeTypes.join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Organization & Location */}
          <div className="mb-6">
            <h5 className="text-sm font-medium text-muted-foreground mb-3">ORGANIZATION & LOCATION</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="orgcode" className="block text-sm font-medium mb-2">
                  Organization Code
                </label>
                <input
                  type="text"
                  id="orgcode"
                  value={organizationCode}
                  onChange={(e) => setOrganizationCode(e.target.value)}
                  placeholder="Organization code..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="orgname" className="block text-sm font-medium mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  id="orgname"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Organization name..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label htmlFor="state" className="block text-sm font-medium mb-2">
                  State
                </label>
                <input
                  type="text"
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="CA, NY, TX..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="zip" className="block text-sm font-medium mb-2">
                  Zip Code
                </label>
                <input
                  type="text"
                  id="zip"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="12345..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Date Filters */}
          <div className="mb-6">
            <h5 className="text-sm font-medium text-muted-foreground mb-3">DATE FILTERS</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="daysback" className="block text-sm font-medium mb-2">
                  Posted Within
                </label>
                <select
                  id="daysback"
                  value={daysBack}
                  onChange={(e) => setDaysBack(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="60">Last 60 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              </div>

              <div>
                <label htmlFor="responsefrom" className="block text-sm font-medium mb-2">
                  Response Due (Days From Now)
                </label>
                <input
                  type="number"
                  id="responsefrom"
                  value={responseFromDays}
                  onChange={(e) => setResponseFromDays(e.target.value)}
                  placeholder="7, 30, 60..."
                  min="0"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="responseto" className="block text-sm font-medium mb-2">
                  Response Due (Days To)
                </label>
                <input
                  type="number"
                  id="responseto"
                  value={responseToDays}
                  onChange={(e) => setResponseToDays(e.target.value)}
                  placeholder="90, 180..."
                  min="0"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Search Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-border">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => handleDirectSearch(0)}
                disabled={isAnalyzing}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                {isAnalyzing ? 'Searching...' : 'Search Opportunities'}
              </button>
              
              {samUrl && isValidUrl && (
                <button 
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  {isAnalyzing ? 'Analyzing...' : 'Search via URL'}
                </button>
              )}
            </div>
            
            <div className="text-sm text-muted-foreground">
              {Object.values({ title, ncode, ccode, setAsideType, noticeTypes: noticeTypes.join(','), organizationCode, organizationName, state, zip }).filter(Boolean).length} filters active
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-red-600 dark:text-red-300 mt-1">{error}</p>
        </div>
      )}

      {/* Results */}
      {searchResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold font-heading">
              Search Results
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="pageSize" className="text-sm text-muted-foreground">
                  Show:
                </label>
                <select
                  id="pageSize"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(e.target.value);
                    setCurrentOffset(0);
                    setCurrentPage(0);
                    // Re-run search with new page size
                    if (lastSearchParams) {
                      handleDirectSearch(0);
                    }
                  }}
                  className="px-2 py-1 border border-border rounded bg-input text-foreground text-sm"
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
              <div className="text-sm text-muted-foreground">
                Page {Math.floor(currentOffset / parseInt(pageSize)) + 1} of {Math.ceil(searchResult.totalFound / parseInt(pageSize))} • 
                Total: {searchResult.totalFound} contracts
              </div>
            </div>
          </div>
          <ContractTable 
            contracts={searchResult.contracts}
            onStatusChange={handleStatusChange}
            onContractClick={handleContractClick}
            loading={isAnalyzing}
          />
          
          {/* Pagination Controls */}
          <div className="flex justify-center items-center gap-4 pt-4">
            <button
              onClick={() => {
                const newOffset = Math.max(0, currentOffset - parseInt(pageSize));
                setCurrentOffset(newOffset);
                setCurrentPage(Math.floor(newOffset / parseInt(pageSize)));
                handleDirectSearch(newOffset);
              }}
              disabled={currentOffset === 0 || isAnalyzing}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Previous
            </button>
            
            <span className="text-sm text-muted-foreground">
              Page {Math.floor(currentOffset / parseInt(pageSize)) + 1} of {Math.ceil(searchResult.totalFound / parseInt(pageSize))}
            </span>
            
            <button
              onClick={() => {
                const newOffset = currentOffset + parseInt(pageSize);
                if (newOffset < searchResult.totalFound) {
                  setCurrentOffset(newOffset);
                  setCurrentPage(Math.floor(newOffset / parseInt(pageSize)));
                  handleDirectSearch(newOffset);
                }
              }}
              disabled={currentOffset + parseInt(pageSize) >= searchResult.totalFound || isAnalyzing}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Placeholder when no results */}
      {!searchResult && !isAnalyzing && (
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">No contracts searched yet</p>
            <p>Paste a SAM.gov search URL above to get started</p>
          </div>
        </div>
      )}

      {/* Contract Preview Modal */}
      {selectedContractId && (
        <ContractPreviewModal
          opportunityId={selectedContractId}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveContract}
        />
      )}
    </div>
  );
}
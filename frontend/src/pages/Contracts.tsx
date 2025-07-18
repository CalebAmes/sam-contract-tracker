import React from 'react';
import { useNavigate } from 'react-router-dom';
import ContractsTable from '../components/ContractsTable';

export default function Contracts() {
  const navigate = useNavigate();

  const handleContractClick = (contractId: string) => {
    navigate(`/contracts/${contractId}`);
  };

  const handleOpenAnalysisModal = (contractId: string) => {
    // Navigate to contract view and open analysis modal
    navigate(`/contracts/${contractId}?openAnalysis=true`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-heading mb-2">Contracts</h2>
        <p className="text-muted-foreground">
          Manage and analyze your tracked contracts
        </p>
      </div>
      
      <ContractsTable 
        onContractClick={handleContractClick}
        onOpenAnalysisModal={handleOpenAnalysisModal}
      />
    </div>
  );
}
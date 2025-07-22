import DatabaseService from './database';
import { ContractStatus } from './database';

/**
 * Migration script to update contract statuses from old enum values to new ones
 * 
 * Old statuses -> New statuses mapping:
 * - 'new' -> 'new' (no change)
 * - 'investigating' -> 'interested' 
 * - 'interested' -> 'interested' (no change)
 * - 'dismissed' -> 'discarded'
 * - 'applied' -> 'submitted'
 * - 'awarded' -> 'awarded' (no change)
 * - 'lost' -> 'lost' (no change)
 */

const statusMapping: Record<string, ContractStatus> = {
  'new': ContractStatus.NEW,
  'investigating': ContractStatus.INTERESTED,
  'interested': ContractStatus.INTERESTED,
  'dismissed': ContractStatus.DISCARDED,
  'applied': ContractStatus.SUBMITTED,
  'awarded': ContractStatus.AWARDED,
  'lost': ContractStatus.LOST,
  // Also handle any potential new values that might already exist
  'pre-bid': ContractStatus.PRE_BID,
  'submitted': ContractStatus.SUBMITTED,
  'discarded': ContractStatus.DISCARDED,
  'case-study': ContractStatus.CASE_STUDY,
};

async function migrateContractStatuses() {
  const db = new DatabaseService();
  
  console.log('Starting contract status migration...');
  
  try {
    // Get all contracts
    const contracts = await db.getContracts(99999); // Get all contracts
    console.log(`Found ${contracts.length} contracts to check`);
    
    let updatedCount = 0;
    
    for (const contract of contracts) {
      const currentStatus = contract.status;
      const newStatus = statusMapping[currentStatus];
      
      // Only update if the status needs to change
      if (newStatus && newStatus !== currentStatus) {
        console.log(`Updating contract ${contract.id}: ${currentStatus} -> ${newStatus}`);
        await db.updateContractStatus(contract.id, newStatus);
        updatedCount++;
      }
    }
    
    console.log(`Migration complete. Updated ${updatedCount} contracts.`);
    
    // Display status distribution after migration
    const updatedContracts = await db.getContracts(99999);
    const statusCounts: Record<string, number> = {};
    
    updatedContracts.forEach(contract => {
      statusCounts[contract.status] = (statusCounts[contract.status] || 0) + 1;
    });
    
    console.log('\nStatus distribution after migration:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} contracts`);
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  migrateContractStatuses()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}

export default migrateContractStatuses;
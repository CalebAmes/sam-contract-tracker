import { SDRIntakeRepository } from "./entities";
import { SDRIntakeOpportunity, SDRIntakeNote } from "./schema";

export interface SDRIntakeDetail extends SDRIntakeOpportunity {
  notes: SDRIntakeNote[];
}

export async function getIntakeDetail(
  id: string
): Promise<SDRIntakeDetail | undefined> {
  const opportunity = await SDRIntakeRepository.getById(id);
  if (!opportunity) {
    return undefined;
  }
  const notes = await SDRIntakeRepository.listNotes(id);
  return {
    ...opportunity,
    notes,
  };
}

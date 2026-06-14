import { getAndIncrementSequence } from '../database/repositories/sequenceRepo'
import { logger } from '../utils/logger'

/**
 * Generate a contract number for a given employee.
 * Format: {employee_id}_{2-digit sequence}
 * Example: CE3E5PLL_01, CE3E5PLL_02
 *
 * Sequence rules:
 * - Query max sequence for employee_id from history
 * - New sequence = max + 1
 * - Never re-use deleted gaps
 * - First contract for employee starts at 01
 */
export async function generateContractNumber(employeeId: string): Promise<string> {
  try {
    const seq = await getAndIncrementSequence(employeeId)
    const paddedSeq = String(seq).padStart(2, '0')
    const contractNumber = `${employeeId}_${paddedSeq}`

    logger.info(`Generated contract number: ${contractNumber} (seq=${seq})`)
    return contractNumber
  } catch (err) {
    logger.error(`Failed to generate contract number for ${employeeId}`, err)
    // Fallback: use timestamp-based sequence (won't happen normally)
    const fallbackSeq = String(Date.now() % 100).padStart(2, '0')
    return `${employeeId}_${fallbackSeq}`
  }
}

/**
 * Validate that a contract number follows the expected format.
 */
export function validateContractNumberFormat(contractNumber: string): boolean {
  return /^.+_\d{2,}$/.test(contractNumber)
}

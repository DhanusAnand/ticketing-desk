import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';

// Utility functions for generating and managing ticket IDs with user counters

/**
 * Generates a user-specific sequential ticket ID using counters in the users table
 * Technical requests: T-0001, T-0002, etc.
 * Service requests: S-0001, S-0002, etc.
 * Each user has their own counter sequence stored in their user document
 */
export async function generateUserTicketId(category: 'Service' | 'Technical', userId: string): Promise<string> {
  const prefix = category === 'Technical' ? 'T' : 'S';
  const counterField = category === 'Technical' ? 'technicalTicketCount' : 'serviceTicketCount';
  
  try {
    // Use Firestore transaction to ensure sequential numbering per user
    const ticketId = await runTransaction(db, async (transaction) => {
      // Get user document
      const userRef = doc(db, 'users', userId);
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User document not found. Please ensure user is properly registered.');
      }
      
      const userData = userDoc.data();
      const nextNumber = (userData[counterField] || 0) + 1;
      
      // Update the counter in user document
      const updateData = {
        [counterField]: nextNumber
      };
      
      transaction.update(userRef, updateData);
      
      // Return the formatted ticket ID
      const paddedNum = nextNumber.toString().padStart(4, '0');
      return `${prefix}-${paddedNum}`;
    });
    
    return ticketId;
  } catch (error) {
    console.error('Error generating user ticket ID:', error);
    // Fallback to random number if transaction fails
    const randomNum = Math.floor(Math.random() * 9999) + 1;
    const paddedNum = randomNum.toString().padStart(4, '0');
    return `${prefix}-${paddedNum}`;
  }
}

/**
 * Gets current counter values for a user
 */
export async function getUserCounters(userId: string): Promise<{ technical: number; service: number }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        technical: userData.technicalTicketCount || 0,
        service: userData.serviceTicketCount || 0,
      };
    }
    
    return { technical: 0, service: 0 };
  } catch (error) {
    console.error('Error getting user counters:', error);
    return { technical: 0, service: 0 };
  }
}

/**
 * Validates if a ticket ID follows the expected format
 */
export function isValidTicketId(ticketId: string): boolean {
  const pattern = /^[TS]-\d{4}$/; // T-NNNN or S-NNNN
  return pattern.test(ticketId);
}

/**
 * Extracts category from ticket ID
 */
export function getCategoryFromTicketId(ticketId: string): 'Service' | 'Technical' | null {
  if (ticketId.startsWith('T-')) {
    return 'Technical';
  } else if (ticketId.startsWith('S-')) {
    return 'Service';
  }
  return null;
}

/**
 * Extracts the number from ticket ID
 */
export function getTicketNumber(ticketId: string): number | null {
  if (!isValidTicketId(ticketId)) {
    return null;
  }
  
  const numberPart = ticketId.split('-')[1];
  return parseInt(numberPart, 10);
}

/**
 * Formats ticket ID for display
 */
export function formatTicketId(ticketId: string): string {
  return ticketId; // Simple display, no additional formatting needed
}
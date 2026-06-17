/**
 * Time Utility — Indian Standard Time (IST) 24-hour formatter
 * Used across the entire IndiVibe app for consistent timestamp display
 */

/**
 * Formats an ISO date string into IST (Asia/Kolkata) 24-hour format.
 * Output: "17 Jun, 14:30"
 */
export function formatIST(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dateString;
  }
}

/**
 * Formats just the date portion in IST.
 * Output: "17 Jun"
 */
export function formatISTDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short'
    });
  } catch {
    return dateString;
  }
}

/**
 * Formats just the time portion in IST 24h.
 * Output: "14:30"
 */
export function formatISTTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dateString;
  }
}

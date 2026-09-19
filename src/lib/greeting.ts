/** Time-of-day greeting for the dashboard welcome section. Takes an explicit
 * date so it stays a pure, easily testable function. */
export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

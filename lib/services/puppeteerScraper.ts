const BALANCE_SELECTOR = "button.headerBalanceBtn span";

type PageLike = {
  goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>;
  waitForSelector: (selector: string, options?: Record<string, unknown>) => Promise<unknown>;
  type: (selector: string, text: string, options?: Record<string, unknown>) => Promise<unknown>;
  click: (selector: string, options?: Record<string, unknown>) => Promise<unknown>;
  waitForNavigation: (options?: Record<string, unknown>) => Promise<unknown>;
  $eval: <T>(selector: string, fn: (element: { innerText: string }) => T) => Promise<T>;
};

type ScrapeGoSportBalanceParams = {
  page: PageLike;
  loginUrl: string;
  username: string;
  password: string;
};

/**
 * Logs into GoSport365 and returns the numeric wallet balance from dashboard.
 */
export async function scrapeGoSportBalance({
  page,
  loginUrl,
  username,
  password,
}: ScrapeGoSportBalanceParams): Promise<number> {
  await page.goto(loginUrl, { waitUntil: "networkidle2" });

  // Generic login flow selectors used in current GoSport login form.
  await page.waitForSelector('input[name="loginField"]', { timeout: 15000 });
  await page.type('input[name="loginField"]', username, { delay: 10 });
  await page.type('input[name="password"]', password, { delay: 10 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click('button[type="submit"]'),
  ]);

  // Wait for the balance element to appear on the dashboard
  await page.waitForSelector(BALANCE_SELECTOR, { timeout: 15000 });

  // Extract the text (e.g., "MAD 300.00")
  const balanceText = await page.$eval(BALANCE_SELECTOR, (el) => el.innerText);

  // Clean the string (remove 'MAD', spaces, and commas) and parse as float
  const cleanBalance = parseFloat(balanceText.replace(/[^\d.]/g, ""));

  if (isNaN(cleanBalance)) {
    throw new Error(`Failed to parse balance from text: ${balanceText}`);
  }

  return cleanBalance; // Returns 300
}


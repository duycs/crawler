const puppeteer = require("puppeteer");

(async function main() {
  const browser = await puppeteer.launch({
    defaultViewport: { width: 1400, height: 900 },
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
  );
  await page.goto("https://dstock.vndirect.com.vn/d-rating-chuyen-sau/HPG");
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await page.waitForSelector(".drating-box__main", {
    visible: true,
    timeout: 5000,
  });
  
  const box = await page.evaluate(
    () => document.querySelector(".drating-box__main").innerHTML
  );

  console.log(box);

  const data = await page.$$eval('.drating-box__main table tr td', tds => tds.map((td) => {
    return td.innerText;
  }));
  
  console.log(data);

  process.exit(0);
})();

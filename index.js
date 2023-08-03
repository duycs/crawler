const puppeteer = require("puppeteer");
const sqlite3 = require("sqlite3");

const db = new sqlite3.Database("./db.sqlite");

(async function main() {
  const browser = await puppeteer.launch({
    defaultViewport: { width: 1400, height: 900 },
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
  );
  await page.goto("https://dstock.vndirect.com.vn/d-rating-chuyen-sau/HPG");
  await page.waitForSelector(".drating-box__main", {
    visible: true,
    timeout: 5000,
  });

  const data = await page.$$eval(".drating-box__main table tr td", (tds) =>
    tds.map((td) => {
      return td.innerText;
    })
  );

  db.serialize(() => {
    db.prepare('INSERT INTO "data" ("value") VALUES (?)')
      .run(JSON.stringify(data))
      .finalize();
  });

  // wait for db to be closed before exit
  await new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  console.log(data);

  process.exit(0);
})();
